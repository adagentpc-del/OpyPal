import { Router, type IRouter } from "express";
import { db, leadsTable, activityTable, outreachHistoryTable, scheduledEmailsTable } from "@workspace/db";
import { eq, ilike, or, and, sql, lte, lt, desc } from "drizzle-orm";
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
  GetLeadHistoryParams,
  CreateLeadHistoryParams,
  CreateLeadHistoryBody,
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

const EVENT_KEYWORDS = [
  "hotel", "venue", "convention", "hospitality", "resort", "casino", "event",
  "events", "conference", "banquet", "catering", "meeting", "ballroom",
  "programming", "entertainment",
];
const AGENCY_KEYWORDS = [
  "agency", "experiential", "creative", "marketing", "advertising", "media",
  "brand", "branding", "communications", "pr", "public relations", "design",
  "strategy", "activation",
];

function inferPipeline(lead: { companyName?: string; title?: string; industry?: string }): string {
  const text = `${lead.companyName || ""} ${lead.title || ""} ${lead.industry || ""}`.toLowerCase();
  const agencyScore = AGENCY_KEYWORDS.filter(k => text.includes(k)).length;
  const eventScore = EVENT_KEYWORDS.filter(k => text.includes(k)).length;
  if (agencyScore > eventScore) return "Agency";
  return "Event";
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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 2);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    for (const leadData of leads) {
      const hasDupByEmail = leadData.email ? (await db.select().from(leadsTable)
        .where(eq(leadsTable.email, leadData.email))).length > 0 : false;
      const hasDupByName = (await db.select().from(leadsTable)
        .where(and(
          eq(leadsTable.companyName, leadData.companyName),
          eq(leadsTable.contactName, leadData.contactName)
        ))).length > 0;

      if (hasDupByEmail || hasDupByName) {
        skipped++;
        continue;
      }

      const pipelineType = leadData.pipelineType || inferPipeline(leadData);
      const status = leadData.status || "New Lead";
      const source = leadData.source || "ZoomInfo";
      const nextStep = leadData.nextStep || "Initial outreach";
      const nextFollowUpDate = leadData.nextFollowUpDate || tomorrowStr;

      const forecastValue = calculateForecast(
        leadData.proposalValue?.toString() ?? null,
        leadData.dealValueEstimate?.toString() ?? null,
        leadData.closeProbability?.toString() ?? null
      );

      const [lead] = await db.insert(leadsTable).values({
        companyName: leadData.companyName,
        contactName: leadData.contactName,
        pipelineType,
        status,
        source,
        nextStep,
        nextFollowUpDate,
        email: leadData.email || null,
        phone: leadData.phone || null,
        title: leadData.title || null,
        location: leadData.location || null,
        industry: leadData.industry || null,
        linkedin: leadData.linkedin || null,
        venueProperty: leadData.venueProperty || null,
        projectType: leadData.projectType || null,
        notes: leadData.notes || null,
        lastContactDate: leadData.lastContactDate || null,
        estimatedBudget: leadData.estimatedBudget?.toString() || null,
        dealValueEstimate: leadData.dealValueEstimate?.toString() || null,
        proposalValue: leadData.proposalValue?.toString() || null,
        closeProbability: leadData.closeProbability?.toString() || null,
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

router.get("/leads/:id/history", async (req, res) => {
  try {
    const { id } = GetLeadHistoryParams.parse({ id: req.params.id });
    const history = await db.select().from(outreachHistoryTable)
      .where(eq(outreachHistoryTable.leadId, id))
      .orderBy(desc(outreachHistoryTable.sentAt));
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/leads/:id/history", async (req, res) => {
  try {
    const { id } = CreateLeadHistoryParams.parse({ id: req.params.id });
    const data = CreateLeadHistoryBody.parse(req.body);

    const [entry] = await db.insert(outreachHistoryTable).values({
      leadId: id,
      ...data,
    }).returning();

    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/leads/:id/activities", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const activities = await db.select().from(activityTable)
      .where(eq(activityTable.leadId, id))
      .orderBy(desc(activityTable.createdAt));
    res.json(activities);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
