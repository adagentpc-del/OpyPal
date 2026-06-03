import { Router, type IRouter } from "express";
import { db, campaignsTable, contactsTable, campaignSegmentsTable, campaignAssetsTable, campaignSchedulesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

// JSON dates arrive as ISO strings; drizzle timestamp columns expect Date.
function coerceCampaignDates(body: Record<string, any>): Record<string, any> {
  const out = { ...body };
  if (out.startDate !== undefined) out.startDate = out.startDate ? new Date(out.startDate) : null;
  if (out.endDate !== undefined) out.endDate = out.endDate ? new Date(out.endDate) : null;
  return out;
}

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

router.get("/campaigns/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [campaign] = await db.select().from(campaignsTable)
      .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const [segmentCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(campaignSegmentsTable)
      .where(eq(campaignSegmentsTable.campaignId, id));
    const [assetCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(campaignAssetsTable)
      .where(eq(campaignAssetsTable.campaignId, id));
    const [scheduleCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(campaignSchedulesTable)
      .where(eq(campaignSchedulesTable.campaignId, id));

    res.json({
      ...campaign,
      segmentCount: segmentCount?.count || 0,
      assetCount: assetCount?.count || 0,
      scheduleCount: scheduleCount?.count || 0,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/campaigns", requireRole("operator"), async (req, res) => {
  try {
    const { workspaceId: _ignored, contactCount: _cc, ...rest } = req.body ?? {};
    const [campaign] = await db.insert(campaignsTable).values({ ...coerceCampaignDates(rest), workspaceId: req.workspaceId! } as any).returning();
    res.status(201).json({ ...campaign, contactCount: 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/campaigns/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { workspaceId: _ignoredWorkspaceId, contactCount: _cc, segmentCount: _sc, assetCount: _ac, scheduleCount: _schc, ...rest } = req.body ?? {};
    const [campaign] = await db.update(campaignsTable)
      .set({ ...coerceCampaignDates(rest), updatedAt: new Date() } as any)
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
    const id = Number(req.params.id);
    await db.delete(campaignsTable).where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
