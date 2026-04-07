import { Router } from "express";
import { db, partnersTable, partnerAssetsTable, pricingRulesTable, partnerRequestsTable, requestItemsTable, requestUploadsTable, adminNotesTable } from "@workspace/db";
import { eq, desc, and, ilike, sql } from "drizzle-orm";

const router = Router();

router.get("/partners", async (req, res) => {
  try {
    const partners = await db.select().from(partnersTable).orderBy(desc(partnersTable.createdAt));
    res.json(partners);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/partners/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.id, id));
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    const assets = await db.select().from(partnerAssetsTable).where(eq(partnerAssetsTable.partnerId, id));
    res.json({ ...partner, assets });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/partners/slug/:slug", async (req, res) => {
  try {
    const [partner] = await db.select().from(partnersTable).where(eq(partnersTable.slug, req.params.slug));
    if (!partner || !partner.isActive) return res.status(404).json({ message: "Partner not found" });
    const assets = await db.select().from(partnerAssetsTable).where(eq(partnerAssetsTable.partnerId, partner.id));
    let pricing: any[] = [];
    if (partner.pricingDisplayEnabled) {
      pricing = await db.select({
        id: pricingRulesTable.id,
        category: pricingRulesTable.category,
        itemName: pricingRulesTable.itemName,
        startingPrice: pricingRulesTable.startingPrice,
      }).from(pricingRulesTable).where(eq(pricingRulesTable.isActive, true));
    }
    res.json({ ...partner, assets, pricing });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/partners", async (req, res) => {
  try {
    const [partner] = await db.insert(partnersTable).values({
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    res.status(201).json(partner);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/partners/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { assets, ...data } = req.body;
    const [partner] = await db.update(partnersTable).set({ ...data, updatedAt: new Date() }).where(eq(partnersTable.id, id)).returning();
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/partners/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(partnerAssetsTable).where(eq(partnerAssetsTable.partnerId, id));
    await db.delete(partnersTable).where(eq(partnersTable.id, id));
    res.json({ message: "Partner deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/partners/:id/assets", async (req, res) => {
  try {
    const partnerId = parseInt(req.params.id);
    const [asset] = await db.insert(partnerAssetsTable).values({
      ...req.body,
      partnerId,
    }).returning();
    res.status(201).json(asset);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/partner-assets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(partnerAssetsTable).where(eq(partnerAssetsTable.id, id));
    res.json({ message: "Asset deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
