import { Router, type IRouter } from "express";
import { db, campaignsTable, contactsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/campaigns", async (_req, res) => {
  try {
    const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.id);

    const counts = await db.select({
      campaignName: contactsTable.campaignName,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).groupBy(contactsTable.campaignName);

    const countMap = Object.fromEntries(counts.map(c => [c.campaignName, c.count]));

    const result = campaigns.map(c => ({
      ...c,
      contactCount: countMap[c.name] || 0,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/campaigns", async (req, res) => {
  try {
    const [campaign] = await db.insert(campaignsTable).values(req.body).returning();
    res.status(201).json({ ...campaign, contactCount: 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.update(campaignsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(campaignsTable.id, id))
      .returning();
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
