import { Router, type IRouter } from "express";
import { db, mailboxConnectionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  isOutlookConfigured,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  syncInbox,
  getActiveConnections,
  getPrimaryConnection,
} from "../lib/outlook-graph";

const router: IRouter = Router();

router.get("/outlook/status", async (_req, res) => {
  try {
    const configured = isOutlookConfigured();
    const connections = configured ? await getActiveConnections() : [];
    const primary = configured ? await getPrimaryConnection() : null;

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

router.get("/outlook/auth-url", async (_req, res) => {
  try {
    if (!isOutlookConfigured()) {
      return res.status(400).json({ message: "Outlook not configured. Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET." });
    }
    const url = getAuthorizationUrl();
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

    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const existing = await db.select().from(mailboxConnectionsTable)
      .where(eq(mailboxConnectionsTable.emailAddress, tokens.email))
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
      }).where(eq(mailboxConnectionsTable.id, existing[0].id));
    } else {
      const allConns = await db.select().from(mailboxConnectionsTable);
      await db.insert(mailboxConnectionsTable).values({
        provider: "microsoft",
        emailAddress: tokens.email,
        displayName: tokens.displayName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: expiresAt,
        isActive: true,
        isPrimary: allConns.length === 0,
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

router.post("/outlook/connections/:id/sync", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await syncInbox(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/outlook/connections/:id/primary", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(mailboxConnectionsTable).set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(mailboxConnectionsTable.isPrimary, true));
    await db.update(mailboxConnectionsTable).set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(mailboxConnectionsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/outlook/connections/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(mailboxConnectionsTable).set({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/outlook/connections/:id/refresh", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await refreshAccessToken(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
