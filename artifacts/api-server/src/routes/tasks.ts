import { Router, type IRouter } from "express";
import { db, tasksTable, leadsTable, activityTable } from "@workspace/db";
import { eq, and, lte, gte, lt, sql } from "drizzle-orm";
import {
  GetTasksQueryParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  CompleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tasks", async (req, res) => {
  try {
    const query = GetTasksQueryParams.parse(req.query);
    const conditions: any[] = [];

    if (query.leadId) conditions.push(eq(tasksTable.leadId, query.leadId));
    if (query.status) conditions.push(eq(tasksTable.status, query.status));

    const today = new Date().toISOString().split("T")[0];
    if (query.dueFilter === "today") {
      conditions.push(eq(tasksTable.dueDate, today));
    } else if (query.dueFilter === "overdue") {
      conditions.push(lt(tasksTable.dueDate, today));
      conditions.push(sql`${tasksTable.status} != 'completed'`);
    } else if (query.dueFilter === "next7days") {
      const next7 = new Date();
      next7.setDate(next7.getDate() + 7);
      const next7Str = next7.toISOString().split("T")[0];
      conditions.push(gte(tasksTable.dueDate, today));
      conditions.push(lte(tasksTable.dueDate, next7Str));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const tasks = await db
      .select({
        id: tasksTable.id,
        leadId: tasksTable.leadId,
        taskType: tasksTable.taskType,
        dueDate: tasksTable.dueDate,
        status: tasksTable.status,
        notes: tasksTable.notes,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        leadCompanyName: leadsTable.companyName,
        leadContactName: leadsTable.contactName,
      })
      .from(tasksTable)
      .leftJoin(leadsTable, eq(tasksTable.leadId, leadsTable.id))
      .where(where)
      .orderBy(tasksTable.dueDate);

    res.json(tasks);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/tasks", async (req, res) => {
  try {
    const data = CreateTaskBody.parse(req.body);
    const [task] = await db.insert(tasksTable).values(data).returning();

    if (task.leadId) {
      const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, task.leadId));
      if (lead) {
        await db.insert(activityTable).values({
          type: "task_created",
          description: `Task "${task.taskType}" created for ${lead.companyName}`,
          leadId: lead.id,
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
    const { id } = UpdateTaskParams.parse({ id: req.params.id });
    const data = UpdateTaskBody.parse(req.body);
    const [task] = await db.update(tasksTable)
      .set({ ...data, updatedAt: new Date() })
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
    const { id } = DeleteTaskParams.parse({ id: req.params.id });
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ message: "Task deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/tasks/:id/complete", async (req, res) => {
  try {
    const { id } = CompleteTaskParams.parse({ id: req.params.id });
    const [task] = await db.update(tasksTable)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(tasksTable.id, id))
      .returning();

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.leadId) {
      const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, task.leadId));
      if (lead) {
        await db.insert(activityTable).values({
          type: "task_completed",
          description: `Task "${task.taskType}" completed for ${lead.companyName}`,
          leadId: lead.id,
        });
      }
    }

    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
