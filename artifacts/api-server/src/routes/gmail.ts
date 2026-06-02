import { Router, type IRouter } from "express";
import { db, mailboxConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  isGmailConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  syncGmailInbox,
  getActiveGmailConnections,
  getPrimaryGmailConnection,
  GMAIL_PROVIDER,
} from "../lib/gmail-api";
import { requireAuth, resolveWorkspace, requireRole, isPublicMixedRoutePath } from "../middleware/clerk-auth";
import { writeAudit } from "../lib/audit";
import { signState, verifyState } from "../lib/oauth-state";

const router: IRouter = Router();

// Public callback (no x-workspace-id during the OAuth redirect); every other
// route requires auth + workspace resolution.
router.use((req, res, next) => {
  if (isPublicMixedRoutePath(req.path)) return next();
  requireAuth(req, res, (authErr?: any) => {
    if (authErr) return next(authErr);
    resolveWorkspace(req, res, next);
  });
});

async function getOwnedConnection(id: number, workspaceId: number) {
  const [conn] = await db.select({ id: mailboxConnectionsTable.id, emailAddress: mailboxConnectionsTable.emailAddress })
    .from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.id, id),
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
    ))
    .limit(1);
  return conn || null;
}

router.get("/gmail/status", requireRole("manager"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const configured = isGmailConfigured();
    const connections = configured ? await getActiveGmailConnections(ws) : [];
    const primary = configured ? await getPrimaryGmailConnection(ws) : null;

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

router.get("/gmail/auth-url", requireRole("workspace_admin"), async (req, res) => {
  try {
    if (!isGmailConfigured()) {
      return res.status(400).json({ message: "Gmail not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET." });
    }
    const url = getAuthorizationUrl(signState(req.workspaceId!));
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/gmail/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ message: "Authorization code missing" });

    const ws = verifyState(req.query.state as string);
    if (!ws) return res.status(400).json({ message: "Invalid or expired OAuth state" });

    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const existing = await db.select().from(mailboxConnectionsTable)
      .where(and(
        eq(mailboxConnectionsTable.workspaceId, ws),
        eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
        eq(mailboxConnectionsTable.emailAddress, tokens.email),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(mailboxConnectionsTable).set({
        accessToken: tokens.accessToken,
        // Keep the existing refresh token if Google didn't return a new one.
        refreshToken: tokens.refreshToken || existing[0].refreshToken,
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
      const gmailConns = await db.select({ id: mailboxConnectionsTable.id }).from(mailboxConnectionsTable)
        .where(and(
          eq(mailboxConnectionsTable.workspaceId, ws),
          eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
        ));
      await db.insert(mailboxConnectionsTable).values({
        provider: GMAIL_PROVIDER,
        emailAddress: tokens.email,
        displayName: tokens.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        isActive: true,
        isPrimary: gmailConns.length === 0,
        workspaceId: ws,
      });
    }

    await writeAudit({
      workspaceId: ws,
      type: "provider_connected",
      description: `Gmail mailbox connected: ${tokens.email}`,
      createdBy: "gmail-oauth",
      metadata: { provider: "gmail", emailAddress: tokens.email },
    });

    const redirectUrl = process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL}/a3-sales-os/providers?gmail=connected`
      : `/a3-sales-os/providers?gmail=connected`;
    res.redirect(redirectUrl);
  } catch (err: any) {
    console.error("[Gmail] OAuth callback error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/gmail/connections/:id/sync", requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await getOwnedConnection(id, req.workspaceId!))) return res.status(404).json({ message: "Connection not found" });
    const result = await syncGmailInbox(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/gmail/connections/:id/primary", requireRole("workspace_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ws = req.workspaceId!;
    const conn = await getOwnedConnection(id, ws);
    if (!conn) return res.status(404).json({ message: "Connection not found" });
    await db.update(mailboxConnectionsTable).set({ isPrimary: false, updatedAt: new Date() })
      .where(and(
        eq(mailboxConnectionsTable.isPrimary, true),
        eq(mailboxConnectionsTable.workspaceId, ws),
        eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
      ));
    await db.update(mailboxConnectionsTable).set({ isPrimary: true, updatedAt: new Date() })
      .where(and(eq(mailboxConnectionsTable.id, id), eq(mailboxConnectionsTable.workspaceId, ws)));
    await writeAudit({
      workspaceId: ws,
      type: "provider_primary_changed",
      description: `Gmail primary mailbox set to ${conn.emailAddress}`,
      createdBy: req.authContext?.email ?? null,
      metadata: { provider: "gmail", connectionId: id, emailAddress: conn.emailAddress },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/gmail/connections/:id", requireRole("workspace_admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ws = req.workspaceId!;
    const conn = await getOwnedConnection(id, ws);
    if (!conn) return res.status(404).json({ message: "Connection not found" });
    await db.update(mailboxConnectionsTable).set({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      updatedAt: new Date(),
    }).where(and(eq(mailboxConnectionsTable.id, id), eq(mailboxConnectionsTable.workspaceId, ws)));
    await writeAudit({
      workspaceId: ws,
      type: "provider_disconnected",
      description: `Gmail mailbox disconnected: ${conn.emailAddress}`,
      createdBy: req.authContext?.email ?? null,
      metadata: { provider: "gmail", connectionId: id, emailAddress: conn.emailAddress },
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/gmail/connections/:id/refresh", requireRole("manager"), async (req, res) => {
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
