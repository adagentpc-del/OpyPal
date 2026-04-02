import { Router, type IRouter } from "express";
import { db, templateSetsTable, sequenceTemplatesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/template-sets", async (_req, res) => {
  try {
    const sets = await db.select().from(templateSetsTable).orderBy(templateSetsTable.id);

    const templateCounts = await db.select({
      templateSetId: sequenceTemplatesTable.templateSetId,
      count: sql<number>`count(*)::int`,
    }).from(sequenceTemplatesTable).groupBy(sequenceTemplatesTable.templateSetId);

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
    const [set] = await db.select().from(templateSetsTable).where(eq(templateSetsTable.id, id));
    if (!set) return res.status(404).json({ message: "Template set not found" });

    const templates = await db.select().from(sequenceTemplatesTable)
      .where(eq(sequenceTemplatesTable.templateSetId, id))
      .orderBy(sequenceTemplatesTable.stepNumber);

    res.json({ ...set, templates });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/template-sets", async (req, res) => {
  try {
    const { templates: templateData, ...setData } = req.body;
    const [set] = await db.insert(templateSetsTable).values(setData).returning();

    if (templateData && Array.isArray(templateData)) {
      const templatesWithSetId = templateData.map((t: any) => ({
        ...t,
        templateSetId: set.id,
      }));
      await db.insert(sequenceTemplatesTable).values(templatesWithSetId);
    }

    const templates = await db.select().from(sequenceTemplatesTable)
      .where(eq(sequenceTemplatesTable.templateSetId, set.id))
      .orderBy(sequenceTemplatesTable.stepNumber);

    res.status(201).json({ ...set, stepCount: templates.length, templates });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/template-sets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { templates: templateData, ...setData } = req.body;
    const [set] = await db.update(templateSetsTable)
      .set({ ...setData, updatedAt: new Date() })
      .where(eq(templateSetsTable.id, id))
      .returning();
    if (!set) return res.status(404).json({ message: "Template set not found" });
    res.json(set);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/template-sets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(templateSetsTable).where(eq(templateSetsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/template-sets/:id/templates", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const templates = await db.select().from(sequenceTemplatesTable)
      .where(eq(sequenceTemplatesTable.templateSetId, id))
      .orderBy(sequenceTemplatesTable.stepNumber);
    res.json(templates);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/template-sets/:id/templates", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [template] = await db.insert(sequenceTemplatesTable).values({
      ...req.body,
      templateSetId: id,
    }).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/sequence-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [template] = await db.update(sequenceTemplatesTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(sequenceTemplatesTable.id, id))
      .returning();
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/sequence-templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(sequenceTemplatesTable).where(eq(sequenceTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
