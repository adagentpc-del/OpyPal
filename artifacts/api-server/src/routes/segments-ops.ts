import { Router, type IRouter } from "express";
import { db, leadsTable, contactsTable, scheduledEmailsTable, activityTable, suppressionListTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

// Lightweight {{token}} renderer driven by a flat field map. Used so segment
// assignment can personalize without coupling to the lead-specific template
// engine (which assumes a contact shape).
function renderVars(template: string, vars: Record<string, any>): string {
  if (!template) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

function leadVars(l: any): Record<string, any> {
  const fullName = l.contactName || "";
  const firstName = fullName.split(" ")[0] || "";
  return {
    firstName,
    lastName: fullName.split(" ").slice(1).join(" "),
    fullName,
    contactName: fullName,
    company: l.companyName || "",
    companyName: l.companyName || "",
    title: l.title || "",
    location: l.location || "",
    industry: l.industry || "",
    event: l.event || "",
    email: l.email || "",
  };
}

function contactVars(c: any): Record<string, any> {
  return {
    firstName: c.firstName || (c.fullName || "").split(" ")[0] || "",
    lastName: c.lastName || (c.fullName || "").split(" ").slice(1).join(" ") || "",
    fullName: c.fullName || "",
    contactName: c.fullName || "",
    company: c.company || "",
    companyName: c.company || "",
    title: c.title || "",
    location: c.location || "",
    industry: c.industry || "",
    event: c.event || "",
    email: c.email || "",
  };
}

const assignSchema = z.object({
  segmentId: z.number().int().nullish(),
  leadIds: z.array(z.number().int()).optional().default([]),
  contactIds: z.array(z.number().int()).optional().default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  scheduledFor: z.string().optional(),
  sendVia: z.string().optional(),
  templateId: z.number().int().nullish(),
  campaignId: z.number().int().nullish(),
  source: z.string().optional(),
  setLifecycle: z.boolean().optional().default(true),
});

// Make a segment operational: stamp segment + lifecycle on each member and
// auto-create scheduled_emails (the converged send pipeline) for both leads and
// contacts. The background scheduler then sends them on schedule.
router.post("/segments/assign", requireRole("operator"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid request", errors: parsed.error.issues }); return; }
    const { segmentId, leadIds, contactIds, subject, body, scheduledFor, sendVia, templateId, campaignId, source, setLifecycle } = parsed.data;

    if (leadIds.length === 0 && contactIds.length === 0) {
      res.status(400).json({ message: "Provide at least one leadId or contactId" });
      return;
    }

    const when = scheduledFor ? new Date(scheduledFor) : new Date();
    const now = new Date();
    let leadsAssigned = 0;
    let contactsAssigned = 0;
    let emailsCreated = 0;
    let skipped = 0;

    // Suppression set for this workspace (lowercased emails).
    const suppressed = new Set(
      (await db.select({ email: suppressionListTable.email })
        .from(suppressionListTable)
        .where(eq(suppressionListTable.workspaceId, ws)))
        .map((s) => (s.email || "").toLowerCase())
    );

    if (leadIds.length > 0) {
      const leads = await db.select().from(leadsTable)
        .where(and(eq(leadsTable.workspaceId, ws), inArray(leadsTable.id, leadIds)));
      for (const l of leads) {
        const stopStatuses = ["Closed Won", "Closed Lost", "Do Not Contact"];
        if (!l.email || l.isUnsubscribed || l.isBounced || stopStatuses.includes(l.status) || suppressed.has(l.email.toLowerCase())) {
          skipped++;
          continue;
        }
        await db.update(leadsTable).set({
          segmentId: segmentId ?? l.segmentId,
          ...(setLifecycle ? { lifecycleStatus: "Campaign Assigned" } : {}),
          updatedAt: new Date(),
        }).where(and(eq(leadsTable.id, l.id), eq(leadsTable.workspaceId, ws)));

        const renderedSubject = renderVars(subject, leadVars(l));
        const renderedBody = renderVars(body, leadVars(l));
        const [se] = await db.insert(scheduledEmailsTable).values({
          workspaceId: ws,
          leadId: l.id,
          templateId: templateId ?? null,
          subject: renderedSubject,
          body: renderedBody,
          originalSubject: renderedSubject,
          originalBody: renderedBody,
          scheduledFor: when,
          status: "scheduled",
          source: source || "segment",
          campaignId: campaignId ?? null,
          sendVia: sendVia || "auto",
        }).returning({ id: scheduledEmailsTable.id });
        emailsCreated++;
        leadsAssigned++;

        await db.insert(activityTable).values({
          workspaceId: ws,
          type: "email_scheduled",
          description: `Segment assignment scheduled email: ${renderedSubject}`,
          leadId: l.id,
          relatedScheduledEmailId: se.id,
          metadata: { segmentId: segmentId ?? null, source: "segment_assign" },
          createdBy: req.body.createdBy || "user",
        });
      }
    }

    if (contactIds.length > 0) {
      const contacts = await db.select().from(contactsTable)
        .where(and(eq(contactsTable.workspaceId, ws), inArray(contactsTable.id, contactIds)));
      // Skip contacts that are stopped (replied/paused/DNC/etc.) AND contacts
      // that are still actively running through the sequence pipeline
      // ("active"/"pending"/"enrolled"). Creating a scheduled_email for an
      // actively-enrolled contact would double-send (sequence/process fires its
      // step AND the background scheduler fires this scheduled email). Only
      // contacts not currently driven by the sequence engine converge here.
      const stopSeq = ["paused_replied", "paused_manual", "do_not_contact", "unsubscribed", "bounce"];
      const activeSeq = ["active", "pending", "enrolled", "in_progress", "scheduled"];
      for (const c of contacts) {
        const seq = (c.sequenceStatus || "").toLowerCase();
        if (
          !c.email || c.doNotContact || c.unsubscribed || c.bounced ||
          stopSeq.includes(seq) || activeSeq.includes(seq) ||
          suppressed.has(c.email.toLowerCase())
        ) {
          skipped++;
          continue;
        }
        await db.update(contactsTable).set({
          segmentId: segmentId ?? c.segmentId,
          ...(setLifecycle ? { lifecycleStatus: "Campaign Assigned" } : {}),
          updatedAt: new Date(),
        }).where(and(eq(contactsTable.id, c.id), eq(contactsTable.workspaceId, ws)));

        const renderedSubject = renderVars(subject, contactVars(c));
        const renderedBody = renderVars(body, contactVars(c));
        const [se] = await db.insert(scheduledEmailsTable).values({
          workspaceId: ws,
          contactId: c.id,
          templateId: templateId ?? null,
          subject: renderedSubject,
          body: renderedBody,
          originalSubject: renderedSubject,
          originalBody: renderedBody,
          scheduledFor: when,
          status: "scheduled",
          source: source || "segment",
          campaignId: campaignId ?? null,
          sendVia: sendVia || "auto",
        }).returning({ id: scheduledEmailsTable.id });
        emailsCreated++;
        contactsAssigned++;

        await db.insert(activityTable).values({
          workspaceId: ws,
          type: "email_scheduled",
          description: `Segment assignment scheduled email: ${renderedSubject}`,
          relatedScheduledEmailId: se.id,
          metadata: { segmentId: segmentId ?? null, contactId: c.id, source: "segment_assign" },
          createdBy: req.body.createdBy || "user",
        });
      }
    }

    res.json({ leadsAssigned, contactsAssigned, emailsCreated, skipped });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

const bulkContactSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email(),
  company: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  event: z.string().optional(),
  companyWebsite: z.string().optional(),
  intentSignal: z.string().optional(),
  customLine: z.string().optional(),
  segmentId: z.number().int().nullish(),
  referral: z.boolean().optional(),
  referredBy: z.string().optional(),
  referralNotes: z.string().optional(),
}).passthrough();

const bulkImportSchema = z.object({
  contacts: z.array(bulkContactSchema).min(1),
  dedupeByEmail: z.boolean().optional().default(true),
});

// Bulk contact import — additive and idempotent (skips existing emails when
// dedupeByEmail). New contacts start at lifecycle "Draft" so they flow through
// the unified status model.
router.post("/contacts/bulk-import", requireRole("operator"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const parsed = bulkImportSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "Invalid request", errors: parsed.error.issues }); return; }
    const { contacts, dedupeByEmail } = parsed.data;

    const existing = dedupeByEmail
      ? new Set((await db.select({ email: contactsTable.email })
          .from(contactsTable)
          .where(eq(contactsTable.workspaceId, ws)))
          .map((c) => (c.email || "").toLowerCase()))
      : new Set<string>();

    let created = 0;
    let skipped = 0;
    const createdIds: number[] = [];
    const seen = new Set<string>();

    for (const c of contacts) {
      const key = c.email.toLowerCase();
      if (dedupeByEmail && (existing.has(key) || seen.has(key))) {
        skipped++;
        continue;
      }
      seen.add(key);

      let firstName = c.firstName;
      let lastName = c.lastName;
      if (c.fullName && (!firstName || !lastName)) {
        const parts = c.fullName.trim().split(/\s+/);
        if (!firstName) firstName = parts[0] || "";
        if (!lastName) lastName = parts.slice(1).join(" ");
      }
      const fullName = c.fullName || [firstName, lastName].filter(Boolean).join(" ") || c.email;

      const [inserted] = await db.insert(contactsTable).values({
        ...c,
        fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        lifecycleStatus: "Draft",
        segmentId: c.segmentId ?? null,
        workspaceId: ws,
      } as any).returning({ id: contactsTable.id });
      created++;
      createdIds.push(inserted.id);
    }

    res.json({ created, skipped, createdIds });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
