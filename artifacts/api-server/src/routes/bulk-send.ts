import { Router, type IRouter } from "express";
import { db, bulkSendCampaignsTable, scheduledEmailsTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";
import { validateRecipients, executeBulkSend } from "../lib/bulk-send-engine";
import { checkResendConnection, DEFAULT_REPLY_TO, DEFAULT_FROM_EMAIL } from "../lib/resend";
import { getQueueStatus, abortQueue, getGlobalQueueStatus, startQueueProcessor } from "../lib/send-queue";

const router: IRouter = Router();

router.get("/bulk-send/check-connection", async (_req, res) => {
  try {
    const status = await checkResendConnection();
    res.json({ ...status, defaultReplyTo: DEFAULT_REPLY_TO });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

router.get("/bulk-send/sender-config", async (_req, res) => {
  try {
    const connStatus = await checkResendConnection();
    res.json({
      connected: connStatus.connected,
      fromEmail: connStatus.fromEmail || DEFAULT_FROM_EMAIL,
      defaultReplyTo: DEFAULT_REPLY_TO,
      sendsPerHour: 50,
      delayBetweenSendsMs: 5000,
      batchSize: 5,
      maxRetries: 3,
      error: connStatus.error,
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, message: err.message });
  }
});

router.post("/bulk-send/validate", requireRole("operator"), async (req, res) => {
  try {
    const { recipients, sequenceId } = req.body;
    if (!recipients || !Array.isArray(recipients)) return res.status(400).json({ message: "recipients array required" });
    const report = await validateRecipients(recipients, sequenceId, req.workspaceId!);
    res.json({
      ready: report.ready.length,
      skippedNoEmail: report.skippedNoEmail.length,
      skippedInvalidEmail: report.skippedInvalidEmail.length,
      skippedUnsubscribed: report.skippedUnsubscribed.length,
      skippedBounced: report.skippedBounced.length,
      skippedDuplicateEmail: report.skippedDuplicateEmail.length,
      skippedDuplicateEnrollment: report.skippedDuplicateEnrollment.length,
      totalSkipped: report.skippedNoEmail.length + report.skippedInvalidEmail.length + report.skippedUnsubscribed.length + report.skippedBounced.length + report.skippedDuplicateEmail.length + report.skippedDuplicateEnrollment.length,
      readyRecipients: report.ready,
      skippedDetails: {
        noEmail: report.skippedNoEmail.map(r => ({ leadId: r.leadId, companyName: r.companyName })),
        invalidEmail: report.skippedInvalidEmail.map(r => ({ leadId: r.leadId, companyName: r.companyName, email: r.email })),
        unsubscribed: report.skippedUnsubscribed.map(r => ({ leadId: r.leadId, companyName: r.companyName })),
        bounced: report.skippedBounced.map(r => ({ leadId: r.leadId, companyName: r.companyName })),
        duplicateEmail: report.skippedDuplicateEmail.map(r => ({ leadId: r.leadId, companyName: r.companyName, email: r.email })),
        duplicateEnrollment: report.skippedDuplicateEnrollment.map(r => ({ leadId: r.leadId, companyName: r.companyName })),
      },
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/bulk-send/execute", requireRole("manager"), async (req, res) => {
  try {
    const { recipients, templateId, templateName, subject, body, sequenceId, sequenceName, sequenceSteps, activateSequence, mode, scheduledFor, campaignName, senderEmail, senderName, replyTo, sendsPerHour, delayBetweenSendsMs, batchSize } = req.body;
    if (!recipients?.length) return res.status(400).json({ message: "No recipients" });
    if (!subject || !body) return res.status(400).json({ message: "Subject and body required" });

    if (mode === "send_now") {
      const connCheck = await checkResendConnection();
      if (!connCheck.connected) return res.status(400).json({ message: `Resend not configured: ${connCheck.error}` });
    }

    const report = await validateRecipients(recipients, sequenceId, req.workspaceId!);
    const totalSkipped = report.skippedNoEmail.length + report.skippedInvalidEmail.length +
      report.skippedUnsubscribed.length + report.skippedBounced.length +
      report.skippedDuplicateEmail.length + report.skippedDuplicateEnrollment.length;

    if (report.ready.length === 0) {
      return res.status(400).json({ message: "All recipients were suppressed. No emails to send.", totalSkipped });
    }

    const result = await executeBulkSend({
      recipients: report.ready, templateId, templateName, subject, body,
      sequenceId, sequenceName, sequenceSteps, activateSequence,
      mode: mode || "send_now", scheduledFor, campaignName,
      senderEmail, senderName,
      replyTo: replyTo || DEFAULT_REPLY_TO,
      sendsPerHour: sendsPerHour || 50,
      delayBetweenSendsMs: delayBetweenSendsMs || 5000,
      batchSize: batchSize || 5,
      totalSkipped,
    }, req.workspaceId!);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bulk-send/campaigns", async (req, res) => {
  try {
    const campaigns = await db.select().from(bulkSendCampaignsTable)
      .where(eq(bulkSendCampaignsTable.workspaceId, req.workspaceId!))
      .orderBy(desc(bulkSendCampaignsTable.createdAt))
      .limit(Number(req.query.limit) || 50);
    res.json(campaigns);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/bulk-send/campaigns/:id", async (req, res) => {
  try {
    const [campaign] = await db.select().from(bulkSendCampaignsTable)
      .where(and(eq(bulkSendCampaignsTable.id, Number(req.params.id)), eq(bulkSendCampaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const queueStatus = getQueueStatus(campaign.id);
    res.json({ ...campaign, queueActive: queueStatus.active });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/bulk-send/campaigns/:id/progress", async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const [campaign] = await db.select().from(bulkSendCampaignsTable)
      .where(and(eq(bulkSendCampaignsTable.id, campaignId), eq(bulkSendCampaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const queueStatus = getQueueStatus(campaignId);

    const sentEmails = await db.select({
      id: scheduledEmailsTable.id,
      leadId: scheduledEmailsTable.leadId,
      subject: scheduledEmailsTable.subject,
      status: scheduledEmailsTable.status,
      sentAt: scheduledEmailsTable.sentAt,
      sendError: scheduledEmailsTable.sendError,
      retryCount: scheduledEmailsTable.retryCount,
      queuePosition: scheduledEmailsTable.queuePosition,
    }).from(scheduledEmailsTable)
      .where(and(eq(scheduledEmailsTable.campaignId, campaignId), eq(scheduledEmailsTable.workspaceId, req.workspaceId!)))
      .orderBy(scheduledEmailsTable.queuePosition);

    res.json({
      campaign: { ...campaign, queueActive: queueStatus.active },
      emails: sentEmails,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/bulk-send/campaigns/:id/pause", requireRole("operator"), async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const aborted = abortQueue(campaignId);

    if (!aborted) {
      await db.update(bulkSendCampaignsTable).set({
        status: "paused",
        updatedAt: new Date(),
      }).where(and(eq(bulkSendCampaignsTable.id, campaignId), eq(bulkSendCampaignsTable.workspaceId, req.workspaceId!)));
    }

    res.json({ paused: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/bulk-send/campaigns/:id/resume", requireRole("operator"), async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const [campaign] = await db.select().from(bulkSendCampaignsTable)
      .where(and(eq(bulkSendCampaignsTable.id, campaignId), eq(bulkSendCampaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    startQueueProcessor(campaignId, {
      sendsPerHour: campaign.sendsPerHour || 50,
      delayBetweenSendsMs: campaign.delayBetweenSendsMs || 5000,
      batchSize: campaign.batchSize || 5,
    }).catch(err => console.error(`Resume error:`, err));

    res.json({ resumed: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/bulk-send/queue-status", async (_req, res) => {
  try {
    const status = await getGlobalQueueStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
