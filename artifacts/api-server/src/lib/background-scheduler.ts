import { db, scheduledEmailsTable, leadsTable, activityTable, settingsTable, mailboxConnectionsTable, suppressionListTable } from "@workspace/db";
import { eq, and, lte, inArray, asc, sql } from "drizzle-orm";
import { getPrimaryConnection, syncInbox, isOutlookConfigured, OUTLOOK_PROVIDER } from "./outlook-graph";
import { syncGmailInbox, isGmailConfigured, getPrimaryGmailConnection, GMAIL_PROVIDER } from "./gmail-api";
import { sendForWorkspace, resolveSendChain } from "./providers";
import type { ProviderType } from "@workspace/db";

let schedulerRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;
let lastFollowUpRun = 0;
let lastSyncRun = 0;

const FOLLOWUP_INTERVAL_MS = 60_000;
const SYNC_INTERVAL_MS = 120_000;
const MAX_SENDS_PER_CYCLE = 10;
const MIN_DELAY_BETWEEN_SENDS_MS = 3000;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function getSetting(workspaceId: number, key: string, defaultValue: string): Promise<string> {
  try {
    const [row] = await db.select().from(settingsTable).where(and(
      eq(settingsTable.workspaceId, workspaceId),
      eq(settingsTable.key, key),
    ));
    return row?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

function isInSendWindow(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  return hour >= 8 && hour < 18;
}

async function processFollowUps(): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const dueEmails = await db.select()
    .from(scheduledEmailsTable)
    .where(and(
      inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
      lte(scheduledEmailsTable.scheduledFor, new Date()),
    ))
    .orderBy(asc(scheduledEmailsTable.scheduledFor))
    .limit(MAX_SENDS_PER_CYCLE);

  if (dueEmails.length === 0) return { sent, failed, skipped };

  const windowCache = new Map<number, boolean>();

  for (const email of dueEmails) {
    try {
      const ws = email.workspaceId;

      if (!windowCache.has(ws)) {
        const weekdayOnly = await getSetting(ws, "weekday_sending_only", "true");
        windowCache.set(ws, !(weekdayOnly === "true" && !isInSendWindow()));
      }
      if (!windowCache.get(ws)) {
        skipped++;
        continue;
      }

      const [lead] = await db.select({ email: leadsTable.email, status: leadsTable.status, isUnsubscribed: leadsTable.isUnsubscribed, isBounced: leadsTable.isBounced })
        .from(leadsTable)
        .where(and(eq(leadsTable.id, email.leadId), eq(leadsTable.workspaceId, ws)));

      if (!lead || !lead.email) {
        await db.update(scheduledEmailsTable).set({ status: "failed", sendError: "Lead not found or no email", updatedAt: new Date() }).where(eq(scheduledEmailsTable.id, email.id));
        failed++;
        continue;
      }

      const stopStatuses = ["Closed Won", "Closed Lost", "Do Not Contact"];
      if (stopStatuses.includes(lead.status) || lead.isUnsubscribed || lead.isBounced) {
        await db.update(scheduledEmailsTable).set({
          status: "canceled",
          canceledAt: new Date(),
          canceledReason: `auto_stop: ${lead.isUnsubscribed ? "unsubscribed" : lead.isBounced ? "bounced" : lead.status}`,
          updatedAt: new Date(),
        }).where(eq(scheduledEmailsTable.id, email.id));
        skipped++;
        continue;
      }

      const [suppressed] = await db.select({ id: suppressionListTable.id })
        .from(suppressionListTable)
        .where(and(
          eq(suppressionListTable.workspaceId, ws),
          eq(suppressionListTable.email, lead.email.toLowerCase()),
        ))
        .limit(1);
      if (suppressed) {
        await db.update(scheduledEmailsTable).set({
          status: "canceled",
          canceledAt: new Date(),
          canceledReason: "auto_stop: suppression_list",
          updatedAt: new Date(),
        }).where(eq(scheduledEmailsTable.id, email.id));
        skipped++;
        continue;
      }

      await db.update(scheduledEmailsTable).set({ status: "sending", lastAttemptAt: new Date(), updatedAt: new Date() }).where(eq(scheduledEmailsTable.id, email.id));

      const textBody = email.body;
      const htmlBody = textBody
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")
        .replace(/^/, "<p>").replace(/$/, "</p>");

      // A per-email sendVia override forces a single provider (no fallback);
      // otherwise the workspace's resolved provider chain (with fallback) runs.
      const forceProvider = (email.sendVia && email.sendVia !== "auto")
        ? (email.sendVia as ProviderType)
        : undefined;

      const result = await sendForWorkspace(ws, {
        to: lead.email,
        subject: email.subject,
        html: htmlBody,
        text: textBody,
        fromEmail: email.fromEmail || undefined,
        leadId: email.leadId,
        scheduledEmailId: email.id,
        threadOutlookMessageId: email.outlookMessageId,
        threadGmailMessageId: email.outlookInternetMessageId,
        threadGmailThreadId: email.outlookConversationId,
        forceProvider: forceProvider === "forwarding" ? undefined : forceProvider as any,
      });

      if (result.success) {
        const updates: any = {
          status: "sent",
          sentAt: new Date(),
          sendError: null,
          sendVia: result.providerUsed,
          updatedAt: new Date(),
        };
        // resendMessageId for resend; the generic outlook* columns hold the
        // provider message id / thread id / RFC822 id for outlook & gmail.
        if (result.providerUsed === "resend" && result.messageId) updates.resendMessageId = result.messageId;
        if (result.messageId) updates.outlookMessageId = result.messageId;
        if (result.conversationId) updates.outlookConversationId = result.conversationId;
        if (result.internetMessageId) updates.outlookInternetMessageId = result.internetMessageId;

        await db.update(scheduledEmailsTable).set(updates).where(eq(scheduledEmailsTable.id, email.id));

        await db.insert(activityTable).values({
          workspaceId: ws,
          type: "email_sent",
          description: `Follow-up sent: "${email.subject}"`,
          leadId: email.leadId,
          metadata: { scheduledEmailId: email.id, sendVia: result.providerUsed, attempts: result.attempts },
          relatedTemplateId: email.templateId,
          relatedSequenceId: email.sequenceId,
          createdBy: "scheduler",
        });

        await db.update(leadsTable).set({
          lastContactDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date(),
        }).where(and(eq(leadsTable.id, email.leadId), eq(leadsTable.workspaceId, ws)));

        sent++;
        console.log(`[Scheduler] Sent follow-up ${email.id} to lead ${email.leadId} via ${result.providerUsed}`);
      } else {
        const retryCount = (email.retryCount || 0) + 1;
        if (retryCount <= 3) {
          const retryAt = new Date(Date.now() + 30000 * Math.pow(2, retryCount - 1));
          await db.update(scheduledEmailsTable).set({
            status: "scheduled",
            retryCount,
            sendError: result.error,
            scheduledFor: retryAt,
            updatedAt: new Date(),
          }).where(eq(scheduledEmailsTable.id, email.id));
        } else {
          await db.update(scheduledEmailsTable).set({
            status: "failed",
            retryCount,
            sendError: result.error,
            updatedAt: new Date(),
          }).where(eq(scheduledEmailsTable.id, email.id));
        }
        failed++;
        console.log(`[Scheduler] Failed follow-up ${email.id}: ${result.error}`);
      }

      await sleep(MIN_DELAY_BETWEEN_SENDS_MS);
    } catch (err: any) {
      console.error(`[Scheduler] Error processing email ${email.id}:`, err.message);
      await db.update(scheduledEmailsTable).set({
        status: "failed",
        sendError: err.message,
        updatedAt: new Date(),
      }).where(eq(scheduledEmailsTable.id, email.id));
      failed++;
    }
  }

  return { sent, failed, skipped };
}

// Provider-aware mailbox sync. Each active connection is synced through the
// matching provider's sync routine (Outlook via Graph, Gmail via Gmail API).
// A connection of one provider must never be synced through another's client.
async function runProviderSync(): Promise<void> {
  const outlookOn = isOutlookConfigured();
  const gmailOn = isGmailConfigured();
  if (!outlookOn && !gmailOn) return;

  try {
    const connections = await db.select()
      .from(mailboxConnectionsTable)
      .where(eq(mailboxConnectionsTable.isActive, true));

    for (const conn of connections) {
      try {
        let result: { newMessages: number; syncedOutbound: number; errors: string[] } | null = null;
        if (conn.provider === GMAIL_PROVIDER && gmailOn) {
          result = await syncGmailInbox(conn.id);
        } else if (conn.provider === OUTLOOK_PROVIDER && outlookOn) {
          result = await syncInbox(conn.id);
        }
        if (result && (result.newMessages > 0 || result.syncedOutbound > 0)) {
          console.log(`[Scheduler] Synced ${conn.provider} mailbox ${conn.emailAddress}: ${result.newMessages} inbound, ${result.syncedOutbound} outbound`);
        }
      } catch (err: any) {
        console.error(`[Scheduler] Sync failed for ${conn.provider} ${conn.emailAddress}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[Scheduler] Provider sync error:", err.message);
  }
}

async function schedulerTick(): Promise<void> {
  const now = Date.now();

  if (now - lastFollowUpRun >= FOLLOWUP_INTERVAL_MS) {
    lastFollowUpRun = now;
    try {
      const result = await processFollowUps();
      if (result.sent > 0 || result.failed > 0) {
        console.log(`[Scheduler] Follow-up cycle: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
      }
    } catch (err: any) {
      console.error("[Scheduler] Follow-up processing error:", err.message);
    }
  }

  if (now - lastSyncRun >= SYNC_INTERVAL_MS) {
    lastSyncRun = now;
    await runProviderSync();
  }
}

export function startScheduler(): void {
  if (schedulerRunning) {
    console.log("[Scheduler] Already running");
    return;
  }

  schedulerRunning = true;
  lastFollowUpRun = 0;
  lastSyncRun = 0;

  console.log("[Scheduler] Started — follow-ups every 60s, mailbox sync every 120s");

  schedulerTick();

  schedulerInterval = setInterval(() => {
    schedulerTick().catch(err => {
      console.error("[Scheduler] Tick error:", err.message);
    });
  }, 30_000);
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  schedulerRunning = false;
  console.log("[Scheduler] Stopped");
}

export function isSchedulerRunning(): boolean {
  return schedulerRunning;
}

export async function getSchedulerStatus(): Promise<{
  running: boolean;
  lastFollowUpRun: string | null;
  lastSyncRun: string | null;
  pendingFollowUps: number;
  sendProvider: string;
  outlookConfigured: boolean;
  outlookConnected: boolean;
  gmailConfigured: boolean;
  gmailConnected: boolean;
}> {
  const [pending] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledEmailsTable)
    .where(and(
      inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
      lte(scheduledEmailsTable.scheduledFor, new Date()),
    ));

  const sendProvider = await getSetting(1, "primary_send_provider", "resend");
  const outlookConfigured = isOutlookConfigured();
  const conn = outlookConfigured ? await getPrimaryConnection(1) : null;
  const gmailConfigured = isGmailConfigured();
  const gmailConn = gmailConfigured ? await getPrimaryGmailConnection(1) : null;

  return {
    running: schedulerRunning,
    lastFollowUpRun: lastFollowUpRun > 0 ? new Date(lastFollowUpRun).toISOString() : null,
    lastSyncRun: lastSyncRun > 0 ? new Date(lastSyncRun).toISOString() : null,
    pendingFollowUps: Number(pending?.count || 0),
    sendProvider,
    outlookConfigured,
    outlookConnected: !!conn,
    gmailConfigured,
    gmailConnected: !!gmailConn,
  };
}
