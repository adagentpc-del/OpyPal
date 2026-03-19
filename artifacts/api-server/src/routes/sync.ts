import { Router, type IRouter } from "express";
import { db, leadsTable } from "@workspace/db";
import { getSyncStatus, testConnection, fullSyncToSheet, seedFromSheetIfEmpty } from "../lib/sheets-sync";

const router: IRouter = Router();

router.get("/sync/status", async (_req, res) => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ status: "error", lastSync: null, error: err.message });
  }
});

router.post("/sync/test", async (_req, res) => {
  try {
    const connected = await testConnection();
    const status = getSyncStatus();
    res.json({ connected, ...status });
  } catch (err: any) {
    res.status(500).json({ connected: false, status: "error", lastSync: null, error: err.message });
  }
});

router.post("/sync/full", async (_req, res) => {
  try {
    const leads = await db.select().from(leadsTable).orderBy(leadsTable.id);
    await fullSyncToSheet(leads);
    const status = getSyncStatus();
    res.json({ synced: leads.length, ...status });
  } catch (err: any) {
    res.status(500).json({ synced: 0, status: "error", error: err.message });
  }
});

router.post("/sync/seed", async (_req, res) => {
  try {
    const existingLeads = await db.select().from(leadsTable);
    if (existingLeads.length > 0) {
      return res.json({ message: "Database already has leads, skipping seed", seeded: 0 });
    }

    const sheetLeads = await seedFromSheetIfEmpty(0);
    if (sheetLeads.length === 0) {
      return res.json({ message: "No leads found in sheet to seed", seeded: 0 });
    }

    let seeded = 0;
    for (const lead of sheetLeads) {
      const { id, forecastValue, ...rest } = lead;
      const fv = rest.proposalValue || rest.dealValueEstimate
        ? (((rest.proposalValue || rest.dealValueEstimate) * (rest.closeProbability || 0)) / 100).toFixed(2)
        : null;
      await db.insert(leadsTable).values({
        pipelineType: rest.pipelineType || "Event",
        companyName: rest.companyName,
        contactName: rest.contactName,
        title: rest.title || null,
        email: rest.email || null,
        phone: rest.phone || null,
        linkedin: rest.linkedin || null,
        location: rest.location || null,
        industry: rest.industry || null,
        venueProperty: rest.venueProperty || null,
        projectType: rest.projectType || null,
        estimatedBudget: rest.estimatedBudget?.toString() || null,
        status: rest.status || "New Lead",
        lastContactDate: rest.lastContactDate || null,
        nextStep: rest.nextStep || null,
        nextFollowUpDate: rest.nextFollowUpDate || null,
        notes: rest.notes || null,
        dealValueEstimate: rest.dealValueEstimate?.toString() || null,
        proposalValue: rest.proposalValue?.toString() || null,
        closeProbability: rest.closeProbability?.toString() || null,
        forecastValue: fv,
        source: rest.source || null,
      });
      seeded++;
    }

    res.json({ message: `Seeded ${seeded} leads from Google Sheet`, seeded });
  } catch (err: any) {
    res.status(500).json({ message: err.message, seeded: 0 });
  }
});

export default router;
