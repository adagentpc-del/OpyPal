import { Router, type IRouter } from "express";
import { db, templateSetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/template-sets", async (_req, res) => {
  try {
    const sets = await db.select().from(templateSetsTable).orderBy(templateSetsTable.id);
    const result = sets.map(s => ({ ...s, stepCount: 7 }));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/template-sets", async (req, res) => {
  try {
    const [set] = await db.insert(templateSetsTable).values(req.body).returning();
    res.status(201).json({ ...set, stepCount: 7 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/template-sets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [set] = await db.update(templateSetsTable)
      .set({ ...req.body, updatedAt: new Date() })
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

export default router;
