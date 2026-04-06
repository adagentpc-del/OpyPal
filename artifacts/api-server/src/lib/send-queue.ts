import { db, scheduledEmailsTable, activityTable, bulkSendCampaignsTable, leadsTable } from "@workspace/db";
import { eq, and, inArray, asc, lte, or, sql } from "drizzle-orm";
import { sendEmail } from "./resend";
import { generateTaggedReplyTo } from "./reply-processor";

const DEFAULT_SENDS_PER_HOUR = 50;
const DEFAULT_DELAY_BETWEEN_SENDS_MS = 5000;
const DEFAULT_BATCH_SIZE = 5;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE_MS = 30000;
const RETRY_POLL_INTERVAL_MS = 15000;

const TEMPORARY_ERROR_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /429/,
  /timeout/i,
  /ETIMEDOUT/,
  /ECONNRESET/,
  /temporary/i,
  /service unavailable/i,
  /503/,
  /502/,
];

function isTemporaryError(error: string): boolean {
  return TEMPORARY_ERROR_PATTERNS.some(pattern => pattern.test(error));
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface QueueConfig {
  sendsPerHour: number;
  delayBetweenSendsMs: number;
  batchSize: number;
}

const activeQueues = new Map<number, { abort: boolean }>();

export function getQueueStatus(campaignId: number): { active: boolean } {
  return { active: activeQueues.has(campaignId) };
}

export function abortQueue(campaignId: number): boolean {
  const q = activeQueues.get(campaignId);
  if (q) {
    q.abort = true;
    return true;
  }
  return false;
}

export async function getGlobalQueueStatus(): Promise<{
  activeCampaigns: number[];
  totalQueued: number;
  totalProcessing: number;
}> {
  const activeCampaigns = Array.from(activeQueues.keys());
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledEmailsTable)
    .where(inArray(scheduledEmailsTable.status, ["queued", "retry_pending"]));
  return {
    activeCampaigns,
    totalQueued: Number(result?.count || 0),
    totalProcessing: activeCampaigns.length,
  };
}

async function loadCampaignCounters(campaignId: number): Promise<{ totalSent: number; totalFailed: number; totalRetried: number }> {
  const [campaign] = await db.select({
    totalSent: bulkSendCampaignsTable.totalSent,
    totalFailed: bulkSendCampaignsTable.totalFailed,
    totalRetried: bulkSendCampaignsTable.totalRetried,
  }).from(bulkSendCampaignsTable).where(eq(bulkSendCampaignsTable.id, campaignId));
  return {
    totalSent: campaign?.totalSent || 0,
    totalFailed: campaign?.totalFailed || 0,
    totalRetried: campaign?.totalRetried || 0,
  };
}

async function hasRemainingWork(campaignId: number): Promise<{ hasQueued: boolean; hasRetryPending: boolean; nextRetryAt: Date | null }> {
  const [queued] = await db.select({ count: sql<number>`count(*)` })
    .from(scheduledEmailsTable)
    .where(and(eq(scheduledEmailsTable.campaignId, campaignId), eq(scheduledEmailsTable.status, "queued")));

  const retryPending = await db.select({ scheduledFor: scheduledEmailsTable.scheduledFor })
    .from(scheduledEmailsTable)
    .where(and(eq(scheduledEmailsTable.campaignId, campaignId), eq(scheduledEmailsTable.status, "retry_pending")))
    .orderBy(asc(scheduledEmailsTable.scheduledFor))
    .limit(1);

  return {
    hasQueued: Number(queued?.count || 0) > 0,
    hasRetryPending: retryPending.length > 0,
    nextRetryAt: retryPending[0]?.scheduledFor || null,
  };
}

export async function startQueueProcessor(
  campaignId: number,
  config?: Partial<QueueConfig>
): Promise<void> {
  if (activeQueues.has(campaignId)) {
    console.log(`[SendQueue] Campaign ${campaignId} already processing`);
    return;
  }

  const queueState = { abort: false };
  activeQueues.set(campaignId, queueState);

  const qConfig: QueueConfig = {
    sendsPerHour: config?.sendsPerHour || DEFAULT_SENDS_PER_HOUR,
    delayBetweenSendsMs: config?.delayBetweenSendsMs || DEFAULT_DELAY_BETWEEN_SENDS_MS,
    batchSize: config?.batchSize || DEFAULT_BATCH_SIZE,
  };

  const minDelayFromRate = Math.ceil(3600000 / qConfig.sendsPerHour);
  const effectiveDelay = Math.max(qConfig.delayBetweenSendsMs, minDelayFromRate);

  console.log(`[SendQueue] Starting campaign ${campaignId}: ${qConfig.sendsPerHour}/hr, ${effectiveDelay}ms delay, batch ${qConfig.batchSize}`);

  await db.update(bulkSendCampaignsTable).set({
    status: "sending",
    queueStartedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(bulkSendCampaignsTable.id, campaignId));

  const counters = await loadCampaignCounters(campaignId);
  let totalSent = counters.totalSent;
  let totalFailed = counters.totalFailed;
  let totalRetried = counters.totalRetried;
  let fatalError = false;

  try {
    while (!queueState.abort) {
      const batch = await db.select()
        .from(scheduledEmailsTable)
        .where(and(
          eq(scheduledEmailsTable.campaignId, campaignId),
          or(
            eq(scheduledEmailsTable.status, "queued"),
            and(
              eq(scheduledEmailsTable.status, "retry_pending"),
              lte(scheduledEmailsTable.scheduledFor, new Date())
            )
          )
        ))
        .orderBy(asc(scheduledEmailsTable.queuePosition), asc(scheduledEmailsTable.id))
        .limit(qConfig.batchSize);

      if (batch.length === 0) {
        const remaining = await hasRemainingWork(campaignId);
        if (!remaining.hasQueued && !remaining.hasRetryPending) {
          break;
        }
        if (remaining.hasRetryPending && remaining.nextRetryAt) {
          const waitMs = Math.max(remaining.nextRetryAt.getTime() - Date.now(), RETRY_POLL_INTERVAL_MS);
          console.log(`[SendQueue] Campaign ${campaignId}: waiting ${Math.round(waitMs / 1000)}s for next retry`);
          await sleep(Math.min(waitMs, RETRY_POLL_INTERVAL_MS));
          continue;
        }
        await sleep(RETRY_POLL_INTERVAL_MS);
        continue;
      }

      for (const email of batch) {
        if (queueState.abort) break;

        await db.update(scheduledEmailsTable).set({
          status: "sending",
          lastAttemptAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(scheduledEmailsTable.id, email.id));

        const textBody = email.body;
        const htmlBody = textBody
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>")
          .replace(/^/, "<p>")
          .replace(/$/, "</p>");

        const taggedReplyTo = generateTaggedReplyTo(email.leadId, email.id);
        const result = await sendEmail({
          to: (await getLeadEmail(email.leadId)),
          from: email.fromEmail || undefined,
          subject: email.subject,
          html: htmlBody,
          text: textBody,
          replyTo: taggedReplyTo,
        });

        if (result.success) {
          await db.update(scheduledEmailsTable).set({
            status: "sent",
            sentAt: new Date(),
            resendMessageId: result.id,
            sendError: null,
            updatedAt: new Date(),
          }).where(eq(scheduledEmailsTable.id, email.id));

          await db.insert(activityTable).values({
            type: "email_sent",
            description: `Email sent: "${email.subject}"`,
            leadId: email.leadId,
            metadata: { campaignId, resendId: result.id, queuePosition: email.queuePosition },
            relatedTemplateId: email.templateId,
            relatedSequenceId: email.sequenceId,
            createdBy: "system",
          });

          await db.update(leadsTable).set({
            lastContactDate: new Date().toISOString().split("T")[0],
            status: "Contacted",
            updatedAt: new Date(),
          }).where(eq(leadsTable.id, email.leadId));

          totalSent++;
          console.log(`[SendQueue] Sent email ${email.id} to lead ${email.leadId} (pos ${email.queuePosition})`);
        } else {
          const retryCount = (email.retryCount || 0) + 1;
          const canRetry = isTemporaryError(result.error || "") && retryCount <= (email.maxRetries || MAX_RETRIES);

          if (canRetry) {
            const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount - 1);
            const retryAt = new Date(Date.now() + backoffMs);

            await db.update(scheduledEmailsTable).set({
              status: "retry_pending",
              retryCount,
              sendError: result.error,
              scheduledFor: retryAt,
              updatedAt: new Date(),
            }).where(eq(scheduledEmailsTable.id, email.id));

            totalRetried++;
            console.log(`[SendQueue] Retry ${retryCount} for email ${email.id}: ${result.error} (next at ${retryAt.toISOString()})`);
          } else {
            await db.update(scheduledEmailsTable).set({
              status: "failed",
              retryCount,
              sendError: result.error,
              updatedAt: new Date(),
            }).where(eq(scheduledEmailsTable.id, email.id));

            await db.insert(activityTable).values({
              type: "email_failed",
              description: `Email failed: ${result.error}`,
              leadId: email.leadId,
              metadata: { campaignId, error: result.error, retries: retryCount },
              relatedTemplateId: email.templateId,
              relatedSequenceId: email.sequenceId,
              createdBy: "system",
            });

            totalFailed++;
            console.log(`[SendQueue] Failed email ${email.id}: ${result.error}`);
          }
        }

        if (!queueState.abort && batch.indexOf(email) < batch.length - 1) {
          await sleep(effectiveDelay);
        }
      }

      await db.update(bulkSendCampaignsTable).set({
        totalSent,
        totalFailed,
        totalRetried,
        updatedAt: new Date(),
      }).where(eq(bulkSendCampaignsTable.id, campaignId));

      if (!queueState.abort) {
        await sleep(effectiveDelay);
      }
    }
  } catch (err: any) {
    fatalError = true;
    console.error(`[SendQueue] Fatal error in campaign ${campaignId}:`, err.message);
  } finally {
    let finalStatus: string;
    if (fatalError) {
      finalStatus = "failed";
    } else if (queueState.abort) {
      finalStatus = "paused";
    } else {
      finalStatus = "completed";
    }

    await db.update(bulkSendCampaignsTable).set({
      totalSent,
      totalFailed,
      totalRetried,
      status: finalStatus,
      queueCompletedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(bulkSendCampaignsTable.id, campaignId));

    activeQueues.delete(campaignId);
    console.log(`[SendQueue] Campaign ${campaignId} finished: ${totalSent} sent, ${totalFailed} failed, ${totalRetried} retried, status=${finalStatus}`);
  }
}

async function getLeadEmail(leadId: number): Promise<string> {
  const [lead] = await db.select({ email: leadsTable.email })
    .from(leadsTable)
    .where(eq(leadsTable.id, leadId));
  return lead?.email || "";
}
