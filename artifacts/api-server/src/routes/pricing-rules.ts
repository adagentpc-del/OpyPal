import { Router } from "express";
import { requireAuth } from "../middleware/clerk-auth";
import { db, pricingRulesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/pricing-rules", requireAuth, async (_req, res) => {
  try {
    const rules = await db.select().from(pricingRulesTable).orderBy(pricingRulesTable.category, pricingRulesTable.itemName);
    res.json(rules);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/pricing-rules", requireAuth, async (req, res) => {
  try {
    const [rule] = await db.insert(pricingRulesTable).values({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/pricing-rules/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rule] = await db.update(pricingRulesTable).set({ ...req.body, updatedAt: new Date() }).where(eq(pricingRulesTable.id, id)).returning();
    if (!rule) return res.status(404).json({ message: "Pricing rule not found" });
    res.json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/pricing-rules/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(pricingRulesTable).where(eq(pricingRulesTable.id, id));
    res.json({ message: "Pricing rule deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
