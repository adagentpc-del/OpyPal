import { Router, type IRouter } from "express";
import { db, mailboxConnectionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  isOutlookConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  syncInbox,
  getActiveConnections,
  getPrimaryConnection,
} from "../lib/outlook-graph";
import { requireAuth, resolveWorkspace, requireRole, isPublicMixedRoutePath } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.use((req, res, next) => {
  if (isPublicMixedRoutePath(req.path)) return next();
  requireAuth(req, res, (authErr?: any) => {
    if (authErr) return next(authErr);
    resolveWorkspace(req, res, next);
  });
});

async function getOwnedConnection(id: number, workspaceId: number) {
  const [conn] = await db.select({ id: mailboxConnectionsTable.id })
    .from(mailboxConnectionsTable)
    .where(and(eq(mailboxConnectionsTable.id, id), eq(mailboxConnectionsTable.workspaceId, workspaceId)))
    .limit(1);
  return conn || null;
}

router.get("/outlook/status", async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const configured = isOutlookConfigured();
    const connections = configured ? await getActiveConnections(ws) : [];
    const primary = configured ? await getPrimaryConnection(ws) : null;

    res.json({
      configured,
      connectionCount: connections.length,
      primaryEmail: primary?.emailAddress || null,
      connections: connections.map(c => ({
        id: c.id,
        emailAddress: c.emailAddress,
        displayName: c.displayName,
        isPrimary: c.isPrimary,
        isActive: c.isActive,
        lastSyncedAt: c.lastSyncedAt,
        syncError: c.syncError,
        tokenExpiresAt: c.tokenExpiresAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/outlook/auth-url", requireRole("manager"), async (req, res) => {
  try {
    if (!isOutlookConfigured()) {
      return res.status(400).json({ message: "Outlook not configured. Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET." });
    }
    const url = getAuthorizationUrl(String(req.workspaceId!));
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/outlook/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).json({ message: "Authorization code missing" });
    }

    const stateRaw = (req.query.state as string) || "";
    const parsedWs = parseInt(stateRaw, 10);
    const ws = Number.isFinite(parsedWs) && parsedWs > 0 ? parsedWs : 1;

    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const existing = await db.select().from(mailboxConnectionsTable)
      .where(and(
        eq(mailboxConnectionsTable.workspaceId, ws),
        eq(mailboxConnectionsTable.emailAddress, tokens.email),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(mailboxConnectionsTable).set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        displayName: tokens.displayName,
        isActive: true,
        syncError: null,
        updatedAt: new Date(),
      }).where(and(
        eq(mailboxConnectionsTable.id, existing[0].id),
        eq(mailboxConnectionsTable.workspaceId, ws),
      ));
    } else {
      const allConns = await db.select({ id: mailboxConnectionsTable.id }).from(mailboxConnectionsTable)
        .where(eq(mailboxConnectionsTable.workspaceId, ws));
      await db.insert(mailboxConnectionsTable).values({
        provider: "microsoft",
        emailAddress: tokens.email,
        displayName: tokens.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        isActive: true,
        isPrimary: allConns.length === 0,
        workspaceId: ws,
      });
    }

    const redirectUrl = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL}/a3-sales-os/settings?outlook=connected`
      : `/a3-sales-os/settings?outlook=connected`;

    res.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[Outlook] OAuth callback error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/outlook/connections/:id/sync", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await getOwnedConnection(id, req.workspaceId!))) return res.status(404).json({ message: "Connection not found" });
    const result = await syncInbox(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/outlook/connections/:id/primary", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ws = req.workspaceId!;
    if (!(await getOwnedConnection(id, ws))) return res.status(404).json({ message: "Connection not found" });
    await db.update(mailboxConnectionsTable).set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(mailboxConnectionsTable.isPrimary, true), eq(mailboxConnectionsTable.workspaceId, ws)));
    await db.update(mailboxConnectionsTable).set({ isPrimary: true, updatedAt: new Date() })
      .where(and(eq(mailboxConnectionsTable.id, id), eq(mailboxConnectionsTable.workspaceId, ws)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/outlook/connections/:id", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ws = req.workspaceId!;
    if (!(await getOwnedConnection(id, ws))) return res.status(404).json({ message: "Connection not found" });
    await db.update(mailboxConnectionsTable).set({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      updatedAt: new Date(),
    }).where(and(eq(mailboxConnectionsTable.id, id), eq(mailboxConnectionsTable.workspaceId, ws)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/outlook/connections/:id/refresh", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await getOwnedConnection(id, req.workspaceId!))) return res.status(404).json({ message: "Connection not found" });
    await refreshAccessToken(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
