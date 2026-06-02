import { Router, type IRouter } from "express";
import { db, templateSetsTable, sequenceTemplatesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/template-sets", async (req, res) => {
  try {
    const sets = await db.select().from(templateSetsTable)
      .where(eq(templateSetsTable.workspaceId, req.workspaceId!))
      .orderBy(templateSetsTable.id);

    const templateCounts = await db.select({
      templateSetId: sequenceTemplatesTable.templateSetId,
      count: sql<number>`count(*)::int`,
    }).from(sequenceTemplatesTable)
      .where(eq(sequenceTemplatesTable.workspaceId, req.workspaceId!))
      .groupBy(sequenceTemplatesTable.templateSetId);

    const countMap = Object.fromEntries(templateCounts.map(tc => [tc.templateSetId, tc.count]));
    const result = sets.map(s => ({ ...s, stepCount: countMap[s.id] || 0 }));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/template-sets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.select().from(templateSetsTable)
      .where(and(eq(templateSetsTable.id, id), eq(templateSetsTable.workspaceId, req.workspaceId!)));
    if (!set) return res.status(404).json({ message: "Template set not found" });

    const templates = await db.select().from(sequenceTemplatesTable)
      .where(and(eq(sequenceTemplatesTable.templateSetId, id), eq(sequenceTemplatesTable.workspaceId, req.workspaceId!)))
      .orderBy(sequenceTemplatesTable.stepNumber);

    res.json({ ...set, templates });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/template-sets", requireRole("operator"), async (req, res) => {
  try {
    const { templates: templateData, ...setData } = req.body;
    const [set] = await db.insert(templateSetsTable).values({
      ...setData,
      workspaceId: req.workspaceId!,
    }).returning();

    if (templateData && Array.isArray(templateData)) {
      const templatesWithSetId = templateData.map((t: any) => ({
        ...t,
        templateSetId: set.id,
        workspaceId: req.workspaceId!,
      }));
      await db.insert(sequenceTemplatesTable).values(templatesWithSetId);
    }

    const templates = await db.select().from(sequenceTemplatesTable)
      .where(and(eq(sequenceTemplatesTable.templateSetId, set.id), eq(sequenceTemplatesTable.workspaceId, req.workspaceId!)))
      .orderBy(sequenceTemplatesTable.stepNumber);

    res.status(201).json({ ...set, stepCount: templates.length, templates });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/template-sets/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { templates: templateData, workspaceId: _ignoredWorkspaceId, ...setData } = req.body;
    const [set] = await db.update(templateSetsTable)
      .set({ ...setData, updatedAt: new Date() })
      .where(and(eq(templateSetsTable.id, id), eq(templateSetsTable.workspaceId, req.workspaceId!)))
      .returning();
    if (!set) return res.status(404).json({ message: "Template set not found" });
    res.json(set);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/template-sets/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(templateSetsTable).where(and(eq(templateSetsTable.id, id), eq(templateSetsTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/template-sets/:id/templates", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const templates = await db.select().from(sequenceTemplatesTable)
      .where(and(eq(sequenceTemplatesTable.templateSetId, id), eq(sequenceTemplatesTable.workspaceId, req.workspaceId!)))
      .orderBy(sequenceTemplatesTable.stepNumber);
    res.json(templates);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/template-sets/:id/templates", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [template] = await db.insert(sequenceTemplatesTable).values({
      ...req.body,
      templateSetId: id,
      workspaceId: req.workspaceId!,
    }).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/sequence-templates/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { workspaceId: _ignoredWorkspaceId, ...rest } = req.body;
    const [template] = await db.update(sequenceTemplatesTable)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(sequenceTemplatesTable.id, id), eq(sequenceTemplatesTable.workspaceId, req.workspaceId!)))
      .returning();
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/sequence-templates/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(sequenceTemplatesTable).where(and(eq(sequenceTemplatesTable.id, id), eq(sequenceTemplatesTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
