import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  try {
    const conditions: any[] = [];
    if (req.query.unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
    if (req.query.priority) conditions.push(eq(notificationsTable.priority, String(req.query.priority)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const notifications = await db.select().from(notificationsTable)
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
      .where(eq(notificationsTable.isRead, false));
    res.json({ count: result[0]?.count || 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const [n] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, Number(req.params.id)))
      .returning();
    res.json(n);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.isRead, false));
    res.json({ message: "All notifications marked as read" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    await db.delete(notificationsTable).where(eq(notificationsTable.id, Number(req.params.id)));
    res.json({ message: "Notification deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
