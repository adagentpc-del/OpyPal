import { Router, type IRouter } from "express";
import { db, contactsTable, sequenceStepsTable, sendLogsTable, templatesTable } from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";

const SEQUENCE_DELAYS = [0, 3, 7, 14, 30, 120, 180];

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

function getScheduleDate(enrollDate: Date, delayDays: number): Date {
  if (delayDays === 0) return new Date(enrollDate);
  return addBusinessDays(enrollDate, delayDays);
}

function buildSequenceSteps(contactId: number, contact: any, coldTemplates: any[], followUpTemplates: any[], now: Date) {
  return SEQUENCE_DELAYS.map((delay, idx) => {
    const pool = idx === 0 ? coldTemplates : followUpTemplates;
    const template = pool.length > 0 ? pool[idx % pool.length] : null;

    const firstName = (contact.fullName || "").split(" ")[0] || "there";
    let subjectText = template?.subject || "";
    let bodyText = template?.body || "";
    const replacements: Record<string, string> = {
      "[First Name]": firstName,
      "[Name]": contact.fullName || "",
      "[Company Name]": contact.company || "",
      "[Company]": contact.company || "",
      "[company]": contact.company || "",
      "[venue / agency]": contact.company || "",
      "[venue]": contact.company || "",
      "[Title]": contact.title || "",
      "[Location]": contact.location || "",
    };
    for (const [key, val] of Object.entries(replacements)) {
      subjectText = subjectText.split(key).join(val);
      bodyText = bodyText.split(key).join(val);
    }

    return {
      contactId,
      stepNumber: idx + 1,
      templateId: template?.id || null,
      delayDays: delay,
      subject: subjectText,
      body: bodyText,
      status: "scheduled" as const,
      scheduledFor: getScheduleDate(now, delay),
    };
  });
}

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const { search, sequenceStatus, campaignName, doNotContact } = req.query as any;
    const conditions: any[] = [];

    if (search) {
      conditions.push(or(
        ilike(contactsTable.fullName, `%${search}%`),
        ilike(contactsTable.company, `%${search}%`),
        ilike(contactsTable.email, `%${search}%`)
      ));
    }
    if (sequenceStatus) conditions.push(eq(contactsTable.sequenceStatus, sequenceStatus));
    if (campaignName) conditions.push(eq(contactsTable.campaignName, campaignName));
    if (doNotContact !== undefined) conditions.push(eq(contactsTable.doNotContact, doNotContact === "true"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const contacts = where
      ? await db.select().from(contactsTable).where(where).orderBy(contactsTable.id)
      : await db.select().from(contactsTable).orderBy(contactsTable.id);

    res.json(contacts);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const [contact] = await db.insert(contactsTable).values(req.body).returning();
    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [contact] = await db.update(contactsTable)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(contactsTable).where(eq(contactsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/enroll", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { templateSetName, campaignName } = req.body;

    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    if (contact.sequenceStatus === "active") {
      return res.json({ success: false, message: "Contact is already in an active sequence", stepsCreated: 0 });
    }

    const allTemplates = await db.select().from(templatesTable)
      .where(or(eq(templatesTable.category, "Cold Email"), eq(templatesTable.category, "Follow-Up Email")));

    const coldTemplates = allTemplates.filter(t => t.category === "Cold Email");
    const followUpTemplates = allTemplates.filter(t => t.category === "Follow-Up Email");

    const now = new Date();
    const steps = buildSequenceSteps(id, contact, coldTemplates, followUpTemplates, now);

    await db.insert(sequenceStepsTable).values(steps);

    await db.update(contactsTable).set({
      sequenceStatus: "active",
      currentStep: 1,
      assignedTemplateSet: templateSetName,
      campaignName: campaignName || contact.campaignName,
      nextSendAt: steps[0].scheduledFor,
      updatedAt: new Date(),
    }).where(eq(contactsTable.id, id));

    res.json({ success: true, message: `Enrolled with ${steps.length} steps`, stepsCreated: steps.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/pause", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [contact] = await db.update(contactsTable)
      .set({ sequenceStatus: "paused", updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    await db.update(sequenceStepsTable)
      .set({ status: "paused" })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/resume", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    if (contact.sequenceStatus === "paused_replied" || contact.sequenceStatus === "completed" || contact.sequenceStatus === "dnc") {
      await db.delete(sequenceStepsTable).where(eq(sequenceStepsTable.contactId, id));
      const allTemplates = await db.select().from(templatesTable)
        .where(or(eq(templatesTable.category, "Cold Email"), eq(templatesTable.category, "Follow-Up Email")));
      const coldTemplates = allTemplates.filter(t => t.category === "Cold Email");
      const followUpTemplates = allTemplates.filter(t => t.category === "Follow-Up Email");
      const now = new Date();
      const steps = buildSequenceSteps(id, contact, coldTemplates, followUpTemplates, now);
      await db.insert(sequenceStepsTable).values(steps);
      const [updated] = await db.update(contactsTable)
        .set({ sequenceStatus: "active", currentStep: 1, nextSendAt: now, lastReplyAt: null, doNotContact: false, updatedAt: now })
        .where(eq(contactsTable.id, id))
        .returning();
      return res.json(updated);
    }

    const pausedSteps = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "paused")))
      .orderBy(sequenceStepsTable.stepNumber);

    if (pausedSteps.length === 0) {
      return res.status(400).json({ message: "No paused steps to resume" });
    }

    const now = new Date();
    for (let i = 0; i < pausedSteps.length; i++) {
      const step = pausedSteps[i];
      const newSchedule = addBusinessDays(now, i === 0 ? 0 : step.delayDays);
      await db.update(sequenceStepsTable)
        .set({ status: "scheduled", scheduledFor: newSchedule })
        .where(eq(sequenceStepsTable.id, step.id));
    }

    const [updated] = await db.update(contactsTable)
      .set({ sequenceStatus: "active", nextSendAt: now, updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/skip-step", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [nextStep] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")))
      .orderBy(sequenceStepsTable.stepNumber)
      .limit(1);

    if (nextStep) {
      await db.update(sequenceStepsTable)
        .set({ status: "skipped" })
        .where(eq(sequenceStepsTable.id, nextStep.id));
    }

    const [nextNext] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")))
      .orderBy(sequenceStepsTable.stepNumber)
      .limit(1);

    const [contact] = await db.update(contactsTable)
      .set({
        currentStep: nextNext ? nextNext.stepNumber : (nextStep ? nextStep.stepNumber + 1 : 1),
        nextSendAt: nextNext?.scheduledFor || null,
        sequenceStatus: nextNext ? "active" : "completed",
        updatedAt: new Date(),
      })
      .where(eq(contactsTable.id, id))
      .returning();

    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/force-send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [nextStep] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")))
      .orderBy(sequenceStepsTable.stepNumber)
      .limit(1);

    if (!nextStep) return res.json({ success: false, message: "No scheduled steps to send" });

    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) return res.status(404).json({ success: false, message: "Contact not found" });

    const now = new Date();

    await db.update(sequenceStepsTable)
      .set({ status: "sent", sentAt: now })
      .where(eq(sequenceStepsTable.id, nextStep.id));

    await db.insert(sendLogsTable).values({
      contactId: id,
      sequenceStepId: nextStep.id,
      stepNumber: nextStep.stepNumber,
      subject: nextStep.subject,
      body: nextStep.body,
      status: "sent",
      sentAt: now,
    });

    const [nextNext] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")))
      .orderBy(sequenceStepsTable.stepNumber)
      .limit(1);

    await db.update(contactsTable).set({
      currentStep: nextNext ? nextNext.stepNumber : nextStep.stepNumber + 1,
      lastEmailSentAt: now,
      nextSendAt: nextNext?.scheduledFor || null,
      sequenceStatus: nextNext ? "active" : "completed",
      updatedAt: now,
    }).where(eq(contactsTable.id, id));

    res.json({ success: true, message: `Step ${nextStep.stepNumber} sent (force)` });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/mark-replied", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date();

    await db.update(sequenceStepsTable)
      .set({ status: "cancelled" })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    const [contact] = await db.update(contactsTable)
      .set({ sequenceStatus: "paused_replied", lastReplyAt: now, nextSendAt: null, updatedAt: now })
      .where(eq(contactsTable.id, id))
      .returning();

    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/mark-dnc", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await db.update(sequenceStepsTable)
      .set({ status: "cancelled" })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    const [contact] = await db.update(contactsTable)
      .set({ doNotContact: true, sequenceStatus: "dnc", nextSendAt: null, updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();

    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/contacts/:id/steps", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.contactId, id))
      .orderBy(sequenceStepsTable.stepNumber);
    res.json(steps);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
