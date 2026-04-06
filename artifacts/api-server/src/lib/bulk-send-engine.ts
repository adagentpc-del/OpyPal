import { db, leadsTable, scheduledEmailsTable, activityTable, bulkSendCampaignsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { sendEmail } from "./resend";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

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
  sequenceId?: number
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
        eq(scheduledEmailsTable.sequenceId, sequenceId),
        inArray(scheduledEmailsTable.status, ["scheduled", "paused"])
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

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function addBusinessDaysToDate(startDate: Date, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d;
}

export interface BulkSendResult {
  campaignId: number;
  totalSent: number;
  totalScheduled: number;
  totalFailed: number;
  totalSkipped: number;
  results: { leadId: number; companyName: string; status: string; error?: string; resendId?: string }[];
}

export async function executeBulkSend(req: BulkSendRequest): Promise<BulkSendResult> {
  const [campaign] = await db.insert(bulkSendCampaignsTable).values({
    name: req.campaignName || `Bulk send ${new Date().toLocaleDateString()}`,
    templateId: req.templateId,
    templateName: req.templateName,
    sequenceId: req.sequenceId,
    sequenceName: req.sequenceName,
    sender: req.senderName || "Alyssa",
    senderEmail: req.senderEmail,
    totalSelected: req.recipients.length,
    status: "processing",
  }).returning();

  const results: BulkSendResult["results"] = [];
  let totalSent = 0, totalScheduled = 0, totalFailed = 0;

  const batches: BulkRecipient[][] = [];
  for (let i = 0; i < req.recipients.length; i += BATCH_SIZE) {
    batches.push(req.recipients.slice(i, i + BATCH_SIZE));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(BATCH_DELAY_MS);

    const batch = batches[bi];
    const batchPromises = batch.map(async (lead) => {
      const personalizedSubject = personalize(req.subject, lead);
      const personalizedBody = personalize(req.body, lead);
      const htmlBody = textToHtml(personalizedBody);

      if (req.mode === "send_now") {
        const sendResult = await sendEmail({
          to: lead.email,
          from: req.senderEmail,
          subject: personalizedSubject,
          html: htmlBody,
          text: personalizedBody,
        });

        const [scheduledRow] = await db.insert(scheduledEmailsTable).values({
          leadId: lead.leadId,
          templateId: req.templateId,
          subject: personalizedSubject,
          body: personalizedBody,
          scheduledFor: new Date(),
          status: sendResult.success ? "sent" : "failed",
          sequenceId: req.sequenceId,
          sequenceStepNumber: 1,
          source: "bulk_send",
          campaignId: campaign.id,
          resendMessageId: sendResult.id || undefined,
          sentAt: sendResult.success ? new Date() : undefined,
        }).returning();

        await db.insert(activityTable).values({
          type: sendResult.success ? "bulk_email_sent" : "bulk_email_failed",
          description: sendResult.success
            ? `Bulk email sent: "${personalizedSubject}"`
            : `Bulk email failed: ${sendResult.error}`,
          leadId: lead.leadId,
          metadata: { campaignId: campaign.id, resendId: sendResult.id },
          relatedTemplateId: req.templateId,
          relatedSequenceId: req.sequenceId,
          createdBy: "system",
        });

        if (sendResult.success) {
          totalSent++;
          results.push({ leadId: lead.leadId, companyName: lead.companyName, status: "sent", resendId: sendResult.id });
        } else {
          totalFailed++;
          results.push({ leadId: lead.leadId, companyName: lead.companyName, status: "failed", error: sendResult.error });
        }
      } else {
        const schedDate = req.scheduledFor ? new Date(req.scheduledFor) : new Date();
        await db.insert(scheduledEmailsTable).values({
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
        });

        await db.insert(activityTable).values({
          type: "bulk_email_scheduled",
          description: `Bulk email scheduled: "${personalizedSubject}"`,
          leadId: lead.leadId,
          metadata: { campaignId: campaign.id },
          relatedTemplateId: req.templateId,
          relatedSequenceId: req.sequenceId,
          createdBy: "system",
        });

        totalScheduled++;
        results.push({ leadId: lead.leadId, companyName: lead.companyName, status: "scheduled" });
      }

      if (req.activateSequence && req.sequenceSteps && req.sequenceSteps.length > 1) {
        const startDate = req.mode === "schedule" && req.scheduledFor ? new Date(req.scheduledFor) : new Date();
        for (const step of req.sequenceSteps.slice(1)) {
          const delayDays = step.delayDays || 0;
          const stepDate = addBusinessDaysToDate(startDate, delayDays);
          const stepSubject = personalize(step.subject || `Follow-up Step ${step.stepNumber}`, lead);
          const stepBody = personalize(step.body || "", lead);
          await db.insert(scheduledEmailsTable).values({
            leadId: lead.leadId,
            subject: stepSubject,
            body: stepBody,
            scheduledFor: stepDate,
            status: "scheduled",
            sequenceId: req.sequenceId,
            sequenceStepNumber: step.stepNumber,
            source: "bulk_sequence",
            campaignId: campaign.id,
          });
        }

        await db.insert(activityTable).values({
          type: "bulk_sequence_enrolled",
          description: `Enrolled in sequence: ${req.sequenceName || "Unnamed"} (${req.sequenceSteps.length} steps)`,
          leadId: lead.leadId,
          metadata: { campaignId: campaign.id, sequenceId: req.sequenceId },
          relatedSequenceId: req.sequenceId,
          createdBy: "system",
        });
      }

      await db.update(leadsTable).set({
        lastContactDate: new Date().toISOString().split("T")[0],
        status: "Contacted",
        updatedAt: new Date(),
      }).where(eq(leadsTable.id, lead.leadId));
    });

    await Promise.allSettled(batchPromises);
  }

  const skippedCount = req.totalSkipped || 0;

  await db.update(bulkSendCampaignsTable).set({
    totalSent,
    totalScheduled,
    totalFailed,
    totalSkipped: skippedCount,
    status: totalFailed > 0 && totalSent === 0 ? "failed" : "completed",
    updatedAt: new Date(),
  }).where(eq(bulkSendCampaignsTable.id, campaign.id));

  return { campaignId: campaign.id, totalSent, totalScheduled, totalFailed, totalSkipped: skippedCount, results };
}
