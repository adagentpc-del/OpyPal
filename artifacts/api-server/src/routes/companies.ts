import { Router, type IRouter } from "express";
import { db, companiesTable, leadsTable } from "@workspace/db";
import { eq, desc, ilike, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/companies", async (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const limit = Number(req.query.limit) || 100;

    let companies;
    if (search) {
      companies = await db.select().from(companiesTable)
        .where(ilike(companiesTable.name, `%${search}%`))
        .orderBy(desc(companiesTable.updatedAt))
        .limit(limit);
    } else {
      companies = await db.select().from(companiesTable)
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
        .where(ilike(leadsTable.companyName, company.name));

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
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id));
    if (!company) return res.status(404).json({ message: "Company not found" });

    const leads = await db.select()
      .from(leadsTable)
      .where(ilike(leadsTable.companyName, company.name))
      .orderBy(desc(leadsTable.updatedAt));

    res.json({ ...company, leads });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/companies", async (req, res) => {
  try {
    const { name, website, industry, subIndustry, city, state, country, phone, notes } = req.body;
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
    }).returning();

    res.status(201).json(company);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, website, industry, subIndustry, city, state, country, phone, notes } = req.body;

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
      updatedAt: new Date(),
    }).where(eq(companiesTable.id, id)).returning();

    if (!updated) return res.status(404).json({ message: "Company not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(companiesTable).where(eq(companiesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/companies/sync-from-leads", async (_req, res) => {
  try {
    const leads = await db.select({
      companyName: leadsTable.companyName,
      industry: leadsTable.industry,
      location: leadsTable.location,
    }).from(leadsTable);

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
        .where(eq(companiesTable.name, name))
        .limit(1);

      if (!existing) {
        const parts = (data.location || "").split(",").map(s => s.trim());
        await db.insert(companiesTable).values({
          name,
          industry: data.industry || null,
          city: parts[0] || null,
          state: parts[1] || null,
          leadCount: data.count,
        });
        created++;
      } else {
        await db.update(companiesTable).set({
          leadCount: data.count,
          updatedAt: new Date(),
        }).where(eq(companiesTable.id, existing.id));
      }
    }

    res.json({ synced: companyMap.size, created });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
