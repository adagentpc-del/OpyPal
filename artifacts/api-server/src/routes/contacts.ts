import { Router, type IRouter } from "express";
import { db, contactsTable, sequenceStepsTable, sendLogsTable, sequenceTemplatesTable, templateSetsTable, sequenceEnrollmentsTable, emailEventsTable, suppressionListTable } from "@workspace/db";
import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import { renderTemplate, renderSubject, splitFullName, calculateEngagementScore, getEngagementTier, type TemplateContact } from "../lib/template-engine";

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

function contactToTemplate(c: any): TemplateContact {
  return {
    firstName: c.firstName || (c.fullName || "").split(" ")[0] || "",
    lastName: c.lastName || (c.fullName || "").split(" ").slice(1).join(" ") || "",
    fullName: c.fullName || "",
    company: c.company || "",
    title: c.title || "",
    location: c.location || "",
    industry: c.industry || "",
    intentSignal: c.intentSignal || "",
    customLine: c.customLine || "",
  };
}

async function buildSequenceStepsFromTemplates(contactId: number, contact: any, templateSetId: number, enrollmentId: number, now: Date) {
  const seqTemplates = await db.select().from(sequenceTemplatesTable)
    .where(eq(sequenceTemplatesTable.templateSetId, templateSetId))
    .orderBy(sequenceTemplatesTable.stepNumber);

  const tc = contactToTemplate(contact);

  if (seqTemplates.length > 0) {
    return seqTemplates.map((t) => ({
      contactId,
      enrollmentId,
      stepNumber: t.stepNumber,
      templateSetName: null as string | null,
      templateId: t.id,
      delayDays: t.delayDays,
      subjectRendered: t.subject ? renderSubject(tc, t.subject) : null,
      bodyRendered: renderTemplate(tc, t.body),
      subject: t.subject,
      body: t.body,
      status: "scheduled" as const,
      scheduledFor: t.delayDays === 0 ? now : addBusinessDays(now, t.delayDays),
    }));
  }

  return SEQUENCE_DELAYS.map((delay, idx) => ({
    contactId,
    enrollmentId,
    stepNumber: idx + 1,
    templateSetName: null as string | null,
    templateId: null as number | null,
    delayDays: delay,
    subjectRendered: null as string | null,
    bodyRendered: null as string | null,
    subject: null as string | null,
    body: null as string | null,
    status: "scheduled" as const,
    scheduledFor: delay === 0 ? now : addBusinessDays(now, delay),
  }));
}

const router: IRouter = Router();

router.get("/contacts", async (req, res) => {
  try {
    const { search, sequenceStatus, campaignName, segmentType, engagementTier, doNotContact } = req.query as any;
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
    if (segmentType) conditions.push(eq(contactsTable.segmentType, segmentType));
    if (engagementTier) conditions.push(eq(contactsTable.engagementTier, engagementTier));
    if (doNotContact !== undefined) conditions.push(eq(contactsTable.doNotContact, doNotContact === "true"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const contacts = where
      ? await db.select().from(contactsTable).where(where).orderBy(desc(contactsTable.id))
      : await db.select().from(contactsTable).orderBy(desc(contactsTable.id));

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

    const steps = await db.select().from(sequenceStepsTable)
      .where(eq(sequenceStepsTable.contactId, id))
      .orderBy(sequenceStepsTable.stepNumber);

    const sendLogs = await db.select().from(sendLogsTable)
      .where(eq(sendLogsTable.contactId, id))
      .orderBy(desc(sendLogsTable.sentAt));

    const events = await db.select().from(emailEventsTable)
      .where(eq(emailEventsTable.contactId, id))
      .orderBy(desc(emailEventsTable.timestamp));

    const enrollments = await db.select().from(sequenceEnrollmentsTable)
      .where(eq(sequenceEnrollmentsTable.contactId, id))
      .orderBy(desc(sequenceEnrollmentsTable.enrolledAt));

    res.json({ ...contact, steps, sendLogs, events, enrollments });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts", async (req, res) => {
  try {
    const data = req.body;
    if (data.fullName && (!data.firstName || !data.lastName)) {
      const { firstName, lastName } = splitFullName(data.fullName);
      if (!data.firstName) data.firstName = firstName;
      if (!data.lastName) data.lastName = lastName;
    }
    const [contact] = await db.insert(contactsTable).values(data).returning();
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
    const { templateSetId, campaignId, campaignName, templateSetName } = req.body;

    const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    if (contact.sequenceStatus === "active") {
      return res.json({ success: false, message: "Contact is already in an active sequence", stepsCreated: 0 });
    }

    const suppressed = await db.select().from(suppressionListTable).where(eq(suppressionListTable.email, contact.email.toLowerCase()));
    if (suppressed.length > 0) {
      return res.json({ success: false, message: "Contact email is on suppression list", stepsCreated: 0 });
    }

    const now = new Date();

    const [enrollment] = await db.insert(sequenceEnrollmentsTable).values({
      contactId: id,
      campaignId: campaignId || null,
      templateSetId: templateSetId || null,
      currentStep: 1,
      sequenceStatus: "active",
      enrolledAt: now,
      nextSendAt: now,
    }).returning();

    let steps: any[];
    if (templateSetId) {
      steps = await buildSequenceStepsFromTemplates(id, contact, templateSetId, enrollment.id, now);
    } else {
      steps = SEQUENCE_DELAYS.map((delay, idx) => ({
        contactId: id,
        enrollmentId: enrollment.id,
        stepNumber: idx + 1,
        templateSetName: templateSetName || null,
        templateId: null,
        delayDays: delay,
        subjectRendered: null,
        bodyRendered: null,
        subject: null,
        body: null,
        status: "scheduled" as const,
        scheduledFor: delay === 0 ? now : addBusinessDays(now, delay),
      }));
    }

    await db.insert(sequenceStepsTable).values(steps);

    await db.update(contactsTable).set({
      sequenceStatus: "active",
      currentStep: 1,
      templateSetId: templateSetId || contact.templateSetId,
      campaignId: campaignId || contact.campaignId,
      assignedTemplateSet: templateSetName || contact.assignedTemplateSet,
      campaignName: campaignName || contact.campaignName,
      nextSendAt: steps[0]?.scheduledFor || now,
      updatedAt: now,
    }).where(eq(contactsTable.id, id));

    res.json({ success: true, message: `Enrolled with ${steps.length} steps`, stepsCreated: steps.length, enrollmentId: enrollment.id });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/pause", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reason = req.body.reason || "manual";
    const [contact] = await db.update(contactsTable)
      .set({ sequenceStatus: "paused_manual", updatedAt: new Date() })
      .where(eq(contactsTable.id, id))
      .returning();
    if (!contact) return res.status(404).json({ message: "Contact not found" });

    await db.update(sequenceStepsTable)
      .set({ status: "paused" })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    await db.update(sequenceEnrollmentsTable)
      .set({ sequenceStatus: "paused_manual", pausedReason: reason, updatedAt: new Date() })
      .where(and(eq(sequenceEnrollmentsTable.contactId, id), eq(sequenceEnrollmentsTable.sequenceStatus, "active")));

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

    if (["paused_replied", "completed", "dnc", "do_not_contact"].includes(contact.sequenceStatus)) {
      await db.delete(sequenceStepsTable).where(eq(sequenceStepsTable.contactId, id));
      const now = new Date();
      const tsId = contact.templateSetId || req.body.templateSetId;

      const [enrollment] = await db.insert(sequenceEnrollmentsTable).values({
        contactId: id,
        campaignId: contact.campaignId || req.body.campaignId || null,
        templateSetId: tsId || null,
        currentStep: 1,
        sequenceStatus: "active",
        enrolledAt: now,
        nextSendAt: now,
      }).returning();

      let steps: any[];
      if (tsId) {
        steps = await buildSequenceStepsFromTemplates(id, contact, tsId, enrollment.id, now);
      } else {
        steps = SEQUENCE_DELAYS.map((delay, idx) => ({
          contactId: id,
          enrollmentId: enrollment.id,
          stepNumber: idx + 1,
          templateSetName: null,
          templateId: null,
          delayDays: delay,
          subjectRendered: null,
          bodyRendered: null,
          subject: null,
          body: null,
          status: "scheduled" as const,
          scheduledFor: delay === 0 ? now : addBusinessDays(now, delay),
        }));
      }
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

    await db.update(sequenceEnrollmentsTable)
      .set({ sequenceStatus: "active", pausedReason: null, updatedAt: new Date() })
      .where(and(eq(sequenceEnrollmentsTable.contactId, id), or(eq(sequenceEnrollmentsTable.sequenceStatus, "paused_manual"), eq(sequenceEnrollmentsTable.sequenceStatus, "paused_replied"))));

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
    const now = new Date();

    const [nextStep] = await db.select().from(sequenceStepsTable)
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")))
      .orderBy(sequenceStepsTable.stepNumber)
      .limit(1);

    if (nextStep) {
      await db.update(sequenceStepsTable)
        .set({ status: "skipped", skippedAt: now })
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
        updatedAt: now,
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
      enrollmentId: nextStep.enrollmentId,
      sequenceStepId: nextStep.id,
      templateId: nextStep.templateId,
      stepNumber: nextStep.stepNumber,
      subjectRendered: nextStep.subjectRendered,
      bodyRendered: nextStep.bodyRendered,
      subject: nextStep.subject,
      body: nextStep.body,
      status: "sent",
      sentAt: now,
      createdAt: now,
    });

    await db.insert(emailEventsTable).values({
      contactId: id,
      eventType: "sent",
      timestamp: now,
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
      .set({ status: "canceled", canceledAt: now })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    await db.insert(emailEventsTable).values({
      contactId: id,
      eventType: "reply",
      timestamp: now,
    });

    await db.update(sequenceEnrollmentsTable)
      .set({ sequenceStatus: "paused_replied", pausedReason: "reply_detected", updatedAt: now })
      .where(and(eq(sequenceEnrollmentsTable.contactId, id), eq(sequenceEnrollmentsTable.sequenceStatus, "active")));

    const events = await db.select().from(emailEventsTable).where(eq(emailEventsTable.contactId, id));
    const score = calculateEngagementScore(events);
    const tier = getEngagementTier(score);

    const [contact] = await db.update(contactsTable)
      .set({ sequenceStatus: "paused_replied", lastReplyAt: now, nextSendAt: null, engagementScore: score, engagementTier: tier, updatedAt: now })
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
    const now = new Date();

    await db.update(sequenceStepsTable)
      .set({ status: "canceled", canceledAt: now })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    await db.update(sequenceEnrollmentsTable)
      .set({ sequenceStatus: "do_not_contact", updatedAt: now })
      .where(and(eq(sequenceEnrollmentsTable.contactId, id), eq(sequenceEnrollmentsTable.sequenceStatus, "active")));

    const [contact] = await db.update(contactsTable)
      .set({ doNotContact: true, sequenceStatus: "do_not_contact", nextSendAt: null, updatedAt: now })
      .where(eq(contactsTable.id, id))
      .returning();

    if (!contact) return res.status(404).json({ message: "Contact not found" });

    await db.insert(suppressionListTable).values({
      email: contact.email.toLowerCase(),
      reason: "marked_dnc",
    }).onConflictDoNothing();

    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/contacts/:id/mark-unsubscribed", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date();

    await db.update(sequenceStepsTable)
      .set({ status: "canceled", canceledAt: now })
      .where(and(eq(sequenceStepsTable.contactId, id), eq(sequenceStepsTable.status, "scheduled")));

    const [contact] = await db.update(contactsTable)
      .set({ unsubscribed: true, sequenceStatus: "unsubscribed", nextSendAt: null, updatedAt: now })
      .where(eq(contactsTable.id, id))
      .returning();

    if (!contact) return res.status(404).json({ message: "Contact not found" });

    await db.insert(suppressionListTable).values({
      email: contact.email.toLowerCase(),
      reason: "unsubscribed",
    }).onConflictDoNothing();

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

router.get("/contacts/:id/events", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const events = await db.select().from(emailEventsTable)
      .where(eq(emailEventsTable.contactId, id))
      .orderBy(desc(emailEventsTable.timestamp));
    res.json(events);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
