import { Router, type IRouter } from "express";
import { db, contactsTable, sequenceStepsTable, sendLogsTable, importsTable, settingsTable, sequenceTemplatesTable, templateSetsTable, sequenceEnrollmentsTable, emailEventsTable, suppressionListTable } from "@workspace/db";
import { eq, and, or, sql, desc, ilike } from "drizzle-orm";
import { renderTemplate, renderSubject, splitFullName, calculateEngagementScore, getEngagementTier, type TemplateContact } from "../lib/template-engine";

const router: IRouter = Router();

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

router.get("/send-logs", async (req, res) => {
  try {
    const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    let conditions: any[] = [];
    if (contactId) conditions.push(eq(sendLogsTable.contactId, contactId));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = where
      ? await db.select().from(sendLogsTable).where(where).orderBy(desc(sendLogsTable.sentAt)).limit(limit)
      : await db.select().from(sendLogsTable).orderBy(desc(sendLogsTable.sentAt)).limit(limit);

    const contactIds = [...new Set(logs.map(l => l.contactId))];
    const contacts = contactIds.length > 0
      ? await db.select().from(contactsTable).where(sql`${contactsTable.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`,`)})`)
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

    const result = logs.map(l => {
      const c = contactMap[l.contactId];
      return { ...l, contactName: c?.fullName || "", contactEmail: c?.email || "", company: c?.company || "" };
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/imports", async (_req, res) => {
  try {
    const imports = await db.select().from(importsTable).orderBy(desc(importsTable.importedAt));
    res.json(imports);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/imports/upload", async (req, res) => {
  try {
    const { fileName, rows, campaignId, campaignName, templateSetId, templateSetName, segmentType, autoEnroll, reEnrollExisting } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validRows = rows.filter((r: any) => r.email && emailRegex.test(r.email) && (r.fullName || (r.firstName && r.lastName)) && r.company);
    const invalidCount = rows.length - validRows.length;

    const uniqueEmails = new Set<string>();
    const dedupedRows = validRows.filter((r: any) => {
      const key = r.email.toLowerCase();
      if (uniqueEmails.has(key)) return false;
      uniqueEmails.add(key);
      return true;
    });
    const inFileDupes = validRows.length - dedupedRows.length;

    const suppressedEmails = await db.select({ email: suppressionListTable.email }).from(suppressionListTable);
    const suppressedSet = new Set(suppressedEmails.map(s => s.email.toLowerCase()));

    const existingContacts = await db.select({ id: contactsTable.id, email: contactsTable.email, sequenceStatus: contactsTable.sequenceStatus })
      .from(contactsTable);
    const existingMap = new Map(existingContacts.map((c: any) => [c.email?.toLowerCase(), { id: c.id, status: c.sequenceStatus }]));

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let enrolled = 0;
    const importedContactIds: number[] = [];

    const [importRecord] = await db.insert(importsTable).values({
      fileName,
      totalRows: rows.length,
      validRows: validRows.length,
      invalidRows: invalidCount + inFileDupes,
      campaignId: campaignId || null,
      templateSetId: templateSetId || null,
      segmentType: segmentType || null,
      campaignName: campaignName || null,
      templateSetName: templateSetName || null,
      status: "processing",
    }).returning();

    for (const row of dedupedRows) {
      const emailLower = (row as any).email.toLowerCase();

      if (suppressedSet.has(emailLower)) {
        skipped++;
        continue;
      }

      const existing = existingMap.get(emailLower);

      if (existing) {
        if (existing.status === "active") {
          skipped++;
          duplicates++;
          continue;
        }

        if (!reEnrollExisting && ["paused_replied", "paused_manual", "completed"].includes(existing.status)) {
          skipped++;
          duplicates++;
          continue;
        }

        duplicates++;

        if (reEnrollExisting) {
          importedContactIds.push(existing.id);
          continue;
        }
      }

      const fullName = (row as any).fullName || `${(row as any).firstName || ""} ${(row as any).lastName || ""}`.trim();
      const { firstName, lastName } = splitFullName(fullName);

      const [contact] = await db.insert(contactsTable).values({
        fullName,
        firstName,
        lastName,
        company: (row as any).company,
        title: (row as any).title || null,
        email: (row as any).email,
        phone: (row as any).phone || null,
        location: (row as any).location || null,
        industry: (row as any).industry || null,
        intentSignal: (row as any).intentSignal || (row as any).intent_signal || null,
        customLine: (row as any).customLine || (row as any).custom_line || null,
        segmentType: segmentType || (row as any).segmentType || (row as any).segment_type || null,
        campaignName: campaignName || null,
        campaignId: campaignId ? parseInt(campaignId) : null,
        assignedTemplateSet: templateSetName || null,
        templateSetId: templateSetId ? parseInt(templateSetId) : null,
        sequenceStatus: "pending",
        sourceFileName: fileName,
        uploadedAt: new Date(),
        importId: importRecord.id,
      }).onConflictDoNothing().returning();

      if (contact) {
        imported++;
        importedContactIds.push(contact.id);
      } else {
        skipped++;
      }
    }

    if (autoEnroll && importedContactIds.length > 0 && templateSetId) {
      const tsId = parseInt(templateSetId);
      const seqTemplates = await db.select().from(sequenceTemplatesTable)
        .where(eq(sequenceTemplatesTable.templateSetId, tsId))
        .orderBy(sequenceTemplatesTable.stepNumber);

      for (const contactId of importedContactIds) {
        try {
          const [c] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId));
          if (!c) continue;
          const now = new Date();

          await db.delete(sequenceStepsTable).where(eq(sequenceStepsTable.contactId, contactId));

          const [enrollment] = await db.insert(sequenceEnrollmentsTable).values({
            contactId,
            campaignId: campaignId ? parseInt(campaignId) : null,
            templateSetId: tsId,
            currentStep: 1,
            sequenceStatus: "active",
            enrolledAt: now,
            nextSendAt: now,
          }).returning();

          const tc = contactToTemplate(c);

          const steps = seqTemplates.length > 0
            ? seqTemplates.map((t) => ({
                contactId,
                enrollmentId: enrollment.id,
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
              }))
            : SEQUENCE_DELAYS.map((delay, idx) => ({
                contactId,
                enrollmentId: enrollment.id,
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

          await db.insert(sequenceStepsTable).values(steps);
          await db.update(contactsTable).set({
            sequenceStatus: "active",
            currentStep: 1,
            nextSendAt: now,
            updatedAt: now,
          }).where(eq(contactsTable.id, contactId));

          enrolled++;
        } catch (e) {
        }
      }
    }

    await db.update(importsTable).set({
      importedRows: imported,
      skippedRows: skipped,
      duplicateRows: duplicates,
      enrolledRows: enrolled,
      invalidRows: invalidCount + inFileDupes,
      status: "completed",
    }).where(eq(importsTable.id, importRecord.id));

    res.json({
      success: true,
      importId: importRecord.id,
      totalRows: rows.length,
      imported,
      skipped,
      duplicates,
      invalid: invalidCount + inFileDupes,
      enrolled,
      message: `Imported ${imported} contacts${enrolled > 0 ? `, enrolled ${enrolled} in sequence` : ""}`,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/outbound-analytics", async (_req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable);
    const [activeResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.sequenceStatus, "active"));
    const [importedTodayResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(sql`${contactsTable.uploadedAt} >= ${todayStart}`);
    const [sentTodayResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sendLogsTable).where(and(sql`${sendLogsTable.sentAt} >= ${todayStart}`, eq(sendLogsTable.status, "sent")));
    const [scheduledTodayResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sequenceStepsTable).where(and(eq(sequenceStepsTable.status, "scheduled"), sql`${sequenceStepsTable.scheduledFor} >= ${todayStart}`, sql`${sequenceStepsTable.scheduledFor} < ${tomorrowStart}`));
    const [scheduledTomorrowResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sequenceStepsTable).where(and(eq(sequenceStepsTable.status, "scheduled"), sql`${sequenceStepsTable.scheduledFor} >= ${tomorrowStart}`, sql`${sequenceStepsTable.scheduledFor} < ${tomorrowEnd}`));
    const [repliedResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.sequenceStatus, "paused_replied"));
    const [completedResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.sequenceStatus, "completed"));
    const [bouncedResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.bounced, true));
    const [reactivationResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sequenceStepsTable).where(and(eq(sequenceStepsTable.status, "scheduled"), sql`${sequenceStepsTable.stepNumber} >= 6`));
    const [dncResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.doNotContact, true));
    const [unsubResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contactsTable).where(eq(contactsTable.unsubscribed, true));

    const byCampaign = await db.select({
      campaign: contactsTable.campaignName,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).groupBy(contactsTable.campaignName);

    const bySegment = await db.select({
      segment: contactsTable.segmentType,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).groupBy(contactsTable.segmentType);

    const byStep = await db.select({
      step: contactsTable.currentStep,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).where(eq(contactsTable.sequenceStatus, "active")).groupBy(contactsTable.currentStep);

    const byTier = await db.select({
      tier: contactsTable.engagementTier,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).groupBy(contactsTable.engagementTier);

    const topEngaged = await db.select().from(contactsTable)
      .where(sql`${contactsTable.engagementScore} > 0`)
      .orderBy(desc(contactsTable.engagementScore))
      .limit(10);

    const [totalSentResult] = await db.select({ count: sql<number>`count(*)::int` }).from(sendLogsTable).where(eq(sendLogsTable.status, "sent"));
    const [totalOpenResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailEventsTable).where(eq(emailEventsTable.eventType, "open"));
    const [totalClickResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailEventsTable).where(eq(emailEventsTable.eventType, "click"));
    const [totalReplyResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailEventsTable).where(eq(emailEventsTable.eventType, "reply"));
    const [totalBounceResult] = await db.select({ count: sql<number>`count(*)::int` }).from(emailEventsTable).where(eq(emailEventsTable.eventType, "bounce"));

    const totalSent = totalSentResult?.count || 0;
    const openRate = totalSent > 0 ? ((totalOpenResult?.count || 0) / totalSent * 100).toFixed(1) + "%" : "0.0%";
    const clickRate = totalSent > 0 ? ((totalClickResult?.count || 0) / totalSent * 100).toFixed(1) + "%" : "0.0%";
    const replyRate = totalSent > 0 ? ((totalReplyResult?.count || 0) / totalSent * 100).toFixed(1) + "%" : "0.0%";
    const bounceRate = totalSent > 0 ? ((totalBounceResult?.count || 0) / totalSent * 100).toFixed(1) + "%" : "0.0%";

    const byStepPerformance = await db.select({
      stepNumber: sendLogsTable.stepNumber,
      sent: sql<number>`count(*)::int`,
    }).from(sendLogsTable).where(eq(sendLogsTable.status, "sent")).groupBy(sendLogsTable.stepNumber).orderBy(sendLogsTable.stepNumber);

    const recentSends = await db.select().from(sendLogsTable).orderBy(desc(sendLogsTable.sentAt)).limit(10);
    const contactIds = [...new Set(recentSends.map(l => l.contactId))];
    const contacts = contactIds.length > 0
      ? await db.select().from(contactsTable).where(sql`${contactsTable.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`,`)})`)
      : [];
    const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

    res.json({
      totalContacts: totalResult?.count || 0,
      activeSequences: activeResult?.count || 0,
      importedToday: importedTodayResult?.count || 0,
      sentToday: sentTodayResult?.count || 0,
      scheduledToday: scheduledTodayResult?.count || 0,
      scheduledTomorrow: scheduledTomorrowResult?.count || 0,
      pausedReplied: repliedResult?.count || 0,
      completed: completedResult?.count || 0,
      bouncedCount: bouncedResult?.count || 0,
      reactivationDue: reactivationResult?.count || 0,
      dncCount: dncResult?.count || 0,
      unsubscribedCount: unsubResult?.count || 0,
      totalSent,
      openRate,
      clickRate,
      replyRate,
      bounceRate,
      byCampaign: byCampaign.filter(c => c.campaign),
      bySegment: bySegment.filter(s => s.segment),
      byStep: byStep.filter(s => s.step !== null).map(s => ({ step: s.step!, count: s.count })),
      byTier: byTier.filter(t => t.tier),
      byStepPerformance,
      topEngaged: topEngaged.map(c => ({
        id: c.id, fullName: c.fullName, company: c.company, email: c.email,
        engagementScore: c.engagementScore, engagementTier: c.engagementTier, sequenceStatus: c.sequenceStatus,
      })),
      recentSends: recentSends.map(l => {
        const c = contactMap[l.contactId];
        return { ...l, contactName: c?.fullName || "", contactEmail: c?.email || "", company: c?.company || "" };
      }),
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/outbound-settings", async (_req, res) => {
  try {
    const defaults = [
      { key: "daily_send_cap", value: "50" },
      { key: "per_inbox_send_cap", value: "50" },
      { key: "send_window_start", value: "8" },
      { key: "send_window_end", value: "18" },
      { key: "business_days_only", value: "true" },
      { key: "randomized_spacing", value: "true" },
      { key: "reply_detection_interval", value: "30" },
      { key: "tracking_domain", value: "" },
    ];

    const existing = await db.select().from(settingsTable);
    const existingKeys = new Set(existing.map(s => s.key));

    for (const d of defaults) {
      if (!existingKeys.has(d.key)) {
        await db.insert(settingsTable).values(d).onConflictDoNothing();
      }
    }

    const settings = await db.select().from(settingsTable);
    res.json(settings);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/outbound-settings", async (req, res) => {
  try {
    const { settings: settingsArr } = req.body;
    for (const s of settingsArr) {
      await db.insert(settingsTable).values({ key: s.key, value: s.value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: s.value, updatedAt: new Date() } });
    }
    const settings = await db.select().from(settingsTable);
    res.json(settings);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/suppression-list", async (_req, res) => {
  try {
    const list = await db.select().from(suppressionListTable).orderBy(desc(suppressionListTable.createdAt));
    res.json(list);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/suppression-list", async (req, res) => {
  try {
    const { email, reason } = req.body;
    const [entry] = await db.insert(suppressionListTable).values({
      email: email.toLowerCase(),
      reason: reason || "manual",
    }).onConflictDoNothing().returning();

    if (!entry) return res.json({ success: false, message: "Email already on suppression list" });
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/suppression-list/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(suppressionListTable).where(eq(suppressionListTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/email-events", async (req, res) => {
  try {
    const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
    const eventType = req.query.eventType as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    let conditions: any[] = [];
    if (contactId) conditions.push(eq(emailEventsTable.contactId, contactId));
    if (eventType) conditions.push(eq(emailEventsTable.eventType, eventType));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const events = where
      ? await db.select().from(emailEventsTable).where(where).orderBy(desc(emailEventsTable.timestamp)).limit(limit)
      : await db.select().from(emailEventsTable).orderBy(desc(emailEventsTable.timestamp)).limit(limit);

    res.json(events);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/track/open", async (req, res) => {
  try {
    const contactId = req.query.contact_id ? parseInt(req.query.contact_id as string) : undefined;
    const sendLogId = req.query.send_log_id ? parseInt(req.query.send_log_id as string) : undefined;

    if (contactId) {
      await db.insert(emailEventsTable).values({
        contactId,
        sendLogId: sendLogId || null,
        eventType: "open",
        timestamp: new Date(),
      });

      const events = await db.select().from(emailEventsTable).where(eq(emailEventsTable.contactId, contactId));
      const score = calculateEngagementScore(events);
      const tier = getEngagementTier(score);
      await db.update(contactsTable).set({ engagementScore: score, engagementTier: tier, updatedAt: new Date() }).where(eq(contactsTable.id, contactId));
    }

    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.end(pixel);
  } catch (err) {
    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.setHeader("Content-Type", "image/gif");
    res.end(pixel);
  }
});

router.get("/track/click", async (req, res) => {
  const redirectUrl = req.query.redirect_url as string || req.query.url as string;

  const safeRedirect = (url: string | undefined) => {
    if (!url) return res.status(200).send("OK");
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).send("Invalid URL");
      res.redirect(url);
    } catch {
      res.status(400).send("Invalid URL");
    }
  };

  try {
    const contactId = req.query.contact_id ? parseInt(req.query.contact_id as string) : undefined;
    const sendLogId = req.query.send_log_id ? parseInt(req.query.send_log_id as string) : undefined;

    if (contactId) {
      await db.insert(emailEventsTable).values({
        contactId,
        sendLogId: sendLogId || null,
        eventType: "click",
        metadataJson: JSON.stringify({ url: redirectUrl }),
        timestamp: new Date(),
      });

      const events = await db.select().from(emailEventsTable).where(eq(emailEventsTable.contactId, contactId));
      const score = calculateEngagementScore(events);
      const tier = getEngagementTier(score);
      await db.update(contactsTable).set({ engagementScore: score, engagementTier: tier, updatedAt: new Date() }).where(eq(contactsTable.id, contactId));
    }

    safeRedirect(redirectUrl);
  } catch (err) {
    safeRedirect(redirectUrl);
  }
});

export default router;
