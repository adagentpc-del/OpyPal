import { Router, type IRouter } from "express";
import { db, leadsTable, activityTable } from "@workspace/db";
import { eq, ilike, or, and, sql, lte, lt } from "drizzle-orm";
import {
  GetLeadsQueryParams,
  CreateLeadBody,
  GetLeadParams,
  UpdateLeadBody,
  UpdateLeadParams,
  DeleteLeadParams,
  DuplicateLeadParams,
  UpdateLeadStatusParams,
  UpdateLeadStatusBody,
  ImportLeadsBody,
} from "@workspace/api-zod";
import { syncLeadToSheet, deleteLeadFromSheet, fullSyncToSheet } from "../lib/sheets-sync";

const router: IRouter = Router();

function calculateForecast(proposalValue: string | null, dealValueEstimate: string | null, closeProbability: string | null): string | null {
  const value = proposalValue ? parseFloat(proposalValue) : dealValueEstimate ? parseFloat(dealValueEstimate) : null;
  const prob = closeProbability ? parseFloat(closeProbability) : null;
  if (value && prob) {
    return (value * prob / 100).toFixed(2);
  }
  return null;
}

router.get("/leads", async (req, res) => {
  try {
    const query = GetLeadsQueryParams.parse(req.query);
    const conditions: any[] = [];

    if (query.search) {
      const searchTerm = `%${query.search}%`;
      conditions.push(
        or(
          ilike(leadsTable.companyName, searchTerm),
          ilike(leadsTable.contactName, searchTerm),
          ilike(leadsTable.email, searchTerm)
        )
      );
    }
    if (query.pipelineType) conditions.push(eq(leadsTable.pipelineType, query.pipelineType));
    if (query.status) conditions.push(eq(leadsTable.status, query.status));
    if (query.projectType) conditions.push(eq(leadsTable.projectType, query.projectType));
    if (query.source) conditions.push(eq(leadsTable.source, query.source));
    if (query.location) conditions.push(ilike(leadsTable.location, `%${query.location}%`));

    const today = new Date().toISOString().split("T")[0];
    if (query.followUpDueToday) {
      conditions.push(eq(leadsTable.nextFollowUpDate, today));
    }
    if (query.overdue) {
      conditions.push(lt(leadsTable.nextFollowUpDate, today));
      conditions.push(
        and(
          sql`${leadsTable.status} NOT IN ('Closed Won', 'Closed Lost')`
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const leads = await db.select().from(leadsTable).where(where).orderBy(leadsTable.id);
    res.json(leads);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const data = CreateLeadBody.parse(req.body);
    const forecastValue = calculateForecast(
      data.proposalValue?.toString() ?? null,
      data.dealValueEstimate?.toString() ?? null,
      data.closeProbability?.toString() ?? null
    );

    const [lead] = await db.insert(leadsTable).values({
      ...data,
      estimatedBudget: data.estimatedBudget?.toString(),
      dealValueEstimate: data.dealValueEstimate?.toString(),
      proposalValue: data.proposalValue?.toString(),
      closeProbability: data.closeProbability?.toString(),
      forecastValue,
    }).returning();

    await db.insert(activityTable).values({
      type: "lead_created",
      description: `New lead created: ${lead.companyName}`,
      leadId: lead.id,
    });

    syncLeadToSheet(lead).catch(() => {});

    res.status(201).json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/leads/:id", async (req, res) => {
  try {
    const { id } = GetLeadParams.parse({ id: req.params.id });
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/leads/:id", async (req, res) => {
  try {
    const { id } = UpdateLeadParams.parse({ id: req.params.id });
    const data = UpdateLeadBody.parse(req.body);
    const forecastValue = calculateForecast(
      data.proposalValue?.toString() ?? null,
      data.dealValueEstimate?.toString() ?? null,
      data.closeProbability?.toString() ?? null
    );

    const [lead] = await db.update(leadsTable)
      .set({
        ...data,
        estimatedBudget: data.estimatedBudget?.toString(),
        dealValueEstimate: data.dealValueEstimate?.toString(),
        proposalValue: data.proposalValue?.toString(),
        closeProbability: data.closeProbability?.toString(),
        forecastValue,
        updatedAt: new Date(),
      })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await db.insert(activityTable).values({
      type: "lead_updated",
      description: `Lead updated: ${lead.companyName}`,
      leadId: lead.id,
    });

    syncLeadToSheet(lead).catch(() => {});

    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/leads/:id", async (req, res) => {
  try {
    const { id } = DeleteLeadParams.parse({ id: req.params.id });
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await db.delete(leadsTable).where(eq(leadsTable.id, id));

    await db.insert(activityTable).values({
      type: "lead_deleted",
      description: `Lead deleted: ${lead.companyName}`,
    });

    deleteLeadFromSheet(id).catch(() => {});

    res.json({ message: "Lead deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/leads/:id/duplicate", async (req, res) => {
  try {
    const { id } = DuplicateLeadParams.parse({ id: req.params.id });
    const [original] = await db.select().from(leadsTable).where(eq(leadsTable.id, id));
    if (!original) return res.status(404).json({ message: "Lead not found" });

    const { id: _, createdAt, updatedAt, ...rest } = original;
    const [lead] = await db.insert(leadsTable).values({
      ...rest,
      companyName: `${original.companyName} (Copy)`,
    }).returning();

    await db.insert(activityTable).values({
      type: "lead_duplicated",
      description: `Lead duplicated: ${lead.companyName}`,
      leadId: lead.id,
    });

    syncLeadToSheet(lead).catch(() => {});

    res.status(201).json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/leads/:id/status", async (req, res) => {
  try {
    const { id } = UpdateLeadStatusParams.parse({ id: req.params.id });
    const { status } = UpdateLeadStatusBody.parse(req.body);

    const [lead] = await db.update(leadsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(leadsTable.id, id))
      .returning();

    if (!lead) return res.status(404).json({ message: "Lead not found" });

    await db.insert(activityTable).values({
      type: "status_changed",
      description: `${lead.companyName} status changed to ${status}`,
      leadId: lead.id,
    });

    syncLeadToSheet(lead).catch(() => {});

    res.json(lead);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/leads/import", async (req, res) => {
  try {
    const { leads } = ImportLeadsBody.parse(req.body);
    let imported = 0;
    let skipped = 0;
    const importedLeads: any[] = [];

    for (const leadData of leads) {
      if (leadData.email && leadData.companyName) {
        const existing = await db.select().from(leadsTable)
          .where(
            and(
              eq(leadsTable.email, leadData.email),
              eq(leadsTable.companyName, leadData.companyName)
            )
          );
        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      const forecastValue = calculateForecast(
        leadData.proposalValue?.toString() ?? null,
        leadData.dealValueEstimate?.toString() ?? null,
        leadData.closeProbability?.toString() ?? null
      );

      const [lead] = await db.insert(leadsTable).values({
        ...leadData,
        estimatedBudget: leadData.estimatedBudget?.toString(),
        dealValueEstimate: leadData.dealValueEstimate?.toString(),
        proposalValue: leadData.proposalValue?.toString(),
        closeProbability: leadData.closeProbability?.toString(),
        forecastValue,
      }).returning();
      importedLeads.push(lead);
      imported++;
    }

    if (importedLeads.length > 0) {
      const allLeads = await db.select().from(leadsTable).orderBy(leadsTable.id);
      fullSyncToSheet(allLeads).catch(() => {});
    }

    res.json({ imported, skipped, total: leads.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
