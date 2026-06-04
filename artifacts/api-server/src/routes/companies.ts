import { Router, type IRouter } from "express";
import { db, companiesTable, leadsTable } from "@workspace/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/companies", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = Number(req.query.limit) || 100;

    let companies;
    if (search) {
      companies = await db.select().from(companiesTable)
        .where(and(ilike(companiesTable.name, `%${search}%`), eq(companiesTable.workspaceId, req.workspaceId!)))
        .orderBy(desc(companiesTable.updatedAt))
        .limit(limit);
    } else {
      companies = await db.select().from(companiesTable)
        .where(eq(companiesTable.workspaceId, req.workspaceId!))
        .orderBy(desc(companiesTable.updatedAt))
        .limit(limit);
    }

    const enriched = await Promise.all(companies.map(async (company) => {
      const leads = await db.select({
        id: leadsTable.id,
        contactName: leadsTable.contactName,
        status: leadsTable.status,
        email: leadsTable.email,
        dealValueEstimate: leadsTable.dealValueEstimate,
      })
        .from(leadsTable)
        .where(and(ilike(leadsTable.companyName, company.name), eq(leadsTable.workspaceId, req.workspaceId!)));

      return {
        ...company,
        leads,
        actualLeadCount: leads.length,
        totalValue: leads.reduce((sum, l) => sum + (l.dealValueEstimate ? parseFloat(l.dealValueEstimate) : 0), 0),
      };
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [company] = await db.select().from(companiesTable).where(and(eq(companiesTable.id, id), eq(companiesTable.workspaceId, req.workspaceId!)));
    if (!company) return res.status(404).json({ message: "Company not found" });

    const leads = await db.select()
      .from(leadsTable)
      .where(and(ilike(leadsTable.companyName, company.name), eq(leadsTable.workspaceId, req.workspaceId!)))
      .orderBy(desc(leadsTable.updatedAt));

    res.json({ ...company, leads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/companies", requireRole("operator"), async (req, res) => {
  try {
    const { name, website, industry, subIndustry, city, state, country, phone, notes, eventProjectNotes, referral, referredBy, referralNotes, referralPartnerStatus } = req.body;
    if (!name) return res.status(400).json({ message: "Company name is required" });

    const [company] = await db.insert(companiesTable).values({
      name,
      website: website || null,
      industry: industry || null,
      subIndustry: subIndustry || null,
      city: city || null,
      state: state || null,
      country: country || null,
      phone: phone || null,
      notes: notes || null,
      eventProjectNotes: eventProjectNotes || null,
      referral: referral ?? false,
      referredBy: referredBy || null,
      referralNotes: referralNotes || null,
      referralPartnerStatus: referralPartnerStatus || null,
      workspaceId: req.workspaceId!,
    }).returning();

    res.status(201).json(company);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/companies/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, website, industry, subIndustry, city, state, country, phone, notes, eventProjectNotes, referral, referredBy, referralNotes, referralPartnerStatus } = req.body;

    const [updated] = await db.update(companiesTable).set({
      name,
      website: website || null,
      industry: industry || null,
      subIndustry: subIndustry || null,
      city: city || null,
      state: state || null,
      country: country || null,
      phone: phone || null,
      notes: notes || null,
      eventProjectNotes: eventProjectNotes || null,
      referral: referral ?? false,
      referredBy: referredBy || null,
      referralNotes: referralNotes || null,
      referralPartnerStatus: referralPartnerStatus || null,
      updatedAt: new Date(),
    }).where(and(eq(companiesTable.id, id), eq(companiesTable.workspaceId, req.workspaceId!))).returning();

    if (!updated) return res.status(404).json({ message: "Company not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/companies/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(companiesTable).where(and(eq(companiesTable.id, id), eq(companiesTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/companies/sync-from-leads", requireRole("manager"), async (req, res) => {
  try {
    const leads = await db.select({
      companyName: leadsTable.companyName,
      industry: leadsTable.industry,
      location: leadsTable.location,
    }).from(leadsTable).where(eq(leadsTable.workspaceId, req.workspaceId!));

    const companyMap = new Map<string, { industry?: string; location?: string; count: number }>();
    for (const lead of leads) {
      const name = lead.companyName?.trim();
      if (!name) continue;
      const existing = companyMap.get(name);
      if (existing) {
        existing.count++;
      } else {
        companyMap.set(name, {
          industry: lead.industry || undefined,
          location: lead.location || undefined,
          count: 1,
        });
      }
    }

    let created = 0;
    for (const [name, data] of companyMap) {
      const [existing] = await db.select({ id: companiesTable.id })
        .from(companiesTable)
        .where(and(eq(companiesTable.name, name), eq(companiesTable.workspaceId, req.workspaceId!)))
        .limit(1);

      if (!existing) {
        const parts = (data.location || "").split(",").map(s => s.trim());
        await db.insert(companiesTable).values({
          name,
          industry: data.industry || null,
          city: parts[0] || null,
          state: parts[1] || null,
          leadCount: data.count,
          workspaceId: req.workspaceId!,
        });
        created++;
      } else {
        await db.update(companiesTable).set({
          leadCount: data.count,
          updatedAt: new Date(),
        }).where(and(eq(companiesTable.id, existing.id), eq(companiesTable.workspaceId, req.workspaceId!)));
      }
    }

    res.json({ synced: companyMap.size, created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
