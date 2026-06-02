import { Router, type IRouter } from "express";
import { db, workspacesTable } from "@workspace/db";
import type { ProviderType, WorkspaceSenderIdentity } from "@workspace/db";
import { and, ne, sql } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";
import { getProviderHealth, getSenderIdentity, saveSenderIdentity, OUTBOUND_PROVIDERS } from "../lib/providers";
import { writeAudit } from "../lib/audit";

// Unified provider config surface for a workspace. Mounted in the scoped router
// group (requireAuth + resolveWorkspace already applied), so every handler has a
// validated req.workspaceId. Viewing requires manager; editing requires
// workspace_admin (super_admin passes both via requireRole).
const router: IRouter = Router();

const VALID_PROVIDERS: ProviderType[] = [...OUTBOUND_PROVIDERS, "forwarding"];

router.get("/providers/status", requireRole("manager"), async (req, res) => {
  try {
    const health = await getProviderHealth(req.workspaceId!);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/providers/sender-identity", requireRole("manager"), async (req, res) => {
  try {
    const identity = await getSenderIdentity(req.workspaceId!);
    res.json(identity);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/providers/sender-identity", requireRole("workspace_admin"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const body = req.body || {};
    const patch: Partial<WorkspaceSenderIdentity> = {};

    if (body.fromName !== undefined) patch.fromName = String(body.fromName);
    if (body.fromEmail !== undefined) patch.fromEmail = String(body.fromEmail);
    if (body.replyToEmail !== undefined) patch.replyToEmail = String(body.replyToEmail);
    if (body.signature !== undefined) patch.signature = String(body.signature);

    if (body.defaultProvider !== undefined) {
      if (body.defaultProvider && !VALID_PROVIDERS.includes(body.defaultProvider)) {
        return res.status(400).json({ message: `Invalid defaultProvider: ${body.defaultProvider}` });
      }
      patch.defaultProvider = body.defaultProvider || undefined;
    }

    if (body.providerPriority !== undefined) {
      if (!Array.isArray(body.providerPriority)) {
        return res.status(400).json({ message: "providerPriority must be an array" });
      }
      const invalid = body.providerPriority.filter((p: string) => !OUTBOUND_PROVIDERS.includes(p as any));
      if (invalid.length > 0) {
        return res.status(400).json({ message: `Invalid provider(s) in priority: ${invalid.join(", ")}` });
      }
      patch.providerPriority = body.providerPriority as ProviderType[];
    }

    const merged = await saveSenderIdentity(ws, patch);
    await writeAudit({
      workspaceId: ws,
      type: "sender_identity_changed",
      description: "Sender identity / provider routing updated",
      createdBy: req.authContext?.email ?? null,
      metadata: { changedFields: Object.keys(patch) },
    });
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/providers/forwarding-inbox", requireRole("workspace_admin"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const raw = req.body?.forwardingInbox;
    const forwardingInbox = raw ? String(raw).trim().toLowerCase() : "";
    if (forwardingInbox && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardingInbox)) {
      return res.status(400).json({ message: "Invalid forwarding inbox email address" });
    }
    // Enforce uniqueness across workspaces: a forwarding address must map to
    // exactly one workspace, otherwise inbound resolution is ambiguous.
    if (forwardingInbox) {
      const [conflict] = await db.select({ id: workspacesTable.id })
        .from(workspacesTable)
        .where(and(
          ne(workspacesTable.id, ws),
          sql`lower(${workspacesTable.senderIdentity}->>'forwardingInbox') = ${forwardingInbox}`,
        ))
        .limit(1);
      if (conflict) {
        return res.status(409).json({ message: "That forwarding inbox is already in use by another workspace" });
      }
    }
    const merged = await saveSenderIdentity(ws, { forwardingInbox: forwardingInbox || undefined });
    await writeAudit({
      workspaceId: ws,
      type: "forwarding_inbox_changed",
      description: forwardingInbox ? `Forwarding inbox set to ${forwardingInbox}` : "Forwarding inbox cleared",
      createdBy: req.authContext?.email ?? null,
      metadata: { forwardingInbox: forwardingInbox || null },
    });
    res.json(merged);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
