import { Router, type IRouter } from "express";
import { db, tasksTable, leadsTable, activityTable } from "@workspace/db";
import { eq, and, lte, gte, lt, sql, desc, inArray } from "drizzle-orm";
import { getAutoTaskSettings, updateAutoTaskSettings } from "../lib/smart-followup-engine";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const conditions: any[] = [];

    if (req.query.leadId) conditions.push(eq(tasksTable.leadId, Number(req.query.leadId)));
    if (req.query.status) conditions.push(eq(tasksTable.status, String(req.query.status)));
    if (req.query.priority) conditions.push(eq(tasksTable.priority, String(req.query.priority)));
    if (req.query.source) conditions.push(eq(tasksTable.source, String(req.query.source)));
    if (req.query.taskType) conditions.push(eq(tasksTable.taskType, String(req.query.taskType)));
    if (req.query.ownerId) conditions.push(eq(tasksTable.ownerId, String(req.query.ownerId)));

    const today = new Date().toISOString().split("T")[0];
    const dueFilter = String(req.query.dueFilter || "");
    if (dueFilter === "today") {
      conditions.push(eq(tasksTable.dueDate, today));
    } else if (dueFilter === "overdue") {
      conditions.push(lt(tasksTable.dueDate, today));
      conditions.push(sql`${tasksTable.status} NOT IN ('completed', 'dismissed')`);
    } else if (dueFilter === "next7days") {
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split("T")[0];
      conditions.push(gte(tasksTable.dueDate, today));
      conditions.push(lte(tasksTable.dueDate, next7Str));
    }

    if (req.query.excludeCompleted === "true") {
      conditions.push(sql`${tasksTable.status} NOT IN ('completed', 'dismissed')`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const tasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        leadId: tasksTable.leadId,
        contactId: tasksTable.contactId,
        campaignId: tasksTable.campaignId,
        sequenceId: tasksTable.sequenceId,
        taskType: tasksTable.taskType,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        status: tasksTable.status,
        notes: tasksTable.notes,
        source: tasksTable.source,
        createdBy: tasksTable.createdBy,
        ownerId: tasksTable.ownerId,
        reminderAt: tasksTable.reminderAt,
        completedAt: tasksTable.completedAt,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        leadCompanyName: leadsTable.companyName,
        leadContactName: leadsTable.contactName,
      })
      .from(tasksTable)
      .leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id))
      .where(where)
      .orderBy(desc(tasksTable.createdAt))
      .limit(Number(req.query.limit) || 200);

    res.json(tasks);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/tasks/summary", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [openResult] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable)
      .where(inArray(tasksTable.status, ["open", "in_progress"]));
    const [dueTodayResult] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable)
      .where(and(eq(tasksTable.dueDate, today), sql`${tasksTable.status} NOT IN ('completed', 'dismissed')`));
    const [overdueResult] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable)
      .where(and(lt(tasksTable.dueDate, today), sql`${tasksTable.status} NOT IN ('completed', 'dismissed')`));
    const [urgentResult] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable)
      .where(and(inArray(tasksTable.priority, ["high", "urgent"]), sql`${tasksTable.status} NOT IN ('completed', 'dismissed')`));

    res.json({
      open: openResult?.count || 0,
      dueToday: dueTodayResult?.count || 0,
      overdue: overdueResult?.count || 0,
      urgent: urgentResult?.count || 0,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/tasks/auto-rules", async (_req, res) => {
  try {
    res.json(getAutoTaskSettings());
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/tasks/auto-rules", async (req, res) => {
  try {
    updateAutoTaskSettings(req.body);
    res.json(getAutoTaskSettings());
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const data = req.body;
    const [task] = await db.insert(tasksTable).values({
      title: data.title || null,
      leadId: data.leadId || null,
      contactId: data.contactId || null,
      campaignId: data.campaignId || null,
      sequenceId: data.sequenceId || null,
      taskType: data.taskType || "custom",
      priority: data.priority || "medium",
      status: data.status || "open",
      dueDate: data.dueDate || null,
      reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      ownerId: data.ownerId || null,
      notes: data.notes || null,
      source: data.source || "user",
      createdBy: data.createdBy || "user",
    }).returning();

    if (task.leadId) {
      const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, task.leadId));
      if (lead) {
        await db.insert(activityTable).values({
          type: "task_created",
          description: `Task "${task.title || task.taskType}" created for ${lead.companyName}`,
          leadId: lead.id,
          createdBy: task.source === "system" ? "system" : undefined,
        });
      }
    }

    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body;
    const updates: any = { updatedAt: new Date() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.leadId !== undefined) updates.leadId = data.leadId || null;
    if (data.contactId !== undefined) updates.contactId = data.contactId || null;
    if (data.campaignId !== undefined) updates.campaignId = data.campaignId || null;
    if (data.sequenceId !== undefined) updates.sequenceId = data.sequenceId || null;
    if (data.taskType !== undefined) updates.taskType = data.taskType;
    if (data.priority !== undefined) updates.priority = data.priority;
    if (data.status !== undefined) updates.status = data.status;
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate || null;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.ownerId !== undefined) updates.ownerId = data.ownerId;
    if (data.reminderAt !== undefined) updates.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;

    const [task] = await db.update(tasksTable)
      .set(updates)
      .where(eq(tasksTable.id, id))
      .returning();

    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ message: "Task deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tasks/:id/complete", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [task] = await db.update(tasksTable)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.leadId) {
      const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, task.leadId));
      if (lead) {
        await db.insert(activityTable).values({
          type: "task_completed",
          description: `Task "${task.title || task.taskType}" completed for ${lead.companyName}`,
          leadId: lead.id,
        });
      }
    }

    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tasks/:id/dismiss", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [task] = await db.update(tasksTable)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
