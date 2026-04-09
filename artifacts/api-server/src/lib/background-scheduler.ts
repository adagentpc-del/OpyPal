import { db, scheduledEmailsTable, leadsTable, activityTable, settingsTable, mailboxConnectionsTable } from "@workspace/db";
import { eq, and, lte, inArray, asc, sql, or } from "drizzle-orm";
import { sendEmail } from "./resend";
import { sendViaOutlook, getPrimaryConnection, syncInbox, isOutlookConfigured } from "./outlook-graph";
import { generateTaggedReplyTo } from "./reply-processor";

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

async function getSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
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

  const weekdayOnly = await getSetting("weekday_sending_only", "true");
  if (weekdayOnly === "true" && !isInSendWindow()) {
    return { sent, failed, skipped };
  }

  const dueEmails = await db.select()
    .from(scheduledEmailsTable)
    .where(and(
      inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
      lte(scheduledEmailsTable.scheduledFor, new Date()),
    ))
    .orderBy(asc(scheduledEmailsTable.scheduledFor))
    .limit(MAX_SENDS_PER_CYCLE);

  if (dueEmails.length === 0) return { sent, failed, skipped };

  const sendProvider = await getSetting("primary_send_provider", "resend");
  const outlookConn = sendProvider === "outlook" ? await getPrimaryConnection() : null;

  for (const email of dueEmails) {
    try {
      const [lead] = await db.select({ email: leadsTable.email, status: leadsTable.status, isUnsubscribed: leadsTable.isUnsubscribed, isBounced: leadsTable.isBounced })
        .from(leadsTable)
        .where(eq(leadsTable.id, email.leadId));

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

      await db.update(scheduledEmailsTable).set({ status: "sending", lastAttemptAt: new Date(), updatedAt: new Date() }).where(eq(scheduledEmailsTable.id, email.id));

      const textBody = email.body;
      const htmlBody = textBody
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")
        .replace(/^/, "<p>").replace(/$/, "</p>");

      let result: { success: boolean; id?: string; error?: string; messageId?: string; conversationId?: string; internetMessageId?: string };

      if (outlookConn && (email.sendVia === "outlook" || sendProvider === "outlook")) {
        const outlookResult = await sendViaOutlook(outlookConn.id, {
          to: lead.email,
          subject: email.subject,
          bodyHtml: htmlBody,
          inReplyTo: email.outlookMessageId || undefined,
        });
        result = {
          success: outlookResult.success,
          id: outlookResult.messageId,
          error: outlookResult.error,
          messageId: outlookResult.messageId,
          conversationId: outlookResult.conversationId,
          internetMessageId: outlookResult.internetMessageId,
        };
      } else {
        const taggedReplyTo = generateTaggedReplyTo(email.leadId, email.id);
        const resendResult = await sendEmail({
          to: lead.email,
          from: email.fromEmail || undefined,
          subject: email.subject,
          html: htmlBody,
          text: textBody,
          replyTo: taggedReplyTo,
        });
        result = { success: resendResult.success, id: resendResult.id, error: resendResult.error };
      }

      if (result.success) {
        const updates: any = {
          status: "sent",
          sentAt: new Date(),
          sendError: null,
          updatedAt: new Date(),
        };
        if (result.id) updates.resendMessageId = result.id;
        if (result.messageId) updates.outlookMessageId = result.messageId;
        if (result.conversationId) updates.outlookConversationId = result.conversationId;
        if (result.internetMessageId) updates.outlookInternetMessageId = result.internetMessageId;

        await db.update(scheduledEmailsTable).set(updates).where(eq(scheduledEmailsTable.id, email.id));

        await db.insert(activityTable).values({
          type: "email_sent",
          description: `Follow-up sent: "${email.subject}"`,
          leadId: email.leadId,
          metadata: { scheduledEmailId: email.id, sendVia: outlookConn ? "outlook" : "resend" },
          relatedTemplateId: email.templateId,
          relatedSequenceId: email.sequenceId,
          createdBy: "scheduler",
        });

        await db.update(leadsTable).set({
          lastContactDate: new Date().toISOString().split("T")[0],
          updatedAt: new Date(),
        }).where(eq(leadsTable.id, email.leadId));

        sent++;
        console.log(`[Scheduler] Sent follow-up ${email.id} to lead ${email.leadId} via ${outlookConn ? "outlook" : "resend"}`);
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

async function runOutlookSync(): Promise<void> {
  if (!isOutlookConfigured()) return;

  try {
    const connections = await db.select()
      .from(mailboxConnectionsTable)
      .where(eq(mailboxConnectionsTable.isActive, true));

    for (const conn of connections) {
      try {
        const result = await syncInbox(conn.id);
        if (result.newMessages > 0 || result.syncedOutbound > 0) {
          console.log(`[Scheduler] Synced mailbox ${conn.emailAddress}: ${result.newMessages} inbound, ${result.syncedOutbound} outbound`);
        }
      } catch (err: any) {
        console.error(`[Scheduler] Sync failed for ${conn.emailAddress}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[Scheduler] Outlook sync error:", err.message);
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
    await runOutlookSync();
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

  console.log("[Scheduler] Started — follow-ups every 60s, Outlook sync every 120s");

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
}> {
  const [pending] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledEmailsTable)
    .where(and(
      inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
      lte(scheduledEmailsTable.scheduledFor, new Date()),
    ));

  const sendProvider = await getSetting("primary_send_provider", "resend");
  const outlookConfigured = isOutlookConfigured();
  const conn = outlookConfigured ? await getPrimaryConnection() : null;

  return {
    running: schedulerRunning,
    lastFollowUpRun: lastFollowUpRun > 0 ? new Date(lastFollowUpRun).toISOString() : null,
    lastSyncRun: lastSyncRun > 0 ? new Date(lastSyncRun).toISOString() : null,
    pendingFollowUps: Number(pending?.count || 0),
    sendProvider,
    outlookConfigured,
    outlookConnected: !!conn,
  };
}
