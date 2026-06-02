import { Router, type IRouter } from "express";
import { db, notificationsTable, leadsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  try {
    const conditions: any[] = [eq(notificationsTable.workspaceId, req.workspaceId!)];
    if (req.query.unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
    if (req.query.priority) conditions.push(eq(notificationsTable.priority, String(req.query.priority)));
    if (req.query.severity) conditions.push(eq(notificationsTable.severity, String(req.query.severity)));
    if (req.query.type) conditions.push(eq(notificationsTable.type, String(req.query.type)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const notifications = await db
      .select({
        id: notificationsTable.id,
        type: notificationsTable.type,
        title: notificationsTable.title,
        description: notificationsTable.description,
        severity: notificationsTable.severity,
        leadId: notificationsTable.leadId,
        contactId: notificationsTable.contactId,
        campaignId: notificationsTable.campaignId,
        taskId: notificationsTable.taskId,
        metadata: notificationsTable.metadata,
        priority: notificationsTable.priority,
        isRead: notificationsTable.isRead,
        createdAt: notificationsTable.createdAt,
        leadCompanyName: leadsTable.companyName,
        leadContactName: leadsTable.contactName,
      })
      .from(notificationsTable)
      .leftJoin(leadsTable, eq(notificationsTable.leadId, leadsTable.id))
      .where(where)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(Number(req.query.limit) || 50);

    res.json(notifications);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  try {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(notificationsTable)
      .where(and(eq(notificationsTable.workspaceId, req.workspaceId!), eq(notificationsTable.isRead, false)));
    res.json({ count: result[0]?.count || 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/notifications/:id/read", requireRole("operator"), async (req, res) => {
  try {
    const [n] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.workspaceId, req.workspaceId!)))
      .returning();
    res.json(n);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/notifications/mark-all-read", requireRole("operator"), async (req, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(and(eq(notificationsTable.workspaceId, req.workspaceId!), eq(notificationsTable.isRead, false)));
    res.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/notifications/:id", requireRole("manager"), async (req, res) => {
  try {
    await db.delete(notificationsTable).where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.workspaceId, req.workspaceId!)));
    res.json({ message: "Notification deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
