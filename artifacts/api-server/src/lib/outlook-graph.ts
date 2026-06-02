import { db, mailboxConnectionsTable, scheduledEmailsTable, inboundEmailsTable, activityTable, leadsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const AUTH_BASE = "https://login.microsoftonline.com";
const SCOPES = "Mail.ReadWrite Mail.Send offline_access User.Read";

function getOAuthConfig() {
  const clientId = process.env.OUTLOOK_CLIENT_ID || "";
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || "";
  const tenantId = process.env.OUTLOOK_TENANT_ID || "common";
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI || `https://${process.env.REPLIT_DEV_DOMAIN || ""}/api/outlook/callback`;
  return { clientId, clientSecret, tenantId, redirectUri };
}

export function isOutlookConfigured(): boolean {
  const { clientId, clientSecret } = getOAuthConfig();
  return !!(clientId && clientSecret);
}

export function getAuthorizationUrl(state?: string): string {
  const { clientId, tenantId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: "query",
    state: state || "outlook_auth",
  });
  return `${AUTH_BASE}/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName: string;
}> {
  const { clientId, clientSecret, tenantId, redirectUri } = getOAuthConfig();

  const res = await fetch(`${AUTH_BASE}/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await res.json();

  const profile = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = await profile.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    email: user.mail || user.userPrincipalName || "",
    displayName: user.displayName || "",
  };
}

export async function refreshAccessToken(connectionId: number): Promise<string> {
  const [conn] = await db.select().from(mailboxConnectionsTable).where(eq(mailboxConnectionsTable.id, connectionId));
  if (!conn || !conn.refreshToken) throw new Error("No refresh token available");

  const { clientId, clientSecret, tenantId } = getOAuthConfig();

  const res = await fetch(`${AUTH_BASE}/${tenantId || "common"}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
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

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await db.update(mailboxConnectionsTable).set({
    accessToken: data.access_token,
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

async function graphFetch(connectionId: number, path: string, options: RequestInit = {}): Promise<any> {
  const token = await getValidToken(connectionId);
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph API error ${res.status}: ${text.substring(0, 500)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}

export interface OutlookSendOptions {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  inReplyTo?: string;
  conversationId?: string;
  saveToSentItems?: boolean;
}

export async function sendViaOutlook(
  connectionId: number,
  options: OutlookSendOptions
): Promise<{ success: boolean; messageId?: string; conversationId?: string; internetMessageId?: string; error?: string }> {
  try {
    const message: any = {
      subject: options.subject,
      body: {
        contentType: "HTML",
        content: options.bodyHtml,
      },
      toRecipients: [
        { emailAddress: { address: options.to } },
      ],
    };

    if (options.inReplyTo) {
      const replyRes = await graphFetch(connectionId, `/me/messages/${options.inReplyTo}`);
      if (replyRes) {
        const replyBody = {
          message: {
            toRecipients: [{ emailAddress: { address: options.to } }],
            body: { contentType: "HTML", content: options.bodyHtml },
          },
        };
        await graphFetch(connectionId, `/me/messages/${options.inReplyTo}/reply`, {
          method: "POST",
          body: JSON.stringify(replyBody),
        });

        const sentMessages = await graphFetch(connectionId,
          `/me/mailFolders/sentItems/messages?$filter=conversationId eq '${replyRes.conversationId}'&$orderby=sentDateTime desc&$top=1`
        );
        const sent = sentMessages?.value?.[0];
        return {
          success: true,
          messageId: sent?.id,
          conversationId: sent?.conversationId || replyRes.conversationId,
          internetMessageId: sent?.internetMessageId,
        };
      }
    }

    const draft = await graphFetch(connectionId, "/me/messages", {
      method: "POST",
      body: JSON.stringify(message),
    });

    await graphFetch(connectionId, `/me/messages/${draft.id}/send`, {
      method: "POST",
    });

    const sentMessages = await graphFetch(connectionId,
      `/me/mailFolders/sentItems/messages?$orderby=sentDateTime desc&$top=1&$filter=subject eq '${options.subject.replace(/'/g, "''")}'`
    );
    const sent = sentMessages?.value?.[0];

    return {
      success: true,
      messageId: sent?.id || draft.id,
      conversationId: sent?.conversationId || draft.conversationId,
      internetMessageId: sent?.internetMessageId || draft.internetMessageId,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncInbox(connectionId: number): Promise<{
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
    let url: string;
    if (conn.syncCursor) {
      url = conn.syncCursor;
    } else {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      url = `/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${since}&$top=50&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,conversationId,internetMessageId,isRead,inferenceClassification`;
    }

    const isFullUrl = url.startsWith("http");
    const data = isFullUrl
      ? await (async () => {
          const token = await getValidToken(connectionId);
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
          return res.json();
        })()
      : await graphFetch(connectionId, url);

    const messages = data?.value || [];

    for (const msg of messages) {
      try {
        const existing = await db.select({ id: inboundEmailsTable.id })
          .from(inboundEmailsTable)
          .where(eq(inboundEmailsTable.outlookMessageId, msg.id))
          .limit(1);

        if (existing.length > 0) continue;

        const senderEmail = msg.from?.emailAddress?.address || "";
        const senderName = msg.from?.emailAddress?.name || "";

        if (senderEmail.toLowerCase() === conn.emailAddress.toLowerCase()) {
          const matchedLead = await matchOutboundToLead(senderEmail, msg);
          if (matchedLead) syncedOutbound++;
          continue;
        }

        const { processInboundEmail } = await import("./reply-processor");
        await processInboundEmail({
          senderEmail: senderName ? `${senderName} <${senderEmail}>` : senderEmail,
          recipientEmail: conn.emailAddress,
          subject: msg.subject || "",
          bodyText: msg.bodyPreview || "",
          bodyHtml: msg.body?.content || "",
          messageId: msg.internetMessageId,
          inReplyTo: msg.internetMessageId,
          outlookMessageId: msg.id,
        });

        newMessages++;
      } catch (err: any) {
        errors.push(`Message ${msg.id}: ${err.message}`);
      }
    }

    const nextLink = data?.["@odata.deltaLink"] || data?.["@odata.nextLink"];
    await db.update(mailboxConnectionsTable).set({
      syncCursor: nextLink || null,
      lastSyncedAt: new Date(),
      syncError: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, connectionId));

    await syncSentFolder(connectionId, conn.emailAddress);

  } catch (err: any) {
    errors.push(`Sync error: ${err.message}`);
    await db.update(mailboxConnectionsTable).set({
      syncError: err.message.substring(0, 500),
      updatedAt: new Date(),
    }).where(eq(mailboxConnectionsTable.id, connectionId));
  }

  return { newMessages, syncedOutbound, errors };
}

async function syncSentFolder(connectionId: number, senderEmail: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const data = await graphFetch(connectionId,
      `/me/mailFolders/sentItems/messages?$filter=sentDateTime ge ${since}&$top=25&$orderby=sentDateTime desc&$select=id,subject,bodyPreview,body,toRecipients,sentDateTime,conversationId,internetMessageId`
    );

    for (const msg of data?.value || []) {
      const existing = await db.select({ id: scheduledEmailsTable.id })
        .from(scheduledEmailsTable)
        .where(eq(scheduledEmailsTable.outlookMessageId, msg.id))
        .limit(1);
      if (existing.length > 0) continue;

      const sentBySystem = await db.select({ id: scheduledEmailsTable.id })
        .from(scheduledEmailsTable)
        .where(eq(scheduledEmailsTable.outlookInternetMessageId, msg.internetMessageId))
        .limit(1);
      if (sentBySystem.length > 0) continue;

      const recipientEmail = msg.toRecipients?.[0]?.emailAddress?.address || "";
      if (!recipientEmail) continue;

      const [lead] = await db.select({ id: leadsTable.id, workspaceId: leadsTable.workspaceId })
        .from(leadsTable)
        .where(eq(leadsTable.email, recipientEmail.toLowerCase()))
        .limit(1);

      if (!lead) continue;

      await db.insert(activityTable).values({
        workspaceId: lead.workspaceId,
        type: "manual_outlook_email",
        description: `Manual Outlook email: "${msg.subject || "(no subject)"}"`,
        leadId: lead.id,
        metadata: {
          outlookMessageId: msg.id,
          conversationId: msg.conversationId,
          recipientEmail,
          sentAt: msg.sentDateTime,
          bodyPreview: (msg.bodyPreview || "").substring(0, 300),
        },
        createdBy: "outlook_sync",
      });

      await db.update(leadsTable).set({
        lastContactDate: new Date(msg.sentDateTime).toISOString().split("T")[0],
        updatedAt: new Date(),
      }).where(eq(leadsTable.id, lead.id));
    }
  } catch (err: any) {
    console.error("[OutlookSync] Sent folder sync error:", err.message);
  }
}

async function matchOutboundToLead(senderEmail: string, msg: any): Promise<boolean> {
  const recipientEmail = msg.toRecipients?.[0]?.emailAddress?.address;
  if (!recipientEmail) return false;

  const [lead] = await db.select({ id: leadsTable.id, workspaceId: leadsTable.workspaceId })
    .from(leadsTable)
    .where(eq(leadsTable.email, recipientEmail.toLowerCase()))
    .limit(1);

  if (lead) {
    await db.insert(activityTable).values({
      workspaceId: lead.workspaceId,
      type: "outlook_sent_synced",
      description: `Outbound email synced from Outlook: "${msg.subject || ""}"`,
      leadId: lead.id,
      metadata: { outlookMessageId: msg.id, conversationId: msg.conversationId },
      createdBy: "outlook_sync",
    });
    return true;
  }
  return false;
}

// Outlook/Microsoft connections only. The mailbox_connections table is shared
// with other providers (e.g. Gmail), so every query filters on provider to
// avoid cross-provider leakage.
export const OUTLOOK_PROVIDER = "microsoft";

export async function getPrimaryConnection(workspaceId = 1): Promise<{ id: number; emailAddress: string } | null> {
  const [conn] = await db.select({
    id: mailboxConnectionsTable.id,
    emailAddress: mailboxConnectionsTable.emailAddress,
  })
    .from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, OUTLOOK_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
      eq(mailboxConnectionsTable.isPrimary, true),
    ))
    .limit(1);

  if (conn) return conn;

  const [any] = await db.select({
    id: mailboxConnectionsTable.id,
    emailAddress: mailboxConnectionsTable.emailAddress,
  })
    .from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, OUTLOOK_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
    ))
    .limit(1);

  return any || null;
}

export async function getActiveConnections(workspaceId = 1) {
  return db.select().from(mailboxConnectionsTable)
    .where(and(
      eq(mailboxConnectionsTable.workspaceId, workspaceId),
      eq(mailboxConnectionsTable.provider, OUTLOOK_PROVIDER),
      eq(mailboxConnectionsTable.isActive, true),
    ))
    .orderBy(desc(mailboxConnectionsTable.createdAt));
}
