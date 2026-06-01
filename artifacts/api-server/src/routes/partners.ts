import { Router } from "express";
import { requireAuth, resolveWorkspace, requireRole } from "../middleware/clerk-auth";
import { db, partnersTable, partnerAssetsTable, pricingRulesTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get(
  "/partners",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const partners = await db
        .select()
        .from(partnersTable)
        .where(eq(partnersTable.workspaceId, req.workspaceId!))
        .orderBy(desc(partnersTable.createdAt));
      res.json(partners);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.get(
  "/partners/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [partner] = await db
        .select()
        .from(partnersTable)
        .where(
          and(
            eq(partnersTable.id, id),
            eq(partnersTable.workspaceId, req.workspaceId!),
          ),
        );
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      const assets = await db
        .select()
        .from(partnerAssetsTable)
        .where(
          and(
            eq(partnerAssetsTable.partnerId, id),
            eq(partnerAssetsTable.workspaceId, req.workspaceId!),
          ),
        );
      res.json({ ...partner, assets });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

// Public: the white-label partner page. No auth — the workspace is derived from
// the partner record itself, and pricing is scoped to that same workspace.
router.get("/partners/slug/:slug", async (req, res) => {
  try {
    const [partner] = await db
      .select()
      .from(partnersTable)
      .where(eq(partnersTable.slug, req.params.slug));
    if (!partner || !partner.isActive)
      return res.status(404).json({ message: "Partner not found" });
    const assets = await db
      .select()
      .from(partnerAssetsTable)
      .where(
        and(
          eq(partnerAssetsTable.partnerId, partner.id),
          eq(partnerAssetsTable.workspaceId, partner.workspaceId),
        ),
      );
    let pricing: any[] = [];
    if (partner.pricingDisplayEnabled) {
      pricing = await db
        .select({
          id: pricingRulesTable.id,
          category: pricingRulesTable.category,
          itemName: pricingRulesTable.itemName,
          startingPrice: pricingRulesTable.startingPrice,
        })
        .from(pricingRulesTable)
        .where(
          and(
            eq(pricingRulesTable.workspaceId, partner.workspaceId),
            eq(pricingRulesTable.isActive, true),
          ),
        );
    }
    res.json({ ...partner, assets, pricing });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  "/partners",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const { workspaceId: _ignore, id: _id, assets: _assets, ...data } = req.body ?? {};
      const [partner] = await db
        .insert(partnersTable)
        .values({
          ...data,
          workspaceId: req.workspaceId!,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      res.status(201).json(partner);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.put(
  "/partners/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { workspaceId: _ignore, id: _id, assets, ...data } = req.body ?? {};
      const [partner] = await db
        .update(partnersTable)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(partnersTable.id, id),
            eq(partnersTable.workspaceId, req.workspaceId!),
          ),
        )
        .returning();
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      res.json(partner);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.delete(
  "/partners/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Verify the partner belongs to this workspace before any deletion.
      const [partner] = await db
        .select({ id: partnersTable.id })
        .from(partnersTable)
        .where(
          and(
            eq(partnersTable.id, id),
            eq(partnersTable.workspaceId, req.workspaceId!),
          ),
        );
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      await db
        .delete(partnerAssetsTable)
        .where(
          and(
            eq(partnerAssetsTable.partnerId, id),
            eq(partnerAssetsTable.workspaceId, req.workspaceId!),
          ),
        );
      await db
        .delete(partnersTable)
        .where(
          and(
            eq(partnersTable.id, id),
            eq(partnersTable.workspaceId, req.workspaceId!),
          ),
        );
      res.json({ message: "Partner deleted" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.post(
  "/partners/:id/assets",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const partnerId = parseInt(req.params.id);
      // Ensure the parent partner is in this workspace.
      const [partner] = await db
        .select({ id: partnersTable.id })
        .from(partnersTable)
        .where(
          and(
            eq(partnersTable.id, partnerId),
            eq(partnersTable.workspaceId, req.workspaceId!),
          ),
        );
      if (!partner) return res.status(404).json({ message: "Partner not found" });
      const { workspaceId: _ignore, id: _id, ...data } = req.body ?? {};
      const [asset] = await db
        .insert(partnerAssetsTable)
        .values({
          ...data,
          partnerId,
          workspaceId: req.workspaceId!,
        })
        .returning();
      res.status(201).json(asset);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.delete(
  "/partner-assets/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await db
        .delete(partnerAssetsTable)
        .where(
          and(
            eq(partnerAssetsTable.id, id),
            eq(partnerAssetsTable.workspaceId, req.workspaceId!),
          ),
        )
        .returning();
      if (deleted.length === 0)
        return res.status(404).json({ message: "Asset not found" });
      res.json({ message: "Asset deleted" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

export default router;
