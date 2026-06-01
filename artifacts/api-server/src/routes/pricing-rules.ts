import { Router } from "express";
import { requireAuth, resolveWorkspace, requireRole } from "../middleware/clerk-auth";
import { db, pricingRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get(
  "/pricing-rules",
  requireAuth,
  resolveWorkspace,
  requireRole("viewer"),
  async (req, res) => {
    try {
      const rules = await db
        .select()
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.workspaceId, req.workspaceId!))
        .orderBy(pricingRulesTable.category, pricingRulesTable.itemName);
      res.json(rules);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.post(
  "/pricing-rules",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const { workspaceId: _ignore, id: _id, ...data } = req.body ?? {};
      const [rule] = await db
        .insert(pricingRulesTable)
        .values({
          ...data,
          workspaceId: req.workspaceId!,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      res.status(201).json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.put(
  "/pricing-rules/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { workspaceId: _ignore, id: _id, ...data } = req.body ?? {};
      const [rule] = await db
        .update(pricingRulesTable)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(pricingRulesTable.id, id),
            eq(pricingRulesTable.workspaceId, req.workspaceId!),
          ),
        )
        .returning();
      if (!rule) return res.status(404).json({ message: "Pricing rule not found" });
      res.json(rule);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

router.delete(
  "/pricing-rules/:id",
  requireAuth,
  resolveWorkspace,
  requireRole("manager"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await db
        .delete(pricingRulesTable)
        .where(
          and(
            eq(pricingRulesTable.id, id),
            eq(pricingRulesTable.workspaceId, req.workspaceId!),
          ),
        )
        .returning();
      if (deleted.length === 0)
        return res.status(404).json({ message: "Pricing rule not found" });
      res.json({ message: "Pricing rule deleted" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  },
);

export default router;
