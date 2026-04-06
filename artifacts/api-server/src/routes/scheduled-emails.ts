import { Router, type IRouter } from "express";
import { db, scheduledEmailsTable, activityTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/scheduled-emails", async (req, res) => {
  try {
    const conditions: any[] = [];
    if (req.query.leadId) conditions.push(eq(scheduledEmailsTable.leadId, Number(req.query.leadId)));
    if (req.query.status) conditions.push(eq(scheduledEmailsTable.status, String(req.query.status)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const emails = await db.select().from(scheduledEmailsTable)
      .where(where)
      .orderBy(desc(scheduledEmailsTable.scheduledFor));
    res.json(emails);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/scheduled-emails", async (req, res) => {
  try {
    const { leadId, templateId, subject, body, scheduledFor, sequenceId, sequenceStepNumber } = req.body;
    const [email] = await db.insert(scheduledEmailsTable).values({
      leadId,
      templateId: templateId || null,
      subject,
      body,
      scheduledFor: new Date(scheduledFor),
      status: "scheduled",
      sequenceId: sequenceId || null,
      sequenceStepNumber: sequenceStepNumber || null,
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
    if (req.body.subject) updates.subject = req.body.subject;
    if (req.body.body) updates.body = req.body.body;

    if (req.body.status === "canceled") updates.canceledAt = new Date();
    if (req.body.status === "sent") updates.sentAt = new Date();

    const [email] = await db.update(scheduledEmailsTable)
      .set(updates)
      .where(eq(scheduledEmailsTable.id, id))
      .returning();

    if (!email) return res.status(404).json({ message: "Scheduled email not found" });

    if (req.body.status === "canceled" && email.leadId) {
      await db.insert(activityTable).values({
        type: "email_canceled",
        description: `Scheduled email canceled: ${email.subject}`,
        leadId: email.leadId,
      });
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
