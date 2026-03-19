import { Router, type IRouter } from "express";
import { db, assetsTable } from "@workspace/db";
import { eq, ilike, and, or } from "drizzle-orm";
import {
  GetAssetsQueryParams,
  CreateAssetBody,
  UpdateAssetParams,
  UpdateAssetBody,
  DeleteAssetParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/assets", async (req, res) => {
  try {
    const query = GetAssetsQueryParams.parse(req.query);
    const conditions: any[] = [];

    if (query.category) conditions.push(eq(assetsTable.category, query.category));
    if (query.search) {
      const searchTerm = `%${query.search}%`;
      conditions.push(
        or(
          ilike(assetsTable.title, searchTerm),
          ilike(assetsTable.description, searchTerm)
        )
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const assets = await db.select().from(assetsTable).where(where).orderBy(assetsTable.id);
    res.json(assets);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/assets", async (req, res) => {
  try {
    const data = CreateAssetBody.parse(req.body);
    const [asset] = await db.insert(assetsTable).values(data).returning();
    res.status(201).json(asset);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/assets/:id", async (req, res) => {
  try {
    const { id } = UpdateAssetParams.parse({ id: req.params.id });
    const data = UpdateAssetBody.parse(req.body);
    const [asset] = await db.update(assetsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(assetsTable.id, id))
      .returning();

    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/assets/:id", async (req, res) => {
  try {
    const { id } = DeleteAssetParams.parse({ id: req.params.id });
    await db.delete(assetsTable).where(eq(assetsTable.id, id));
    res.json({ message: "Asset deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
