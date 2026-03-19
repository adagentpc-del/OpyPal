import { Router, type IRouter } from "express";
import { db, templatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetTemplatesQueryParams,
  CreateTemplateBody,
  UpdateTemplateParams,
  UpdateTemplateBody,
  DeleteTemplateParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/templates", async (req, res) => {
  try {
    const query = GetTemplatesQueryParams.parse(req.query);
    const conditions: any[] = [];

    if (query.category) conditions.push(eq(templatesTable.category, query.category));

    const templates = conditions.length > 0
      ? await db.select().from(templatesTable).where(conditions[0]).orderBy(templatesTable.id)
      : await db.select().from(templatesTable).orderBy(templatesTable.id);

    res.json(templates);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const data = CreateTemplateBody.parse(req.body);
    const [template] = await db.insert(templatesTable).values(data).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/templates/:id", async (req, res) => {
  try {
    const { id } = UpdateTemplateParams.parse({ id: req.params.id });
    const data = UpdateTemplateBody.parse(req.body);
    const [template] = await db.update(templatesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templatesTable.id, id))
      .returning();

    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    const { id } = DeleteTemplateParams.parse({ id: req.params.id });
    await db.delete(templatesTable).where(eq(templatesTable.id, id));
    res.json({ message: "Template deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
