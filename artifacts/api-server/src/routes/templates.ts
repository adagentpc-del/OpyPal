import { Router, type IRouter } from "express";
import { db, templatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/templates", async (req, res) => {
  try {
    const conditions: any[] = [eq(templatesTable.workspaceId, req.workspaceId!)];
    if (req.query.category) conditions.push(eq(templatesTable.category, String(req.query.category)));
    if (req.query.type) conditions.push(eq(templatesTable.type, String(req.query.type)));
    if (req.query.isActive === "true") conditions.push(eq(templatesTable.isActive, true));
    if (req.query.isActive === "false") conditions.push(eq(templatesTable.isActive, false));

    const where = and(...conditions);
    const templates = await db.select().from(templatesTable).where(where).orderBy(templatesTable.id);
    res.json(templates);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/templates", requireRole("operator"), async (req, res) => {
  try {
    const { name, category, type, subject, body, description, linkedAssetIds, linkedTemplateSetId, linkedSequenceId, isActive, audienceTags } = req.body;
    if (!name || !body) return res.status(400).json({ message: "Name and body are required" });
    const [template] = await db.insert(templatesTable).values({
      name, category: category || "Custom", type: type || "custom", subject, body, description,
      linkedAssetIds, linkedTemplateSetId: linkedTemplateSetId || null,
      linkedSequenceId: linkedSequenceId || null,
      isActive: isActive !== undefined ? isActive : true,
      audienceTags: audienceTags || null,
      workspaceId: req.workspaceId!,
    }).returning();
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/templates/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, type, subject, body, description, linkedAssetIds, linkedTemplateSetId, linkedSequenceId, isActive, audienceTags } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (type !== undefined) updates.type = type;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (description !== undefined) updates.description = description;
    if (linkedAssetIds !== undefined) updates.linkedAssetIds = linkedAssetIds;
    if (linkedTemplateSetId !== undefined) updates.linkedTemplateSetId = linkedTemplateSetId;
    if (linkedSequenceId !== undefined) updates.linkedSequenceId = linkedSequenceId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (audienceTags !== undefined) updates.audienceTags = audienceTags;

    const [template] = await db.update(templatesTable)
      .set(updates)
      .where(and(eq(templatesTable.id, id), eq(templatesTable.workspaceId, req.workspaceId!)))
      .returning();

    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/templates/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(templatesTable).where(and(eq(templatesTable.id, id), eq(templatesTable.workspaceId, req.workspaceId!)));
    res.json({ message: "Template deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
