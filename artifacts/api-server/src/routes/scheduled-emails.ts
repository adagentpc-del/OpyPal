import { Router, type IRouter } from "express";
import { db, scheduledEmailsTable, activityTable, leadsTable } from "@workspace/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

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
    });

    res.status(201).json(email);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/scheduled-emails/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.status) updates.status = req.body.status;
    if (req.body.scheduledFor) updates.scheduledFor = new Date(req.body.scheduledFor);
    if (req.body.subject !== undefined) updates.subject = req.body.subject;
    if (req.body.body !== undefined) updates.body = req.body.body;
    if (req.body.source !== undefined) updates.source = req.body.source;

    if (req.body.status === "canceled") updates.canceledAt = new Date();
    if (req.body.status === "sent") updates.sentAt = new Date();
    if (req.body.status === "paused") updates.status = "paused";

    const [email] = await db.update(scheduledEmailsTable)
      .set(updates)
      .where(eq(scheduledEmailsTable.id, id))
      .returning();

    if (!email) return res.status(404).json({ message: "Scheduled email not found" });

    if (email.leadId) {
      const actionType = req.body.status === "canceled" ? "email_canceled" :
        req.body.status === "paused" ? "email_paused" :
        req.body.scheduledFor ? "email_rescheduled" : null;
      if (actionType) {
        await db.insert(activityTable).values({
          type: actionType,
          description: `Scheduled email ${actionType.replace("email_", "")}: ${email.subject}`,
          leadId: email.leadId,
        });
      }
    }

    res.json(email);
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
