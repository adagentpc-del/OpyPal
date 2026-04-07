import { Router } from "express";
import { db, partnerRequestsTable, requestItemsTable, requestUploadsTable, adminNotesTable, partnersTable } from "@workspace/db";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import { generateInternalSummary, generateAiSummary, getRecommendedUpsells, estimateScopeLevel } from "../lib/partner-ai";
import { sendAdminNotification } from "../lib/email-adapters";

const router = Router();

router.get("/partner-requests", async (req, res) => {
  try {
    const { partnerId, status, search } = req.query;
    let query = db.select({
      request: partnerRequestsTable,
      partnerName: partnersTable.companyName,
      partnerSlug: partnersTable.slug,
    }).from(partnerRequestsTable)
      .leftJoin(partnersTable, eq(partnerRequestsTable.partnerId, partnersTable.id))
      .orderBy(desc(partnerRequestsTable.createdAt)).$dynamic();

    const conditions: any[] = [];
    if (partnerId) conditions.push(eq(partnerRequestsTable.partnerId, parseInt(partnerId as string)));
    if (status) conditions.push(eq(partnerRequestsTable.status, status as string));
    if (search) conditions.push(
      sql`(${partnerRequestsTable.companyName} ILIKE ${'%' + search + '%'} OR ${partnerRequestsTable.contactName} ILIKE ${'%' + search + '%'} OR ${partnerRequestsTable.eventName} ILIKE ${'%' + search + '%'})`
    );
    if (conditions.length > 0) query = query.where(and(...conditions));

    const results = await query;
    res.json(results.map(r => ({ ...r.request, partnerName: r.partnerName, partnerSlug: r.partnerSlug })));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/partner-requests/dashboard/summary", async (req, res) => {
  try {
    const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(partnerRequestsTable);
    const statusCounts = await db
      .select({ status: partnerRequestsTable.status, count: sql<number>`count(*)::int` })
      .from(partnerRequestsTable)
      .groupBy(partnerRequestsTable.status);
    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status || "Unknown"] = row.count;
    }
    res.json({
      total: total?.count || 0,
      byStatus,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/partner-requests/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [request] = await db.select({
      request: partnerRequestsTable,
      partnerName: partnersTable.companyName,
      partnerSlug: partnersTable.slug,
    }).from(partnerRequestsTable)
      .leftJoin(partnersTable, eq(partnerRequestsTable.partnerId, partnersTable.id))
      .where(eq(partnerRequestsTable.id, id));
    if (!request) return res.status(404).json({ message: "Request not found" });

    const items = await db.select().from(requestItemsTable).where(eq(requestItemsTable.requestId, id));
    const uploads = await db.select().from(requestUploadsTable).where(eq(requestUploadsTable.requestId, id));
    const notes = await db.select().from(adminNotesTable).where(eq(adminNotesTable.requestId, id)).orderBy(desc(adminNotesTable.createdAt));

    res.json({
      ...request.request,
      partnerName: request.partnerName,
      partnerSlug: request.partnerSlug,
      items,
      uploads,
      notes,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/partner-requests", async (req, res) => {
  try {
    const { items, uploads, ...requestData } = req.body;

    const [request] = await db.insert(partnerRequestsTable).values({
      ...requestData,
      status: "New",
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    if (items?.length) {
      await db.insert(requestItemsTable).values(
        items.map((item: any) => ({ ...item, requestId: request.id }))
      );
    }

    if (uploads?.length) {
      await db.insert(requestUploadsTable).values(
        uploads.map((upload: any) => ({ ...upload, requestId: request.id }))
      );
    }

    const savedItems = items || [];
    const savedUploads = uploads || [];

    const internalSummary = generateInternalSummary(request, savedItems, savedUploads);
    const upsells = getRecommendedUpsells(savedItems);
    const scopeLevel = estimateScopeLevel(savedItems, savedUploads);

    let aiSummary = "";
    try {
      aiSummary = await generateAiSummary(request, savedItems, savedUploads);
    } catch (e) {
      aiSummary = "AI summary generation failed — manual review recommended.";
    }

    await db.update(partnerRequestsTable).set({
      internalSummary,
      aiSummary,
      recommendedUpsellsJson: upsells,
      estimatedScopeLevel: scopeLevel,
      updatedAt: new Date(),
    }).where(eq(partnerRequestsTable.id, request.id));

    let partnerName = "Unknown Partner";
    if (request.partnerId) {
      const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, request.partnerId));
      if (partner) partnerName = partner.companyName;
    }

    try {
      await sendAdminNotification({
        partnerName,
        contactName: request.contactName || "",
        companyName: request.companyName || "",
        eventName: request.eventName || "",
        eventDate: request.eventDate || "",
        categories: savedItems.map((i: any) => i.category).filter(Boolean),
        requestId: request.id,
      });
    } catch (e) {
      console.error("Email notification failed:", e);
    }

    res.status(201).json({
      ...request,
      internalSummary,
      aiSummary,
      recommendedUpsellsJson: upsells,
      estimatedScopeLevel: scopeLevel,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/partner-requests/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    const [request] = await db.update(partnerRequestsTable).set({ status, updatedAt: new Date() }).where(eq(partnerRequestsTable.id, id)).returning();
    if (!request) return res.status(404).json({ message: "Request not found" });
    res.json(request);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/partner-requests/:id/notes", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const [note] = await db.insert(adminNotesTable).values({
      requestId,
      noteBody: req.body.content || req.body.noteBody,
    }).returning();
    res.status(201).json(note);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
