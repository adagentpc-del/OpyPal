import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, campaignAssetsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, resolveWorkspace, requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Inline request schema — the project forbids editing lib/api-spec and
// lib/api-zod, so storage validation is defined locally here instead of via
// generated schemas.
const RequestUploadUrlBody = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative().optional(),
  contentType: z.string().optional(),
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. Requires an authenticated operator
 * (or above) within a workspace. The client sends JSON metadata only — NOT the
 * file — then uploads the file directly to the returned presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  resolveWorkspace,
  requireRole("operator"),
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS. Unconditionally public.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve uploaded object entities from PRIVATE_OBJECT_DIR. Requires an
 * authenticated user who is a member of the workspace that owns the campaign
 * asset referencing this object (super admins may access any). The object must
 * be registered as a campaign asset; unreferenced objects are not served. This
 * enforces workspace isolation even though browsers request these URLs via
 * <img>/<a> tags (cookie auth flows automatically; no x-workspace-id header is
 * required because the workspace is derived from the asset record).
 */
router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const ctx = req.authContext!;
    const [asset] = await db
      .select({ workspaceId: campaignAssetsTable.workspaceId })
      .from(campaignAssetsTable)
      .where(eq(campaignAssetsTable.objectPath, objectPath))
      .limit(1);
    if (!asset) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (!ctx.isSuperAdmin && !ctx.memberships.some((m) => m.workspaceId === asset.workspaceId)) {
      res.status(403).json({ error: "You do not have access to this object" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
