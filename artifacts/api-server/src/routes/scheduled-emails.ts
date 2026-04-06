import { Router, type IRouter } from "express";
import { db, scheduledEmailsTable, activityTable, leadsTable } from "@workspace/db";
import { eq, and, desc, gte, lte, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scheduled-emails", async (req, res) => {
  try {
    const conditions: any[] = [];
    if (req.query.leadId) conditions.push(eq(scheduledEmailsTable.leadId, Number(req.query.leadId)));
    if (req.query.status) conditions.push(eq(scheduledEmailsTable.status, String(req.query.status)));
    if (req.query.sequenceId) conditions.push(eq(scheduledEmailsTable.sequenceId, Number(req.query.sequenceId)));
    if (req.query.templateId) conditions.push(eq(scheduledEmailsTable.templateId, Number(req.query.templateId)));
    if (req.query.source) conditions.push(eq(scheduledEmailsTable.source, String(req.query.source)));
    if (req.query.from) conditions.push(gte(scheduledEmailsTable.scheduledFor, new Date(String(req.query.from))));
    if (req.query.to) conditions.push(lte(scheduledEmailsTable.scheduledFor, new Date(String(req.query.to))));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const emails = await db.select({
      scheduledEmail: scheduledEmailsTable,
      leadName: leadsTable.contactName,
      companyName: leadsTable.companyName,
    }).from(scheduledEmailsTable)
      .leftJoin(leadsTable, eq(scheduledEmailsTable.leadId, leadsTable.id))
      .where(where)
      .orderBy(desc(scheduledEmailsTable.scheduledFor));

    const result = emails.map(e => ({
      ...e.scheduledEmail,
      leadName: e.leadName,
      companyName: e.companyName,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/scheduled-emails", async (req, res) => {
  try {
    const { leadId, templateId, subject, body, scheduledFor, sequenceId, sequenceStepNumber, sequenceStepId, source } = req.body;
    const [email] = await db.insert(scheduledEmailsTable).values({
      leadId,
      templateId: templateId || null,
      subject,
      body,
      originalSubject: subject,
      originalBody: body,
      scheduledFor: new Date(scheduledFor),
      status: "scheduled",
      sequenceId: sequenceId || null,
      sequenceStepNumber: sequenceStepNumber || null,
      sequenceStepId: sequenceStepId || null,
      source: source || "manual",
    }).returning();

    await db.insert(activityTable).values({
      type: "email_scheduled",
      description: `Email scheduled for ${new Date(scheduledFor).toLocaleDateString()}: ${subject}`,
      leadId,
      relatedTemplateId: templateId || null,
      relatedSequenceId: sequenceId || null,
      relatedScheduledEmailId: email.id,
      createdBy: req.body.createdBy || "user",
    });

    res.status(201).json(email);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/scheduled-emails/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.select().from(scheduledEmailsTable).where(eq(scheduledEmailsTable.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ message: "Scheduled email not found" });
    const prev = existing[0];

    const updates: any = { updatedAt: new Date() };
    if (req.body.status) updates.status = req.body.status;
    if (req.body.scheduledFor) updates.scheduledFor = new Date(req.body.scheduledFor);
    if (req.body.subject !== undefined) updates.subject = req.body.subject;
    if (req.body.body !== undefined) updates.body = req.body.body;
    if (req.body.source !== undefined) updates.source = req.body.source;
    if (req.body.pauseReason !== undefined) updates.pauseReason = req.body.pauseReason;
    if (req.body.canceledReason !== undefined) updates.canceledReason = req.body.canceledReason;

    if (req.body.status === "canceled") updates.canceledAt = new Date();
    if (req.body.status === "sent") updates.sentAt = new Date();
    if (req.body.status === "paused") updates.pausedAt = new Date();
    if (req.body.status === "scheduled" && prev.status === "paused") {
      updates.pausedAt = null;
      updates.pauseReason = null;
    }

    const [email] = await db.update(scheduledEmailsTable)
      .set(updates)
      .where(eq(scheduledEmailsTable.id, id))
      .returning();

    if (email.leadId) {
      let actionType: string | null = null;
      let desc = "";
      if (req.body.status === "canceled") { actionType = "email_canceled"; desc = `Email canceled: ${email.subject}`; }
      else if (req.body.status === "paused") { actionType = "email_paused"; desc = `Email paused: ${email.subject}`; }
      else if (req.body.status === "scheduled" && prev.status === "paused") { actionType = "email_resumed"; desc = `Email resumed: ${email.subject}`; }
      else if (req.body.status === "skipped") { actionType = "email_skipped"; desc = `Email skipped: ${email.subject}`; }
      else if (req.body.scheduledFor && req.body.scheduledFor !== prev.scheduledFor?.toISOString()) { actionType = "email_rescheduled"; desc = `Email rescheduled to ${new Date(req.body.scheduledFor).toLocaleDateString()}: ${email.subject}`; }
      else if (req.body.subject !== undefined || req.body.body !== undefined) { actionType = "email_edited"; desc = `Scheduled email edited: ${email.subject}`; }

      if (actionType) {
        await db.insert(activityTable).values({
          type: actionType,
          description: desc,
          leadId: email.leadId,
          relatedScheduledEmailId: email.id,
          relatedSequenceId: email.sequenceId,
          createdBy: req.body.createdBy || "user",
        });
      }
    }

    res.json(email);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/scheduled-emails/bulk-action", async (req, res) => {
  try {
    const { leadId, sequenceId, action, reason } = req.body;
    if (!leadId || !action) return res.status(400).json({ message: "leadId and action are required" });

    const conditions: any[] = [
      eq(scheduledEmailsTable.leadId, Number(leadId)),
      inArray(scheduledEmailsTable.status, action === "resume" ? ["paused"] : ["scheduled", "paused"]),
    ];
    if (sequenceId) conditions.push(eq(scheduledEmailsTable.sequenceId, Number(sequenceId)));

    const emails = await db.select().from(scheduledEmailsTable).where(and(...conditions));

    let newStatus = "";
    let activityType = "";
    let activityDesc = "";
    const updates: any = { updatedAt: new Date() };

    if (action === "pause") {
      newStatus = "paused"; updates.status = "paused"; updates.pausedAt = new Date();
      if (reason) updates.pauseReason = reason;
      activityType = "sequence_paused"; activityDesc = `Sequence paused: ${emails.length} step(s) paused`;
    } else if (action === "resume") {
      newStatus = "scheduled"; updates.status = "scheduled"; updates.pausedAt = null; updates.pauseReason = null;
      activityType = "sequence_resumed"; activityDesc = `Sequence resumed: ${emails.length} step(s) resumed`;
    } else if (action === "cancel") {
      newStatus = "canceled"; updates.status = "canceled"; updates.canceledAt = new Date();
      if (reason) updates.canceledReason = reason;
      activityType = "sequence_canceled"; activityDesc = `Sequence canceled: ${emails.length} step(s) canceled`;
    } else if (action === "skip") {
      newStatus = "skipped"; updates.status = "skipped";
      activityType = "sequence_skipped"; activityDesc = `Sequence steps skipped: ${emails.length} step(s)`;
    } else {
      return res.status(400).json({ message: "Invalid action. Use pause, resume, cancel, or skip." });
    }

    if (emails.length > 0) {
      const ids = emails.map(e => e.id);
      await db.update(scheduledEmailsTable).set(updates).where(inArray(scheduledEmailsTable.id, ids));

      await db.insert(activityTable).values({
        type: activityType,
        description: activityDesc,
        leadId: Number(leadId),
        relatedSequenceId: sequenceId ? Number(sequenceId) : null,
        createdBy: req.body.createdBy || "user",
        metadata: { emailIds: ids, action, reason: reason || null },
      });
    }

    res.json({ message: `${action} applied to ${emails.length} email(s)`, count: emails.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/scheduled-emails/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(scheduledEmailsTable).where(eq(scheduledEmailsTable.id, id));
    res.json({ message: "Scheduled email deleted" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
