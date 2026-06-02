import { db, mailboxConnectionsTable, scheduledEmailsTable, inboundEmailsTable, activityTable, leadsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

// Gmail provider. Mirrors lib/outlook-graph.ts but talks to the Gmail REST API
// and Google OAuth. Connections are stored in the shared mailbox_connections
// table with provider = "google" so the rest of the system stays provider
// agnostic. Thread metadata is persisted into the generic outlook* columns on
// scheduled_emails / inbound_emails (outlookMessageId = provider message id,
// outlookConversationId = Gmail threadId, outlookInternetMessageId = RFC822
// Message-ID) to avoid a schema migration.

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export const GMAIL_PROVIDER = "google";

function getOAuthConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri =
    process.env.GMAIL_REDIRECT_URI ||
    `https://${process.env.REPLIT_DEV_DOMAIN || ""}/api/gmail/callback`;
  return { clientId, clientSecret, redirectUri };
}

export function isGmailConfigured(): boolean {
  const { clientId, clientSecret } = getOAuthConfig();
  return !!(clientId && clientSecret);
}

export function getAuthorizationUrl(state?: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: state || "gmail_auth",
  });
  return `${OAUTH_AUTH}?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
}> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };

  const profileRes = await fetch(USERINFO, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = await profileRes.json() as { email?: string; name?: string };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresIn: data.expires_in,
    email: (user.email || "").toLowerCase(),
    displayName: user.name || user.email || "",
  };
}

export async function refreshAccessToken(connectionId: number): Promise<string> {
  const [conn] = await db.select().from(mailboxConnectionsTable).where(eq(mailboxConnectionsTable.id, connectionId));
  if (!conn || !conn.refreshToken) throw new Error("No refresh token available");

  const { clientId, clientSecret } = getOAuthConfig();

  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    await db.update(mailboxConnectionsTable).set({
      isActive: false,
      syncError: `Token refresh failed: ${err.substring(0, 500)}`,
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, connectionId));
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.update(mailboxConnectionsTable).set({
    accessToken: data.access_token,
    // Google only returns a refresh_token on the first consent; keep the old one.
    refreshToken: data.refresh_token || conn.refreshToken,
    tokenExpiresAt: expiresAt,
    syncError: null,
    updatedAt: new Date(),
  }).where(eq(mailboxConnectionsTable.id, connectionId));

  return data.access_token;
}

async function getValidToken(connectionId: number): Promise<string> {
  const [conn] = await db.select().from(mailboxConnectionsTable).where(eq(mailboxConnectionsTable.id, connectionId));
  if (!conn) throw new Error("Mailbox connection not found");

  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 60000) {
    return conn.accessToken!;
  }
  return refreshAccessToken(connectionId);
}

async function gmailFetch(connectionId: number, path: string, options: RequestInit = {}): Promise<any> {
  const token = await getValidToken(connectionId);
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail API error ${res.status}: ${text.substring(0, 500)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return null;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function buildRawMessage(opts: {
  from?: string;
  to: string;
  subject: string;
  bodyHtml: string;
  replyTo?: string;
  inReplyToMessageId?: string;
  references?: string;
}): string {
  const headers: string[] = [];
  if (opts.from) headers.push(`From: ${opts.from}`);
  headers.push(`To: ${opts.to}`);
  headers.push(`Subject: ${opts.subject}`);
  if (opts.replyTo) headers.push(`Reply-To: ${opts.replyTo}`);
  if (opts.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${opts.inReplyToMessageId}`);
    headers.push(`References: ${opts.references || opts.inReplyToMessageId}`);
  }
  headers.push("MIME-Version: 1.0");
  headers.push('Content-Type: text/html; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: 7bit");
  return `${headers.join("\r\n")}\r\n\r\n${opts.bodyHtml}`;
}

export interface GmailSendOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  from?: string;
  replyTo?: string;
  // RFC822 Message-ID of the message being replied to (for threading).
  inReplyToMessageId?: string;
  references?: string;
  // Gmail thread id to attach this reply to.
  threadId?: string;
}

export async function sendViaGmail(
  connectionId: number,
  options: GmailSendOptions,
): Promise<{ success: boolean; messageId?: string; conversationId?: string; internetMessageId?: string; error?: string }> {
  try {
    const raw = buildRawMessage({
      from: options.from,
      to: options.to,
      subject: options.subject,
      bodyHtml: options.bodyHtml,
      replyTo: options.replyTo,
      inReplyToMessageId: options.inReplyToMessageId,
      references: options.references,
    });

    const body: any = { raw: base64UrlEncode(raw) };
    if (options.threadId) body.threadId = options.threadId;

    const sent = await gmailFetch(connectionId, "/users/me/messages/send", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // Fetch the sent message to recover its RFC822 Message-ID for future
    // threading. Best-effort — failure here does not fail the send.
    let internetMessageId: string | undefined;
    try {
      const full = await gmailFetch(connectionId, `/users/me/messages/${sent.id}?format=metadata&metadataHeaders=Message-Id`);
      const mid = (full?.payload?.headers || []).find((h: any) => h.name?.toLowerCase() === "message-id");
      internetMessageId = mid?.value;
    } catch {
      // ignore
    }

    return {
      success: true,
      messageId: sent.id,
      conversationId: sent.threadId,
      internetMessageId,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function extractHeader(headers: any[], name: string): string {
  const h = (headers || []).find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";
  const walk = (part: any) => {
    if (!part) return;
    const mime = part.mimeType || "";
    if (part.body?.data) {
      const decoded = base64UrlDecode(part.body.data);
      if (mime === "text/plain" && !text) text = decoded;
      else if (mime === "text/html" && !html) html = decoded;
    }
    for (const sub of part.parts || []) walk(sub);
  };
  walk(payload);
  return { text, html };
}

export async function syncGmailInbox(connectionId: number): Promise<{
  newMessages: number;
  syncedOutbound: number;
  errors: string[];
}> {
  const [conn] = await db.select().from(mailboxConnectionsTable).where(eq(mailboxConnectionsTable.id, connectionId));
  if (!conn) throw new Error("Connection not found");

  let newMessages = 0;
  let syncedOutbound = 0;
  const errors: string[] = [];

  try {
    // syncCursor stores the unix-seconds timestamp of the last sync. First run
    // looks back 7 days.
    const sinceSeconds = conn.syncCursor
      ? parseInt(conn.syncCursor, 10)
      : Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const q = encodeURIComponent(`after:${sinceSeconds} -in:chats`);

    const list = await gmailFetch(connectionId, `/users/me/messages?q=${q}&maxResults=50`);
    const ids: string[] = (list?.messages || []).map((m: any) => m.id);

    for (const id of ids) {
      try {
        const existing = await db.select({ id: inboundEmailsTable.id })
          .from(inboundEmailsTable)
          .where(eq(inboundEmailsTable.outlookMessageId, id))
          .limit(1);
        if (existing.length > 0) continue;

        const msg = await gmailFetch(connectionId, `/users/me/messages/${id}?format=full`);
        const headers = msg?.payload?.headers || [];
        const fromRaw = extractHeader(headers, "From");
        const senderEmailMatch = fromRaw.match(/<([^>]+)>/);
        const senderEmail = (senderEmailMatch ? senderEmailMatch[1] : fromRaw).trim().toLowerCase();
        const subject = extractHeader(headers, "Subject");
        const messageIdHeader = extractHeader(headers, "Message-Id");
        const inReplyTo = extractHeader(headers, "In-Reply-To");
        const references = extractHeader(headers, "References");
        const { text, html } = extractBody(msg?.payload);

        // Outbound (sent by the connected mailbox) — attribute to the lead.
        if (senderEmail === conn.emailAddress.toLowerCase()) {
          const matched = await matchOutboundToLead(msg, headers, id);
          if (matched) syncedOutbound++;
          continue;
        }

        const { processInboundEmail } = await import("./reply-processor");
        await processInboundEmail({
          senderEmail: fromRaw || senderEmail,
          recipientEmail: conn.emailAddress,
          subject,
          bodyText: text || msg?.snippet || "",
          bodyHtml: html,
          messageId: messageIdHeader || id,
          inReplyTo: inReplyTo || references || messageIdHeader,
          references,
          outlookMessageId: id,
        });
        newMessages++;
      } catch (err: any) {
        errors.push(`Message ${id}: ${err.message}`);
      }
    }

    await db.update(mailboxConnectionsTable).set({
      syncCursor: String(Math.floor(Date.now() / 1000)),
      lastSyncedAt: new Date(),
      syncError: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, connectionId));
  } catch (err: any) {
    errors.push(`Sync error: ${err.message}`);
    await db.update(mailboxConnectionsTable).set({
      syncError: err.message.substring(0, 500),
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, connectionId));
  }

  return { newMessages, syncedOutbound, errors };
}

async function matchOutboundToLead(msg: any, headers: any[], gmailId: string): Promise<boolean> {
  const toRaw = extractHeader(headers, "To");
  const toMatch = toRaw.match(/<([^>]+)>/);
  const recipientEmail = (toMatch ? toMatch[1] : toRaw).trim().toLowerCase();
  if (!recipientEmail) return false;

  const [lead] = await db.select({ id: leadsTable.id, workspaceId: leadsTable.workspaceId })
    .from(leadsTable)
    .where(eq(leadsTable.email, recipientEmail))
    .limit(1);

  if (!lead) return false;

  await db.insert(activityTable).values({
    workspaceId: lead.workspaceId,
    type: "gmail_sent_synced",
    description: `Outbound email synced from Gmail: "${extractHeader(headers, "Subject") || ""}"`,
    leadId: lead.id,
    metadata: { gmailMessageId: gmailId, threadId: msg?.threadId },
    createdBy: "gmail_sync",
  });
  return true;
}

export async function getPrimaryGmailConnection(workspaceId = 1): Promise<{ id: number; emailAddress: string } | null> {
  const [primary] = await db.select({
    id: mailboxConnectionsTable.id,
    emailAddress: mailboxConnectionsTable.emailAddress,
  })
    .from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
      eq(mailboxConnectionsTable.isPrimary, true),
    ))
    .limit(1);

  if (primary) return primary;

  const [any] = await db.select({
    id: mailboxConnectionsTable.id,
    emailAddress: mailboxConnectionsTable.emailAddress,
  })
    .from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
    ))
    .limit(1);

  return any || null;
}

export async function getActiveGmailConnections(workspaceId = 1) {
  return db.select().from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, GMAIL_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
    ))
    .orderBy(desc(mailboxConnectionsTable.createdAt));
}
