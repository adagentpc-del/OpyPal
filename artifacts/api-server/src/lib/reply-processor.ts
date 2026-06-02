import { db, leadsTable, scheduledEmailsTable, activityTable, inboundEmailsTable, notificationsTable, replyReviewQueueTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";

const REPLY_TO_DOMAIN = "a3visual.com";
const REPLY_TO_BASE = "adeltorre";
const AUTO_PAUSE_ON_REPLY = true;

const AUTO_REPLY_PATTERNS = [
  /out of office/i,
  /auto.?reply/i,
  /automatic reply/i,
  /away from.*office/i,
  /on vacation/i,
  /on leave/i,
  /auto-generated/i,
  /delivery status notification/i,
  /undeliverable/i,
  /mailer-daemon/i,
];

export function generateTaggedReplyTo(leadId: number, scheduledEmailId: number): string {
  return `${REPLY_TO_BASE}+lead_${leadId}_email_${scheduledEmailId}@${REPLY_TO_DOMAIN}`;
}

export function parseReplyToTag(email: string): { leadId: number; scheduledEmailId: number } | null {
  const match = email.match(/\+lead_(\d+)_email_(\d+)@/);
  if (match) {
    return { leadId: parseInt(match[1], 10), scheduledEmailId: parseInt(match[2], 10) };
  }
  const simpleMatch = email.match(/\+lead_(\d+)@/);
  if (simpleMatch) {
    return { leadId: parseInt(simpleMatch[1], 10), scheduledEmailId: 0 };
  }
  return null;
}

const HUMAN_REPLY_PATTERNS = [
  /^(yes|yep|yeah|sure|ok|okay|sounds good|interested|send info|send me|tell me more|let's|let us|can you|please|thanks|thank you)[\s.,!?]*$/i,
  /not interested/i,
  /remove me/i,
  /unsubscribe/i,
  /who is this/i,
  /what is this about/i,
  /schedule a call/i,
  /let's connect/i,
  /forwarded message/i,
  /can we/i,
  /when are you/i,
  /what time/i,
  /i('d| would) like/i,
];

function classifyReply(subject: string, body: string, headers?: string): { isAuto: boolean; confidence: number; classification: "human_reply" | "auto_reply" | "uncertain" } {
  const text = `${subject || ""} ${body || ""} ${headers || ""}`;

  let autoScore = 0;
  let humanScore = 0;

  for (const p of AUTO_REPLY_PATTERNS) {
    if (p.test(text)) autoScore += 15;
  }

  if (/x-auto-response-suppress/i.test(headers || "")) autoScore += 30;
  if (/auto-submitted:\s*auto/i.test(headers || "")) autoScore += 30;
  if (/precedence:\s*(bulk|junk|auto_reply)/i.test(headers || "")) autoScore += 20;
  if (/x-autoreply/i.test(headers || "")) autoScore += 25;

  for (const p of HUMAN_REPLY_PATTERNS) {
    if (p.test(body || "")) humanScore += 15;
  }

  const bodyLen = (body || "").trim().length;
  if (bodyLen > 50 && bodyLen < 5000 && autoScore === 0) humanScore += 10;
  if (bodyLen > 200 && autoScore === 0) humanScore += 10;

  if (/\?/.test(body || "")) humanScore += 5;
  if (/attached|attachment/i.test(body || "")) humanScore += 10;

  const totalSignals = autoScore + humanScore;
  if (totalSignals === 0) {
    return { isAuto: false, confidence: 50, classification: "uncertain" };
  }

  if (autoScore > 20 && humanScore === 0) {
    return { isAuto: true, confidence: Math.min(95, 60 + autoScore), classification: "auto_reply" };
  }

  if (humanScore > 20 && autoScore === 0) {
    return { isAuto: false, confidence: Math.min(95, 60 + humanScore), classification: "human_reply" };
  }

  if (autoScore > humanScore * 2) {
    return { isAuto: true, confidence: Math.min(80, 50 + autoScore - humanScore), classification: "auto_reply" };
  }

  if (humanScore > autoScore * 2) {
    return { isAuto: false, confidence: Math.min(80, 50 + humanScore - autoScore), classification: "human_reply" };
  }

  return { isAuto: false, confidence: 40, classification: "uncertain" };
}

function isAutoReply(subject: string, body: string, headers?: string): boolean {
  const result = classifyReply(subject, body, headers);
  return result.isAuto;
}

interface InboundEmailData {
  senderEmail: string;
  recipientEmail?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  rawHeaders?: string;
  inReplyTo?: string;
  references?: string;
  messageId?: string;
  outlookMessageId?: string;
  // Workspace resolved upstream (e.g. via a workspace's forwarding inbox). Used
  // as the fallback tenant for unmatched mail instead of the hardcoded ws=1.
  workspaceHint?: number | null;
}

interface ProcessResult {
  matched: boolean;
  leadId: number | null;
  matchMethod: string | null;
  isAutoReply: boolean;
  sequencesPaused: number;
  inboundEmailId: number;
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

export async function processInboundEmail(data: InboundEmailData): Promise<ProcessResult> {
  const normalizedSender = extractEmailAddress(data.senderEmail);

  if (data.messageId) {
    const [existing] = await db.select({ id: inboundEmailsTable.id })
      .from(inboundEmailsTable)
      .where(eq(inboundEmailsTable.messageId, data.messageId))
      .limit(1);
    if (existing) {
      return { matched: false, leadId: null, matchMethod: "duplicate", isAutoReply: false, sequencesPaused: 0, inboundEmailId: existing.id };
    }
  }

  const replyClassification = classifyReply(data.subject || "", data.bodyText || "", data.rawHeaders);
  const autoReply = replyClassification.isAuto;
  let leadId: number | null = null;
  let scheduledEmailId: number | null = null;
  let matchMethod: string | null = null;

  if (data.recipientEmail) {
    const tag = parseReplyToTag(data.recipientEmail);
    if (tag) {
      if (tag.scheduledEmailId) {
        const [verifiedEmail] = await db.select({ id: scheduledEmailsTable.id, leadId: scheduledEmailsTable.leadId })
          .from(scheduledEmailsTable)
          .where(and(eq(scheduledEmailsTable.id, tag.scheduledEmailId), eq(scheduledEmailsTable.leadId, tag.leadId)))
          .limit(1);
        if (verifiedEmail) {
          leadId = verifiedEmail.leadId;
          scheduledEmailId = verifiedEmail.id;
          matchMethod = "reply_to_tag";
        }
      }
      if (!leadId) {
        const [verifiedLead] = await db.select({ id: leadsTable.id })
          .from(leadsTable)
          .where(eq(leadsTable.id, tag.leadId))
          .limit(1);
        if (verifiedLead) {
          leadId = verifiedLead.id;
          matchMethod = "reply_to_tag";
        }
      }
    }
  }

  if (!leadId && data.inReplyTo) {
    const emailByResendId = await db.select({ id: scheduledEmailsTable.id, leadId: scheduledEmailsTable.leadId })
      .from(scheduledEmailsTable)
      .where(eq(scheduledEmailsTable.resendMessageId, data.inReplyTo.replace(/[<>]/g, "")))
      .limit(1);
    if (emailByResendId.length > 0) {
      leadId = emailByResendId[0].leadId;
      scheduledEmailId = emailByResendId[0].id;
      matchMethod = "in_reply_to_header";
    }
  }

  if (!leadId && normalizedSender) {
    const leadByEmail = await db.select({ id: leadsTable.id })
      .from(leadsTable)
      .where(eq(leadsTable.email, normalizedSender))
      .limit(1);
    if (leadByEmail.length > 0) {
      leadId = leadByEmail[0].id;
      matchMethod = "sender_email";
    }
  }

  // Derive the workspace server-side from the matched lead. Unmatched inbound
  // mail (no lead) falls back to the upstream workspaceHint (e.g. resolved from
  // a workspace forwarding inbox), then to workspace 1 (A3 Visual) so it is
  // never silently attributed to another tenant.
  let derivedWorkspaceId: number | null = null;
  if (leadId) {
    const [wsRow] = await db.select({ workspaceId: leadsTable.workspaceId })
      .from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    derivedWorkspaceId = wsRow?.workspaceId ?? null;
  }
  const ws = derivedWorkspaceId ?? data.workspaceHint ?? 1;

  const [inboundRecord] = await db.insert(inboundEmailsTable).values({
    workspaceId: ws,
    leadId,
    scheduledEmailId,
    senderEmail: data.senderEmail,
    recipientEmail: data.recipientEmail,
    subject: data.subject,
    bodyText: data.bodyText,
    bodyHtml: data.bodyHtml,
    rawHeaders: data.rawHeaders,
    messageId: data.messageId,
    inReplyTo: data.inReplyTo,
    references: data.references,
    matched: !!leadId,
    matchMethod,
    isAutoReply: autoReply,
    outlookMessageId: data.outlookMessageId || null,
    confidenceScore: replyClassification.confidence,
    classification: replyClassification.classification,
    reviewStatus: replyClassification.classification === "uncertain" ? "pending_review" : "auto_classified",
    processedAt: new Date(),
  }).returning();

  let sequencesPaused = 0;

  if (replyClassification.classification === "uncertain" && leadId) {
    await db.insert(replyReviewQueueTable).values({
      workspaceId: ws,
      leadId,
      inboundEmailId: inboundRecord.id,
      senderEmail: data.senderEmail,
      subject: data.subject || null,
      bodyPreview: (data.bodyText || "").substring(0, 500),
      classification: "uncertain",
      confidenceScore: replyClassification.confidence.toString(),
      recommendedAction: "review",
      status: "pending",
    });

    await db.insert(notificationsTable).values({
      workspaceId: ws,
      type: "review_needed",
      title: "Uncertain reply needs review",
      description: `Reply from ${data.senderEmail}: "${(data.subject || "").substring(0, 100)}"`,
      severity: "warning",
      priority: "high",
      leadId,
    });
  }

  if (leadId) {
    const replyType = autoReply ? "auto_reply_received" : "reply_received";
    const replyDesc = autoReply
      ? `Auto-reply received: "${data.subject || "(no subject)"}"`
      : `Reply received: "${data.subject || "(no subject)"}"`;

    await db.insert(activityTable).values({
      workspaceId: ws,
      type: replyType,
      description: replyDesc,
      leadId,
      metadata: {
        inboundEmailId: inboundRecord.id,
        senderEmail: data.senderEmail,
        subject: data.subject,
        bodyPreview: (data.bodyText || "").substring(0, 500),
        isAutoReply: autoReply,
      },
      createdBy: "system",
    });

    if (replyClassification.classification === "human_reply") {
      await db.update(leadsTable).set({
        lastRepliedAt: new Date(),
        engagementStatus: "engaged",
        lastEngagementType: "reply",
        lastEngagementAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(leadsTable.id, leadId));

      if (scheduledEmailId) {
        await db.update(scheduledEmailsTable).set({
          repliedAt: new Date(),
          replyDetected: true,
          updatedAt: new Date(),
        }).where(eq(scheduledEmailsTable.id, scheduledEmailId));
      } else {
        const recentSent = await db.select({ id: scheduledEmailsTable.id })
          .from(scheduledEmailsTable)
          .where(and(
            eq(scheduledEmailsTable.leadId, leadId),
            eq(scheduledEmailsTable.status, "sent")
          ))
          .orderBy(desc(scheduledEmailsTable.sentAt))
          .limit(1);
        if (recentSent.length > 0) {
          await db.update(scheduledEmailsTable).set({
            repliedAt: new Date(),
            replyDetected: true,
            updatedAt: new Date(),
          }).where(eq(scheduledEmailsTable.id, recentSent[0].id));
        }
      }

      if (AUTO_PAUSE_ON_REPLY) {
        sequencesPaused = await pauseSequencesForLead(leadId);
      }

      await db.insert(notificationsTable).values({
        workspaceId: ws,
        type: "reply_received",
        title: `Reply from ${data.senderEmail}`,
        description: `${data.subject || "(no subject)"}: ${(data.bodyText || "").substring(0, 200)}`,
        leadId,
        metadata: { inboundEmailId: inboundRecord.id },
      });
    } else if (replyClassification.classification === "uncertain") {
      await db.insert(notificationsTable).values({
        workspaceId: ws,
        type: "reply_received",
        title: `Uncertain reply from ${data.senderEmail}`,
        description: `Queued for review: "${data.subject || "(no subject)"}"`,
        leadId,
        metadata: { inboundEmailId: inboundRecord.id, needsReview: true },
      });
    }
  }

  return {
    matched: !!leadId,
    leadId,
    matchMethod,
    isAutoReply: autoReply,
    sequencesPaused,
    inboundEmailId: inboundRecord.id,
  };
}

async function pauseSequencesForLead(leadId: number): Promise<number> {
  const futureEmails = await db.select({
    id: scheduledEmailsTable.id,
    sequenceId: scheduledEmailsTable.sequenceId,
  })
    .from(scheduledEmailsTable)
    .where(and(
      eq(scheduledEmailsTable.leadId, leadId),
      inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
    ));

  if (futureEmails.length === 0) return 0;

  const emailIds = futureEmails.map(e => e.id);
  const sequenceIds = [...new Set(futureEmails.filter(e => e.sequenceId).map(e => e.sequenceId!))];

  await db.update(scheduledEmailsTable).set({
    status: "paused",
    pauseReason: "reply_received",
    pausedAt: new Date(),
    updatedAt: new Date(),
  }).where(inArray(scheduledEmailsTable.id, emailIds));

  if (sequenceIds.length > 0) {
    const [wsRow] = await db.select({ workspaceId: leadsTable.workspaceId })
      .from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    await db.insert(activityTable).values({
      workspaceId: wsRow?.workspaceId ?? 1,
      type: "sequence_paused",
      description: `Sequence paused — reply received (${futureEmails.length} future email${futureEmails.length !== 1 ? "s" : ""} paused)`,
      leadId,
      metadata: { sequenceIds, pausedEmailCount: futureEmails.length, reason: "reply_received" },
      createdBy: "system",
    });
  }

  return futureEmails.length;
}

export async function getConversationThread(leadId: number): Promise<any[]> {
  const outbound = await db.select({
    id: scheduledEmailsTable.id,
    subject: scheduledEmailsTable.subject,
    body: scheduledEmailsTable.body,
    sentAt: scheduledEmailsTable.sentAt,
    status: scheduledEmailsTable.status,
    replyDetected: scheduledEmailsTable.replyDetected,
    repliedAt: scheduledEmailsTable.repliedAt,
    fromEmail: scheduledEmailsTable.fromEmail,
    replyTo: scheduledEmailsTable.replyTo,
    createdAt: scheduledEmailsTable.createdAt,
  })
    .from(scheduledEmailsTable)
    .where(and(
      eq(scheduledEmailsTable.leadId, leadId),
      eq(scheduledEmailsTable.status, "sent")
    ))
    .orderBy(desc(scheduledEmailsTable.sentAt));

  const inbound = await db.select()
    .from(inboundEmailsTable)
    .where(eq(inboundEmailsTable.leadId, leadId))
    .orderBy(desc(inboundEmailsTable.createdAt));

  const thread: any[] = [];

  for (const email of outbound) {
    thread.push({
      type: "outbound",
      id: email.id,
      subject: email.subject,
      body: email.body,
      timestamp: email.sentAt || email.createdAt,
      from: email.fromEmail,
      replyDetected: email.replyDetected,
      repliedAt: email.repliedAt,
    });
  }

  for (const email of inbound) {
    thread.push({
      type: "inbound",
      id: email.id,
      subject: email.subject,
      body: email.bodyText,
      timestamp: email.createdAt,
      from: email.senderEmail,
      isAutoReply: email.isAutoReply,
      matched: email.matched,
    });
  }

  thread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return thread;
}

export async function logManualReply(leadId: number, subject: string, body: string, senderEmail?: string): Promise<ProcessResult> {
  const [lead] = await db.select({ email: leadsTable.email })
    .from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);

  return processInboundEmail({
    senderEmail: senderEmail || lead?.email || "manual@entry",
    recipientEmail: `adeltorre+lead_${leadId}_email_0@a3visual.com`,
    subject,
    bodyText: body,
  });
}
