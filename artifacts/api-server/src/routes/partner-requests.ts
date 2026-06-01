import { Router } from "express";
import { requireAuth, resolveWorkspace, requireRole } from "../middleware/clerk-auth";
import { db, partnerRequestsTable, requestItemsTable, requestUploadsTable, adminNotesTable, partnersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { generateInternalSummary, generateAiSummary, getRecommendedUpsells, estimateScopeLevel } from "../lib/partner-ai";
import { sendAdminNotification } from "../lib/email-adapters";

const router = Router();

router.get(
  "/partner-requests",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const { partnerId, status, search } = req.query;
      let query = db
        .select({
          request: partnerRequestsTable,
          partnerName: partnersTable.companyName,
          partnerSlug: partnersTable.slug,
        })
        .from(partnerRequestsTable)
        .leftJoin(partnersTable, eq(partnerRequestsTable.partnerId, partnersTable.id))
        .orderBy(desc(partnerRequestsTable.createdAt))
        .$dynamic();

      const conditions: any[] = [
        eq(partnerRequestsTable.workspaceId, req.workspaceId!),
      ];
      if (partnerId) conditions.push(eq(partnerRequestsTable.partnerId, parseInt(partnerId as string)));
      if (status) conditions.push(eq(partnerRequestsTable.status, status as string));
      if (search)
        conditions.push(
          sql`(${partnerRequestsTable.companyName} ILIKE ${"%" + search + "%"} OR ${partnerRequestsTable.contactName} ILIKE ${"%" + search + "%"} OR ${partnerRequestsTable.eventName} ILIKE ${"%" + search + "%"})`,
        );
      query = query.where(and(...conditions));

      const results = await query;
      res.json(results.map((r) => ({ ...r.request, partnerName: r.partnerName, partnerSlug: r.partnerSlug })));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.get(
  "/partner-requests/dashboard/summary",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const [total] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(partnerRequestsTable)
        .where(eq(partnerRequestsTable.workspaceId, req.workspaceId!));
      const statusCounts = await db
        .select({ status: partnerRequestsTable.status, count: sql<number>`count(*)::int` })
        .from(partnerRequestsTable)
        .where(eq(partnerRequestsTable.workspaceId, req.workspaceId!))
        .groupBy(partnerRequestsTable.status);
      const byStatus: Record<string, number> = {};
      for (const row of statusCounts) {
        byStatus[row.status || "Unknown"] = row.count;
      }
      res.json({ total: total?.count || 0, byStatus });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.get(
  "/partner-requests/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [request] = await db
        .select({
          request: partnerRequestsTable,
          partnerName: partnersTable.companyName,
          partnerSlug: partnersTable.slug,
        })
        .from(partnerRequestsTable)
        .leftJoin(partnersTable, eq(partnerRequestsTable.partnerId, partnersTable.id))
        .where(
          and(
            eq(partnerRequestsTable.id, id),
            eq(partnerRequestsTable.workspaceId, req.workspaceId!),
          ),
        );
      if (!request) return res.status(404).json({ message: "Request not found" });

      const items = await db
        .select()
        .from(requestItemsTable)
        .where(
          and(
            eq(requestItemsTable.requestId, id),
            eq(requestItemsTable.workspaceId, req.workspaceId!),
          ),
        );
      const uploads = await db
        .select()
        .from(requestUploadsTable)
        .where(
          and(
            eq(requestUploadsTable.requestId, id),
            eq(requestUploadsTable.workspaceId, req.workspaceId!),
          ),
        );
      const notes = await db
        .select()
        .from(adminNotesTable)
        .where(
          and(
            eq(adminNotesTable.requestId, id),
            eq(adminNotesTable.workspaceId, req.workspaceId!),
          ),
        )
        .orderBy(desc(adminNotesTable.createdAt));

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
  },
);

// Public intake form. The workspace is derived server-side from the partner the
// request is submitted to — the client value is never trusted.
router.post("/partner-requests", async (req, res) => {
  try {
    const { items, uploads, workspaceId: _ignore, id: _id, ...requestData } = req.body ?? {};

    const partnerId = requestData.partnerId ? parseInt(String(requestData.partnerId)) : NaN;
    if (!Number.isFinite(partnerId)) {
      return res.status(400).json({ message: "A valid partnerId is required" });
    }
    const [partner] = await db
      .select()
      .from(partnersTable)
      .where(eq(partnersTable.id, partnerId));
    if (!partner || !partner.isActive) {
      return res.status(404).json({ message: "Partner not found" });
    }
    const workspaceId = partner.workspaceId;

    const [request] = await db
      .insert(partnerRequestsTable)
      .values({
        ...requestData,
        partnerId,
        workspaceId,
        status: "New",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (items?.length) {
      await db.insert(requestItemsTable).values(
        items.map((item: any) => {
          const { workspaceId: _w, id: _i, requestId: _r, ...rest } = item ?? {};
          return { ...rest, requestId: request.id, workspaceId };
        }),
      );
    }

    if (uploads?.length) {
      await db.insert(requestUploadsTable).values(
        uploads.map((upload: any) => {
          const { workspaceId: _w, id: _i, requestId: _r, ...rest } = upload ?? {};
          return { ...rest, requestId: request.id, workspaceId };
        }),
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

    await db
      .update(partnerRequestsTable)
      .set({
        internalSummary,
        aiSummary,
        recommendedUpsellsJson: upsells,
        estimatedScopeLevel: scopeLevel,
        updatedAt: new Date(),
      })
      .where(eq(partnerRequestsTable.id, request.id));

    try {
      await sendAdminNotification({
        partnerName: partner.companyName,
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

router.patch(
  "/partner-requests/:id/status",
  requireAuth,
  resolveWorkspace,
  requireRole("operator"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const [request] = await db
        .update(partnerRequestsTable)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(partnerRequestsTable.id, id),
            eq(partnerRequestsTable.workspaceId, req.workspaceId!),
          ),
        )
        .returning();
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.post(
  "/partner-requests/:id/notes",
  requireAuth,
  resolveWorkspace,
  requireRole("operator"),
  async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      // Ensure the parent request is in this workspace.
      const [request] = await db
        .select({ id: partnerRequestsTable.id })
        .from(partnerRequestsTable)
        .where(
          and(
            eq(partnerRequestsTable.id, requestId),
            eq(partnerRequestsTable.workspaceId, req.workspaceId!),
          ),
        );
      if (!request) return res.status(404).json({ message: "Request not found" });
      const [note] = await db
        .insert(adminNotesTable)
        .values({
          requestId,
          workspaceId: req.workspaceId!,
          noteBody: req.body.content || req.body.noteBody,
        })
        .returning();
      res.status(201).json(note);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

export default router;
