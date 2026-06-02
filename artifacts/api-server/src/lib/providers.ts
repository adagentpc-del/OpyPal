import { db, workspacesTable, settingsTable } from "@workspace/db";
import type { ProviderType, WorkspaceSenderIdentity } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendEmail, checkResendConnection } from "./resend";
import {
  isOutlookConfigured,
  getPrimaryConnection,
  getActiveConnections,
  sendViaOutlook,
} from "./outlook-graph";
import {
  isGmailConfigured,
  getPrimaryGmailConnection,
  getActiveGmailConnections,
  sendViaGmail,
} from "./gmail-api";
import { generateTaggedReplyTo } from "./reply-processor";
import { writeAudit } from "./audit";

// Provider abstraction layer. Centralizes (a) per-workspace provider config
// resolution, (b) provider health reporting, and (c) outbound sending with an
// ordered fallback chain. Adding a new provider (SMTP, SendGrid, ...) only
// requires extending OUTBOUND_PROVIDERS, the availability check, and the send
// switch below — callers (scheduler, routes) stay unchanged.

// Providers that can actually send mail (forwarding is inbound-only).
export const OUTBOUND_PROVIDERS: Exclude<ProviderType, "forwarding">[] = ["outlook", "gmail", "resend"];

async function getSetting(workspaceId: number, key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db.select().from(settingsTable).where(and(
      eq(settingsTable.workspaceId, workspaceId),
      eq(settingsTable.key, key),
    ));
    return row?.value || fallback;
  } catch {
    return fallback;
  }
}

export async function getSenderIdentity(workspaceId: number): Promise<WorkspaceSenderIdentity> {
  const [ws] = await db.select({ senderIdentity: workspacesTable.senderIdentity })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  return ws?.senderIdentity || {};
}

export async function saveSenderIdentity(
  workspaceId: number,
  patch: Partial<WorkspaceSenderIdentity>,
): Promise<WorkspaceSenderIdentity> {
  const current = await getSenderIdentity(workspaceId);
  const merged: WorkspaceSenderIdentity = { ...current, ...patch };
  await db.update(workspacesTable)
    .set({ senderIdentity: merged, updatedAt: new Date() })
    .where(eq(workspacesTable.id, workspaceId));
  return merged;
}

export interface ProviderHealth {
  type: ProviderType;
  // Provider-level configuration present (env vars / integration connected).
  configured: boolean;
  // A usable connection exists for this workspace (OAuth mailbox / address).
  connected: boolean;
  primaryEmail: string | null;
  connectionCount: number;
  detail?: string | null;
}

export async function getProviderHealth(workspaceId: number): Promise<{
  providers: ProviderHealth[];
  senderIdentity: WorkspaceSenderIdentity;
  sendChain: ProviderType[];
}> {
  const senderIdentity = await getSenderIdentity(workspaceId);

  // Resend
  const resendCheck = await checkResendConnection();

  // Outlook
  const outlookConfigured = isOutlookConfigured();
  const outlookConns = outlookConfigured ? await getActiveConnections(workspaceId) : [];
  const outlookPrimary = outlookConfigured ? await getPrimaryConnection(workspaceId) : null;

  // Gmail
  const gmailConfigured = isGmailConfigured();
  const gmailConns = gmailConfigured ? await getActiveGmailConnections(workspaceId) : [];
  const gmailPrimary = gmailConfigured ? await getPrimaryGmailConnection(workspaceId) : null;

  const providers: ProviderHealth[] = [
    {
      type: "outlook",
      configured: outlookConfigured,
      connected: !!outlookPrimary,
      primaryEmail: outlookPrimary?.emailAddress || null,
      connectionCount: outlookConns.length,
      detail: outlookConfigured ? null : "Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET",
    },
    {
      type: "gmail",
      configured: gmailConfigured,
      connected: !!gmailPrimary,
      primaryEmail: gmailPrimary?.emailAddress || null,
      connectionCount: gmailConns.length,
      detail: gmailConfigured ? null : "Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET",
    },
    {
      type: "resend",
      configured: resendCheck.connected,
      connected: resendCheck.connected,
      primaryEmail: resendCheck.fromEmail || null,
      connectionCount: resendCheck.connected ? 1 : 0,
      detail: resendCheck.connected ? null : (resendCheck.error || "Resend integration not connected"),
    },
    {
      type: "forwarding",
      configured: !!senderIdentity.forwardingInbox,
      connected: !!senderIdentity.forwardingInbox,
      primaryEmail: senderIdentity.forwardingInbox || null,
      connectionCount: senderIdentity.forwardingInbox ? 1 : 0,
      detail: senderIdentity.forwardingInbox ? null : "No forwarding inbox configured",
    },
  ];

  const chain = await resolveSendChain(workspaceId);
  return { providers, senderIdentity, sendChain: chain.map(c => c.type) };
}

export interface ResolvedProvider {
  type: Exclude<ProviderType, "forwarding">;
  connectionId?: number;
  emailAddress?: string;
}

// Builds the ordered list of providers to try for a workspace. Order is driven
// by senderIdentity.providerPriority, else defaultProvider, else the workspace
// settings.primary_send_provider, with the remaining configured providers
// appended. Resend is always appended last as a safety net when available.
export async function resolveSendChain(workspaceId: number): Promise<ResolvedProvider[]> {
  const identity = await getSenderIdentity(workspaceId);
  const primarySetting = (await getSetting(workspaceId, "primary_send_provider", "resend")) as ProviderType;

  let order: ProviderType[];
  if (identity.providerPriority && identity.providerPriority.length > 0) {
    order = [...identity.providerPriority];
  } else {
    const lead = identity.defaultProvider || primarySetting;
    order = [lead, ...OUTBOUND_PROVIDERS.filter(p => p !== lead)];
  }
  // Always have resend as a last-resort fallback.
  if (!order.includes("resend")) order.push("resend");

  const resolved: ResolvedProvider[] = [];
  const seen = new Set<string>();

  for (const type of order) {
    if (type === "forwarding" || seen.has(type)) continue;
    if (type === "resend") {
      const ok = (await checkResendConnection()).connected;
      if (ok) { resolved.push({ type: "resend" }); seen.add(type); }
    } else if (type === "outlook") {
      if (!isOutlookConfigured()) continue;
      const conn = await getPrimaryConnection(workspaceId);
      if (conn) { resolved.push({ type: "outlook", connectionId: conn.id, emailAddress: conn.emailAddress }); seen.add(type); }
    } else if (type === "gmail") {
      if (!isGmailConfigured()) continue;
      const conn = await getPrimaryGmailConnection(workspaceId);
      if (conn) { resolved.push({ type: "gmail", connectionId: conn.id, emailAddress: conn.emailAddress }); seen.add(type); }
    }
  }

  return resolved;
}

export interface SendForWorkspaceParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  replyTo?: string;
  // For Resend tagged reply-to threading.
  leadId?: number;
  scheduledEmailId?: number;
  // Thread metadata from a prior send (provider-specific).
  threadOutlookMessageId?: string | null;
  threadGmailMessageId?: string | null; // RFC822 Message-ID
  threadGmailThreadId?: string | null;
  // Restrict to a single provider (skip fallback) — used when honoring a
  // per-email sendVia override.
  forceProvider?: Exclude<ProviderType, "forwarding">;
  // Workspace context for audit logging.
  auditWorkspaceId?: number;
}

export interface SendForWorkspaceResult {
  success: boolean;
  providerUsed: ProviderType | null;
  messageId?: string;
  conversationId?: string;
  internetMessageId?: string;
  error?: string;
  attempts: Array<{ provider: ProviderType; success: boolean; error?: string }>;
}

function formatFrom(identity: WorkspaceSenderIdentity, fallback?: string): string | undefined {
  if (identity.fromEmail) {
    return identity.fromName ? `${identity.fromName} <${identity.fromEmail}>` : identity.fromEmail;
  }
  return fallback;
}

// Sends a single email for a workspace, trying providers in resolved order
// until one succeeds. Writes an audit entry recording the provider used (or the
// exhausted fallback chain on total failure).
export async function sendForWorkspace(
  workspaceId: number,
  params: SendForWorkspaceParams,
): Promise<SendForWorkspaceResult> {
  const identity = await getSenderIdentity(workspaceId);
  let chain = await resolveSendChain(workspaceId);

  if (params.forceProvider) {
    const forced = chain.filter(c => c.type === params.forceProvider);
    // If the forced provider is available use only it; otherwise fall back to
    // the full chain so the send is not silently dropped.
    if (forced.length > 0) chain = forced;
  }

  const attempts: SendForWorkspaceResult["attempts"] = [];

  if (chain.length === 0) {
    await writeAudit({
      workspaceId,
      type: "email_send_failed",
      description: `No send provider available for "${params.subject}"`,
      createdBy: "provider-resolver",
      metadata: { to: params.to, leadId: params.leadId ?? null },
    });
    return { success: false, providerUsed: null, error: "No send provider available", attempts };
  }

  for (const provider of chain) {
    try {
      if (provider.type === "resend") {
        const replyTo = params.replyTo
          || (params.leadId && params.scheduledEmailId
            ? generateTaggedReplyTo(params.leadId, params.scheduledEmailId)
            : identity.replyToEmail);
        const r = await sendEmail({
          to: params.to,
          from: params.fromEmail || formatFrom(identity),
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo,
        });
        attempts.push({ provider: "resend", success: r.success, error: r.error });
        if (r.success) {
          await auditSend(workspaceId, "resend", params, { messageId: r.id });
          return { success: true, providerUsed: "resend", messageId: r.id, attempts };
        }
      } else if (provider.type === "outlook") {
        const r = await sendViaOutlook(provider.connectionId!, {
          to: params.to,
          subject: params.subject,
          bodyHtml: params.html,
          bodyText: params.text,
          inReplyTo: params.threadOutlookMessageId || undefined,
        });
        attempts.push({ provider: "outlook", success: r.success, error: r.error });
        if (r.success) {
          await auditSend(workspaceId, "outlook", params, { messageId: r.messageId });
          return {
            success: true,
            providerUsed: "outlook",
            messageId: r.messageId,
            conversationId: r.conversationId,
            internetMessageId: r.internetMessageId,
            attempts,
          };
        }
      } else if (provider.type === "gmail") {
        const r = await sendViaGmail(provider.connectionId!, {
          to: params.to,
          subject: params.subject,
          bodyHtml: params.html,
          bodyText: params.text,
          from: formatFrom(identity, provider.emailAddress),
          replyTo: params.replyTo || identity.replyToEmail,
          inReplyToMessageId: params.threadGmailMessageId || undefined,
          threadId: params.threadGmailThreadId || undefined,
        });
        attempts.push({ provider: "gmail", success: r.success, error: r.error });
        if (r.success) {
          await auditSend(workspaceId, "gmail", params, { messageId: r.messageId });
          return {
            success: true,
            providerUsed: "gmail",
            messageId: r.messageId,
            conversationId: r.conversationId,
            internetMessageId: r.internetMessageId,
            attempts,
          };
        }
      }
    } catch (err: any) {
      attempts.push({ provider: provider.type, success: false, error: err.message });
    }
  }

  await writeAudit({
    workspaceId,
    type: "email_send_failed",
    description: `All providers failed for "${params.subject}"`,
    createdBy: "provider-resolver",
    metadata: { to: params.to, leadId: params.leadId ?? null, attempts },
  });

  return {
    success: false,
    providerUsed: null,
    error: attempts.map(a => `${a.provider}: ${a.error}`).join("; ") || "All providers failed",
    attempts,
  };
}

async function auditSend(
  workspaceId: number,
  provider: ProviderType,
  params: SendForWorkspaceParams,
  extra: { messageId?: string },
): Promise<void> {
  await writeAudit({
    workspaceId,
    type: "email_sent_provider",
    description: `Sent via ${provider}: "${params.subject}"`,
    createdBy: "provider-resolver",
    metadata: {
      provider,
      to: params.to,
      leadId: params.leadId ?? null,
      scheduledEmailId: params.scheduledEmailId ?? null,
      messageId: extra.messageId ?? null,
    },
  });
}
