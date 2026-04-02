import { Router, type IRouter } from "express";
import { db, contactsTable, sequenceStepsTable, sendLogsTable, settingsTable, emailEventsTable, sequenceEnrollmentsTable } from "@workspace/db";
import { eq, and, lte, sql, desc } from "drizzle-orm";
import { calculateEngagementScore, getEngagementTier } from "../lib/template-engine";

const router: IRouter = Router();

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  return row?.value || defaultValue;
}

function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function isInSendWindow(d: Date, startHour: number, endHour: number): boolean {
  const hour = d.getHours();
  return hour >= startHour && hour < endHour;
}

router.get("/sequence/queue", async (req, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const dueToday = req.query.dueToday === "true";

    let conditions: any[] = [];
    if (statusFilter) conditions.push(eq(sequenceStepsTable.status, statusFilter));

    if (dueToday) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      conditions.push(lte(sequenceStepsTable.scheduledFor, todayEnd));
      conditions.push(eq(sequenceStepsTable.status, "scheduled"));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const steps = where
      ? await db.select().from(sequenceStepsTable).where(where).orderBy(sequenceStepsTable.scheduledFor).limit(200)
      : await db.select().from(sequenceStepsTable).orderBy(sequenceStepsTable.scheduledFor).limit(200);

    const contactIds = [...new Set(steps.map(s => s.contactId))];
    const contacts = contactIds.length > 0
      ? await db.select().from(contactsTable).where(sql`${contactsTable.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`,`)})`)
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

    const result = steps.map(s => {
      const c = contactMap[s.contactId];
      return {
        ...s,
        contactName: c?.fullName || "",
        contactEmail: c?.email || "",
        company: c?.company || "",
        campaignName: c?.campaignName || "",
        segmentType: c?.segmentType || "",
        engagementTier: c?.engagementTier || "cold",
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/sequence/process", async (_req, res) => {
  try {
    const now = new Date();

    const businessDaysOnly = (await getSetting("business_days_only", "true")) === "true";
    if (businessDaysOnly && !isBusinessDay(now)) {
      return res.json({ processed: 0, skipped: 0, errors: 0, message: "Not a business day, skipping" });
    }

    const sendWindowStart = parseInt(await getSetting("send_window_start", "8"), 10);
    const sendWindowEnd = parseInt(await getSetting("send_window_end", "18"), 10);

    if (!isInSendWindow(now, sendWindowStart, sendWindowEnd)) {
      return res.json({ processed: 0, skipped: 0, errors: 0, message: `Outside send window (${sendWindowStart}:00-${sendWindowEnd}:00)` });
    }

    const dailyCap = parseInt(await getSetting("daily_send_cap", "50"), 10);
    const useRandomSpacing = (await getSetting("randomized_spacing", "true")) === "true";

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [sentTodayResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(sendLogsTable).where(
      and(
        sql`${sendLogsTable.sentAt} >= ${todayStart}`,
        eq(sendLogsTable.status, "sent")
      )
    );
    const sentToday = sentTodayResult?.count || 0;

    if (sentToday >= dailyCap) {
      return res.json({ processed: 0, skipped: 0, errors: 0, message: `Daily cap reached (${sentToday}/${dailyCap})` });
    }

    const remaining = dailyCap - sentToday;

    const dueSteps = await db.select().from(sequenceStepsTable)
      .where(and(
        eq(sequenceStepsTable.status, "scheduled"),
        lte(sequenceStepsTable.scheduledFor, now)
      ))
      .orderBy(sequenceStepsTable.scheduledFor)
      .limit(remaining);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const step of dueSteps) {
      try {
        const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, step.contactId));
        if (!contact || contact.doNotContact || contact.bounced || contact.unsubscribed ||
            contact.sequenceStatus === "paused_replied" || contact.sequenceStatus === "paused_manual" ||
            contact.sequenceStatus === "do_not_contact" || contact.sequenceStatus === "bounce" ||
            contact.sequenceStatus === "unsubscribed") {
          await db.update(sequenceStepsTable).set({ status: "skipped", skippedAt: now }).where(eq(sequenceStepsTable.id, step.id));
          skipped++;
          continue;
        }

        await db.update(sequenceStepsTable).set({ status: "sent", sentAt: now }).where(eq(sequenceStepsTable.id, step.id));

        await db.insert(sendLogsTable).values({
          contactId: step.contactId,
          enrollmentId: step.enrollmentId,
          sequenceStepId: step.id,
          templateId: step.templateId,
          stepNumber: step.stepNumber,
          subjectRendered: step.subjectRendered,
          bodyRendered: step.bodyRendered,
          subject: step.subject,
          body: step.body,
          status: "sent",
          sentAt: now,
          createdAt: now,
        });

        await db.insert(emailEventsTable).values({
          contactId: step.contactId,
          sendLogId: null,
          eventType: "sent",
          timestamp: now,
        });

        const [nextStep] = await db.select().from(sequenceStepsTable)
          .where(and(eq(sequenceStepsTable.contactId, step.contactId), eq(sequenceStepsTable.status, "scheduled")))
          .orderBy(sequenceStepsTable.stepNumber)
          .limit(1);

        const newStatus = nextStep ? "active" : "completed";

        await db.update(contactsTable).set({
          currentStep: nextStep ? nextStep.stepNumber : step.stepNumber + 1,
          lastEmailSentAt: now,
          nextSendAt: nextStep?.scheduledFor || null,
          sequenceStatus: newStatus,
          updatedAt: now,
        }).where(eq(contactsTable.id, step.contactId));

        if (step.enrollmentId) {
          await db.update(sequenceEnrollmentsTable).set({
            currentStep: nextStep ? nextStep.stepNumber : step.stepNumber + 1,
            nextSendAt: nextStep?.scheduledFor || null,
            sequenceStatus: newStatus,
            completedAt: newStatus === "completed" ? now : null,
            updatedAt: now,
          }).where(eq(sequenceEnrollmentsTable.id, step.enrollmentId));
        }

        const events = await db.select().from(emailEventsTable).where(eq(emailEventsTable.contactId, step.contactId));
        const score = calculateEngagementScore(events);
        const tier = getEngagementTier(score);
        await db.update(contactsTable).set({ engagementScore: score, engagementTier: tier }).where(eq(contactsTable.id, step.contactId));

        processed++;

        if (useRandomSpacing) {
          const delay = Math.floor(Math.random() * 5000) + 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (e: any) {
        errors++;
        await db.update(sequenceStepsTable).set({ status: "failed" }).where(eq(sequenceStepsTable.id, step.id));
        await db.insert(sendLogsTable).values({
          contactId: step.contactId,
          enrollmentId: step.enrollmentId,
          sequenceStepId: step.id,
          stepNumber: step.stepNumber,
          subject: step.subject,
          status: "failed",
          errorMessage: e.message,
          sentAt: now,
          createdAt: now,
        });
      }
    }

    res.json({ processed, skipped, errors, message: `Processed ${processed} steps` });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
