import { Router, type IRouter } from "express";
import { db, campaignsTable, contactsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await db.select().from(campaignsTable)
      .where(eq(campaignsTable.workspaceId, req.workspaceId!))
      .orderBy(campaignsTable.id);

    const counts = await db.select({
      campaignName: contactsTable.campaignName,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable)
      .where(eq(contactsTable.workspaceId, req.workspaceId!))
      .groupBy(contactsTable.campaignName);

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

router.post("/campaigns", requireRole("operator"), async (req, res) => {
  try {
    const [campaign] = await db.insert(campaignsTable).values({ ...req.body, workspaceId: req.workspaceId! }).returning();
    res.status(201).json({ ...campaign, contactCount: 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/campaigns/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { workspaceId: _ignoredWorkspaceId, ...rest } = req.body ?? {};
    const [campaign] = await db.update(campaignsTable)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.workspaceId!)))
      .returning();
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/campaigns/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
