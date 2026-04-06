import { Router, type IRouter } from "express";
import { db, bulkSendCampaignsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { validateRecipients, executeBulkSend } from "../lib/bulk-send-engine";
import { checkResendConnection } from "../lib/resend";

const router: IRouter = Router();

router.get("/bulk-send/check-connection", async (_req, res) => {
  try {
    const status = await checkResendConnection();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

router.post("/bulk-send/validate", async (req, res) => {
  try {
    const { recipients, sequenceId } = req.body;
    if (!recipients || !Array.isArray(recipients)) return res.status(400).json({ message: "recipients array required" });
    const report = await validateRecipients(recipients, sequenceId);
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

router.post("/bulk-send/execute", async (req, res) => {
  try {
    const { recipients, templateId, templateName, subject, body, sequenceId, sequenceName, sequenceSteps, activateSequence, mode, scheduledFor, campaignName, senderEmail, senderName } = req.body;
    if (!recipients?.length) return res.status(400).json({ message: "No recipients" });
    if (!subject || !body) return res.status(400).json({ message: "Subject and body required" });

    if (mode === "send_now") {
      const connCheck = await checkResendConnection();
      if (!connCheck.connected) return res.status(400).json({ message: `Resend not configured: ${connCheck.error}` });
    }

    const report = await validateRecipients(recipients, sequenceId);
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
      totalSkipped,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/bulk-send/campaigns", async (req, res) => {
  try {
    const campaigns = await db.select().from(bulkSendCampaignsTable)
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
      .where(eq(bulkSendCampaignsTable.id, Number(req.params.id)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
