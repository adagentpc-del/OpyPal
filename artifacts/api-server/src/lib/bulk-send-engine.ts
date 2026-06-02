import { db, leadsTable, scheduledEmailsTable, activityTable, bulkSendCampaignsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { startQueueProcessor } from "./send-queue";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BulkRecipient {
  leadId: number;
  companyName: string;
  contactName: string;
  email: string;
  title?: string;
  location?: string;
  industry?: string;
  isUnsubscribed?: boolean;
  isBounced?: boolean;
}

interface BulkSendRequest {
  recipients: BulkRecipient[];
  templateId?: number;
  templateName?: string;
  subject: string;
  body: string;
  sequenceId?: number;
  sequenceName?: string;
  sequenceSteps?: any[];
  activateSequence?: boolean;
  mode: "send_now" | "schedule";
  scheduledFor?: string;
  campaignName?: string;
  senderEmail?: string;
  senderName?: string;
  replyTo?: string;
  sendsPerHour?: number;
  delayBetweenSendsMs?: number;
  batchSize?: number;
  totalSkipped?: number;
}

export interface SuppressionReport {
  ready: BulkRecipient[];
  skippedNoEmail: BulkRecipient[];
  skippedInvalidEmail: BulkRecipient[];
  skippedUnsubscribed: BulkRecipient[];
  skippedBounced: BulkRecipient[];
  skippedDuplicateEmail: BulkRecipient[];
  skippedDuplicateEnrollment: BulkRecipient[];
}

export async function validateRecipients(
  recipients: BulkRecipient[],
  sequenceId?: number,
  workspaceId = 1
): Promise<SuppressionReport> {
  const report: SuppressionReport = {
    ready: [],
    skippedNoEmail: [],
    skippedInvalidEmail: [],
    skippedUnsubscribed: [],
    skippedBounced: [],
    skippedDuplicateEmail: [],
    skippedDuplicateEnrollment: [],
  };

  const seenEmails = new Set<string>();

  let activeEnrollments = new Set<number>();
  if (sequenceId) {
    const existing = await db.select({ leadId: scheduledEmailsTable.leadId })
      .from(scheduledEmailsTable)
      .where(and(
        eq(scheduledEmailsTable.workspaceId, workspaceId),
        eq(scheduledEmailsTable.sequenceId, sequenceId),
        inArray(scheduledEmailsTable.status, ["scheduled", "paused", "queued"])
      ));
    activeEnrollments = new Set(existing.map(e => e.leadId));
  }

  for (const r of recipients) {
    if (!r.email) { report.skippedNoEmail.push(r); continue; }
    if (!EMAIL_REGEX.test(r.email)) { report.skippedInvalidEmail.push(r); continue; }
    if (r.isUnsubscribed) { report.skippedUnsubscribed.push(r); continue; }
    if (r.isBounced) { report.skippedBounced.push(r); continue; }

    const emailLower = r.email.toLowerCase();
    if (seenEmails.has(emailLower)) { report.skippedDuplicateEmail.push(r); continue; }
    seenEmails.add(emailLower);

    if (sequenceId && activeEnrollments.has(r.leadId)) { report.skippedDuplicateEnrollment.push(r); continue; }

    report.ready.push(r);
  }

  return report;
}

function personalize(template: string, lead: BulkRecipient): string {
  const firstName = (lead.contactName || "").split(" ")[0] || lead.contactName || "";
  return template
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Contact Name\]/gi, lead.contactName || "")
    .replace(/\[Company Name\]/gi, lead.companyName || "")
    .replace(/\[Name\]/gi, lead.contactName || "")
    .replace(/\[venue \/ agency\]/gi, lead.companyName || "")
    .replace(/\[Location\]/gi, lead.location || "")
    .replace(/\[Title\]/gi, lead.title || "")
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{greeting\}\}/gi, `Hi ${firstName},`)
    .replace(/\{\{company\}\}/gi, lead.companyName || "")
    .replace(/\{\{title\}\}/gi, lead.title || "")
    .replace(/\{\{location\}\}/gi, lead.location || "")
    .replace(/\{\{intent_signal\}\}/gi, "")
    .replace(/\{\{intent_line\}\}/gi, "")
    .replace(/\{\{company_line\}\}/gi, "");
}

function addBusinessDaysToDate(startDate: Date, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d;
}

export interface BulkSendResult {
  campaignId: number;
  totalQueued: number;
  totalScheduled: number;
  totalSkipped: number;
  mode: string;
  queueConfig: { sendsPerHour: number; delayBetweenSendsMs: number; batchSize: number };
  recipients: { leadId: number; companyName: string; status: string; queuePosition?: number }[];
}

export async function executeBulkSend(req: BulkSendRequest, workspaceId = 1): Promise<BulkSendResult> {
  const sendsPerHour = req.sendsPerHour || 50;
  const delayBetweenSendsMs = req.delayBetweenSendsMs || 5000;
  const batchSize = req.batchSize || 5;

  const [campaign] = await db.insert(bulkSendCampaignsTable).values({
    workspaceId,
    name: req.campaignName || `Bulk send ${new Date().toLocaleDateString()}`,
    templateId: req.templateId,
    templateName: req.templateName,
    sequenceId: req.sequenceId,
    sequenceName: req.sequenceName,
    sender: req.senderName || "Alyssa",
    senderEmail: req.senderEmail,
    replyTo: req.replyTo,
    sendsPerHour,
    delayBetweenSendsMs,
    batchSize,
    totalSelected: req.recipients.length + (req.totalSkipped || 0),
    totalSkipped: req.totalSkipped || 0,
    status: req.mode === "send_now" ? "queued" : "scheduled",
  }).returning();

  const recipientResults: BulkSendResult["recipients"] = [];
  let totalQueued = 0;
  let totalScheduled = 0;

  for (let i = 0; i < req.recipients.length; i++) {
    const lead = req.recipients[i];
    const personalizedSubject = personalize(req.subject, lead);
    const personalizedBody = personalize(req.body, lead);
    const queuePosition = i + 1;

    if (req.mode === "send_now") {
      await db.insert(scheduledEmailsTable).values({
        workspaceId,
        leadId: lead.leadId,
        templateId: req.templateId,
        subject: personalizedSubject,
        body: personalizedBody,
        scheduledFor: new Date(),
        status: "queued",
        sequenceId: req.sequenceId,
        sequenceStepNumber: 1,
        source: "bulk_send",
        campaignId: campaign.id,
        queuedAt: new Date(),
        queuePosition,
        fromEmail: req.senderEmail,
        replyTo: req.replyTo,
        retryCount: 0,
        maxRetries: 3,
      });
      totalQueued++;
      recipientResults.push({ leadId: lead.leadId, companyName: lead.companyName, status: "queued", queuePosition });
    } else {
      const schedDate = req.scheduledFor ? new Date(req.scheduledFor) : new Date();
      await db.insert(scheduledEmailsTable).values({
        workspaceId,
        leadId: lead.leadId,
        templateId: req.templateId,
        subject: personalizedSubject,
        body: personalizedBody,
        scheduledFor: schedDate,
        status: "scheduled",
        sequenceId: req.sequenceId,
        sequenceStepNumber: 1,
        source: "bulk_send",
        campaignId: campaign.id,
        fromEmail: req.senderEmail,
        replyTo: req.replyTo,
      });

      await db.insert(activityTable).values({
        workspaceId,
        type: "bulk_email_scheduled",
        description: `Bulk email scheduled: "${personalizedSubject}"`,
        leadId: lead.leadId,
        metadata: { campaignId: campaign.id },
        relatedTemplateId: req.templateId,
        relatedSequenceId: req.sequenceId,
        createdBy: "system",
      });

      totalScheduled++;
      recipientResults.push({ leadId: lead.leadId, companyName: lead.companyName, status: "scheduled" });
    }

    if (req.activateSequence && req.sequenceSteps && req.sequenceSteps.length > 1) {
      const startDate = req.mode === "schedule" && req.scheduledFor ? new Date(req.scheduledFor) : new Date();
      for (const step of req.sequenceSteps.slice(1)) {
        const delayDays = step.delayDays || 0;
        const stepDate = addBusinessDaysToDate(startDate, delayDays);
        const stepSubject = personalize(step.subject || `Follow-up Step ${step.stepNumber}`, lead);
        const stepBody = personalize(step.body || "", lead);
        await db.insert(scheduledEmailsTable).values({
          workspaceId,
          leadId: lead.leadId,
          subject: stepSubject,
          body: stepBody,
          scheduledFor: stepDate,
          status: "scheduled",
          sequenceId: req.sequenceId,
          sequenceStepNumber: step.stepNumber,
          source: "bulk_sequence",
          campaignId: campaign.id,
          fromEmail: req.senderEmail,
          replyTo: req.replyTo,
        });
      }

      await db.insert(activityTable).values({
        workspaceId,
        type: "bulk_sequence_enrolled",
        description: `Enrolled in sequence: ${req.sequenceName || "Unnamed"} (${req.sequenceSteps.length} steps)`,
        leadId: lead.leadId,
        metadata: { campaignId: campaign.id, sequenceId: req.sequenceId },
        relatedSequenceId: req.sequenceId,
        createdBy: "system",
      });
    }
  }

  await db.update(bulkSendCampaignsTable).set({
    totalQueued,
    totalScheduled,
    updatedAt: new Date(),
  }).where(eq(bulkSendCampaignsTable.id, campaign.id));

  if (req.mode === "send_now" && totalQueued > 0) {
    startQueueProcessor(campaign.id, { sendsPerHour, delayBetweenSendsMs, batchSize })
      .catch(err => console.error(`[BulkSendEngine] Queue processor error for campaign ${campaign.id}:`, err));
  }

  return {
    campaignId: campaign.id,
    totalQueued,
    totalScheduled,
    totalSkipped: req.totalSkipped || 0,
    mode: req.mode,
    queueConfig: { sendsPerHour, delayBetweenSendsMs, batchSize },
    recipients: recipientResults,
  };
}
