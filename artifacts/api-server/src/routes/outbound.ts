import { Router, type IRouter } from "express";
import { db, contactsTable, sequenceStepsTable, sendLogsTable, importsTable, settingsTable, templatesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

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
    const { fileName, rows, campaignName, templateSetName, autoEnroll } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validRows = rows.filter((r: any) => r.email && emailRegex.test(r.email) && r.fullName && r.company);
    const invalidCount = rows.length - validRows.length;

    const uniqueEmails = new Set<string>();
    const dedupedRows = validRows.filter((r: any) => {
      const key = r.email.toLowerCase();
      if (uniqueEmails.has(key)) return false;
      uniqueEmails.add(key);
      return true;
    });
    const inFileDupes = validRows.length - dedupedRows.length;

    const existingContacts = await db.select({ email: contactsTable.email, sequenceStatus: contactsTable.sequenceStatus })
      .from(contactsTable);
    const existingMap = new Map(existingContacts.map((c: any) => [c.email?.toLowerCase(), c.sequenceStatus]));

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;
    let enrolled = 0;
    const importedContactIds: number[] = [];

    const [importRecord] = await db.insert(importsTable).values({
      fileName,
      totalRows: rows.length,
      campaignName: campaignName || null,
      templateSetName: templateSetName || null,
      status: "processing",
    }).returning();

    for (const row of dedupedRows) {
      const emailLower = (row as any).email.toLowerCase();
      const existingStatus = existingMap.get(emailLower);

      if (existingStatus === "active") {
        skipped++;
        duplicates++;
        continue;
      }

      if (existingStatus) {
        duplicates++;
      }

      const [contact] = await db.insert(contactsTable).values({
        fullName: (row as any).fullName,
        company: (row as any).company,
        title: (row as any).title || null,
        email: (row as any).email,
        phone: (row as any).phone || null,
        location: (row as any).location || null,
        intentSignal: (row as any).intentSignal || null,
        whySelected: (row as any).whySelected || null,
        campaignName: campaignName || null,
        assignedTemplateSet: templateSetName || null,
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

    if (autoEnroll && importedContactIds.length > 0) {
      const { or: drizzleOr } = await import("drizzle-orm");
      const allTemplates = await db.select().from(templatesTable)
        .where(drizzleOr(eq(templatesTable.category, "Cold Email"), eq(templatesTable.category, "Follow-Up Email")));
      const coldTemplates = allTemplates.filter(t => t.category === "Cold Email");
      const followUpTemplates = allTemplates.filter(t => t.category === "Follow-Up Email");

      for (const contactId of importedContactIds) {
        try {
          const [c] = await db.select().from(contactsTable).where(eq(contactsTable.id, contactId));
          if (!c) continue;
          const now = new Date();

          const firstName = (c.fullName || "").split(" ")[0] || "there";
          const steps = SEQUENCE_DELAYS.map((delay, idx) => {
            const pool = idx === 0 ? coldTemplates : followUpTemplates;
            const template = pool.length > 0 ? pool[idx % pool.length] : null;
            let subj = template?.subject || "";
            let bod = template?.body || "";
            const repl: Record<string, string> = {
              "[First Name]": firstName, "[Name]": c.fullName || "",
              "[Company Name]": c.company || "", "[Company]": c.company || "",
              "[company]": c.company || "", "[Title]": c.title || "",
              "[Location]": c.location || "",
            };
            for (const [k, v] of Object.entries(repl)) {
              subj = subj.split(k).join(v);
              bod = bod.split(k).join(v);
            }
            return {
              contactId,
              stepNumber: idx + 1,
              templateSetName: templateSetName || null,
              templateId: template?.id || null,
              delayDays: delay,
              subject: subj,
              body: bod,
              status: "scheduled" as const,
              scheduledFor: delay === 0 ? now : addBusinessDays(now, delay),
            };
          });

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

    const byCampaign = await db.select({
      campaign: contactsTable.campaignName,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).groupBy(contactsTable.campaignName);

    const byStep = await db.select({
      step: contactsTable.currentStep,
      count: sql<number>`count(*)::int`,
    }).from(contactsTable).where(eq(contactsTable.sequenceStatus, "active")).groupBy(contactsTable.currentStep);

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
      byCampaign: byCampaign.filter(c => c.campaign),
      byStep: byStep.filter(s => s.step !== null).map(s => ({ step: s.step!, count: s.count })),
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
      { key: "send_window_start", value: "8" },
      { key: "send_window_end", value: "18" },
      { key: "business_days_only", value: "true" },
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

export default router;
