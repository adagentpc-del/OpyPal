import { Router, type IRouter } from "express";
import {
  db,
  campaignsTable,
  campaignSegmentsTable,
  campaignAssetsTable,
  campaignSchedulesTable,
  leadsTable,
  templatesTable,
  sequenceTemplatesTable,
  scheduledEmailsTable,
  workspacesTable,
} from "@workspace/db";
import type { WorkspaceSenderIdentity } from "@workspace/db";
import { eq, and, or, ilike, inArray, sql, desc } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";
import { validateRecipients, executeBulkSend } from "../lib/bulk-send-engine";
import { checkResendConnection, DEFAULT_REPLY_TO, DEFAULT_FROM_EMAIL } from "../lib/resend";

const router: IRouter = Router();

// Standard contact-type labels offered in the segment builder. Workspaces can
// also use any distinct lead.contact_type values already present in their data.
const STANDARD_CONTACT_TYPES = [
  "Hotels",
  "Venues",
  "Clinics",
  "Med Spas",
  "Restaurants",
  "Agencies",
  "Coaches",
  "Event Planners",
  "Real Estate",
  "Fitness Studios",
];

function parseJsonArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

// Coerces a send-window value to minutes-since-midnight (the schema stores these
// as integers). Accepts "HH:MM" strings from <input type="time">, plain numeric
// strings, or numbers; returns null for empty/invalid input.
function toMinutes(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "string") {
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const mins = Number(m[1]) * 60 + Number(m[2]);
      return mins >= 0 && mins < 24 * 60 ? mins : null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

// Verifies a segment exists and belongs to the given campaign + workspace.
// Used to reject schedule/asset writes that reference a segment from another
// campaign or workspace.
async function segmentBelongsToCampaign(
  segmentId: number,
  campaignId: number,
  workspaceId: number,
): Promise<boolean> {
  if (!Number.isFinite(segmentId)) return false;
  const [seg] = await db
    .select({ id: campaignSegmentsTable.id })
    .from(campaignSegmentsTable)
    .where(
      and(
        eq(campaignSegmentsTable.id, segmentId),
        eq(campaignSegmentsTable.campaignId, campaignId),
        eq(campaignSegmentsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return !!seg;
}

interface AudienceCriteria {
  contactTypes?: string[];
  filterRules?: Record<string, any>;
  manualLeadIds?: number[];
}

// Resolves a segment's targeting criteria to a deduplicated list of leads in the
// workspace. The send pipeline operates on leads (scheduled_emails.lead_id), so
// segments resolve to leads rather than contacts. Contact-type labels match the
// lead's contact_type, industry, or project_type (case-insensitive) so existing
// data is targetable before any explicit tagging.
async function resolveAudience(workspaceId: number, criteria: AudienceCriteria) {
  const contactTypes = (criteria.contactTypes ?? []).filter((t) => typeof t === "string" && t.trim());
  const rules = criteria.filterRules ?? {};
  const manualIds = (criteria.manualLeadIds ?? [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));

  const hasRuleCriteria =
    contactTypes.length > 0 ||
    !!rules.status ||
    !!rules.pipelineType ||
    !!rules.source ||
    !!rules.industry ||
    !!rules.search;

  const matchedIds = new Map<number, any>();

  if (hasRuleCriteria) {
    const conds: any[] = [eq(leadsTable.workspaceId, workspaceId)];

    if (contactTypes.length > 0) {
      const typeConds = contactTypes.flatMap((t) => [
        ilike(leadsTable.contactType, t),
        ilike(leadsTable.industry, `%${t}%`),
        ilike(leadsTable.projectType, `%${t}%`),
      ]);
      conds.push(or(...typeConds));
    }
    if (rules.status) conds.push(eq(leadsTable.status, String(rules.status)));
    if (rules.pipelineType) conds.push(eq(leadsTable.pipelineType, String(rules.pipelineType)));
    if (rules.source) conds.push(eq(leadsTable.source, String(rules.source)));
    if (rules.industry) conds.push(ilike(leadsTable.industry, `%${rules.industry}%`));
    if (rules.search) {
      const s = `%${rules.search}%`;
      conds.push(or(ilike(leadsTable.companyName, s), ilike(leadsTable.contactName, s), ilike(leadsTable.email, s)));
    }

    const rows = await db.select().from(leadsTable).where(and(...conds));
    for (const r of rows) matchedIds.set(r.id, r);
  }

  if (manualIds.length > 0) {
    const rows = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.workspaceId, workspaceId), inArray(leadsTable.id, manualIds)));
    for (const r of rows) matchedIds.set(r.id, r);
  }

  return Array.from(matchedIds.values());
}

function leadToRecipient(lead: any) {
  return {
    leadId: lead.id,
    companyName: lead.companyName,
    contactName: lead.contactName,
    email: lead.email,
    title: lead.title ?? undefined,
    location: lead.location ?? undefined,
    industry: lead.industry ?? undefined,
    isUnsubscribed: !!lead.isUnsubscribed,
    isBounced: !!lead.isBounced,
  };
}

async function getCampaignOr404(req: any, res: any): Promise<any | null> {
  const id = Number(req.params.campaignId ?? req.params.id);
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, id), eq(campaignsTable.workspaceId, req.workspaceId!)));
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return null;
  }
  return campaign;
}

async function getSegmentOr404(req: any, res: any): Promise<any | null> {
  const id = Number(req.params.id);
  const [segment] = await db
    .select()
    .from(campaignSegmentsTable)
    .where(and(eq(campaignSegmentsTable.id, id), eq(campaignSegmentsTable.workspaceId, req.workspaceId!)));
  if (!segment) {
    res.status(404).json({ message: "Segment not found" });
    return null;
  }
  return segment;
}

// Status-based performance for a given executed bulk-send campaign id.
async function performanceForBulkCampaign(workspaceId: number, bulkCampaignId: number | null) {
  const empty = { total: 0, sent: 0, scheduled: 0, queued: 0, failed: 0, canceled: 0, paused: 0 };
  if (!bulkCampaignId) return empty;
  const rows = await db
    .select({ status: scheduledEmailsTable.status, count: sql<number>`count(*)::int` })
    .from(scheduledEmailsTable)
    .where(and(eq(scheduledEmailsTable.workspaceId, workspaceId), eq(scheduledEmailsTable.campaignId, bulkCampaignId)))
    .groupBy(scheduledEmailsTable.status);
  const out = { ...empty };
  for (const r of rows) {
    out.total += r.count;
    if (r.status === "sent") out.sent += r.count;
    else if (r.status === "scheduled") out.scheduled += r.count;
    else if (r.status === "queued") out.queued += r.count;
    else if (r.status === "failed") out.failed += r.count;
    else if (r.status === "canceled") out.canceled += r.count;
    else if (r.status === "paused") out.paused += r.count;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Contact types helper (for the segment builder UI)
// ---------------------------------------------------------------------------
router.get("/campaign-contact-types", async (req, res) => {
  try {
    const rows = await db
      .selectDistinct({ contactType: leadsTable.contactType })
      .from(leadsTable)
      .where(eq(leadsTable.workspaceId, req.workspaceId!));
    const existing = rows.map((r) => r.contactType).filter((t): t is string => !!t && !!t.trim());
    const merged = Array.from(new Set([...STANDARD_CONTACT_TYPES, ...existing]));
    res.json(merged);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------
router.get("/campaigns/:campaignId/segments", async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const segments = await db
      .select()
      .from(campaignSegmentsTable)
      .where(eq(campaignSegmentsTable.campaignId, campaign.id))
      .orderBy(campaignSegmentsTable.id);

    const result = [];
    for (const seg of segments) {
      const audience = await resolveAudience(req.workspaceId!, {
        contactTypes: parseJsonArray(seg.contactTypes),
        filterRules: parseJsonObject(seg.filterRules),
        manualLeadIds: parseJsonArray(seg.manualLeadIds),
      });
      const performance = await performanceForBulkCampaign(req.workspaceId!, seg.lastBulkCampaignId);
      result.push({ ...seg, audienceCount: audience.length, performance });
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/campaigns/:campaignId/segments", requireRole("operator"), async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const b = req.body ?? {};
    const [segment] = await db
      .insert(campaignSegmentsTable)
      .values({
        workspaceId: req.workspaceId!,
        campaignId: campaign.id,
        name: b.name || "Untitled segment",
        contactTypes: b.contactTypes != null ? JSON.stringify(b.contactTypes) : null,
        filterRules: b.filterRules != null ? JSON.stringify(b.filterRules) : null,
        manualLeadIds: b.manualLeadIds != null ? JSON.stringify(b.manualLeadIds) : null,
        templateId: b.templateId ?? null,
        sequenceId: b.sequenceId ?? null,
        senderName: b.senderName ?? null,
        senderEmail: b.senderEmail ?? null,
        replyTo: b.replyTo ?? null,
        provider: b.provider ?? null,
        scheduledFor: b.scheduledFor ? new Date(b.scheduledFor) : null,
        sendWindowStart: toMinutes(b.sendWindowStart),
        sendWindowEnd: toMinutes(b.sendWindowEnd),
        assetIds: b.assetIds != null ? JSON.stringify(b.assetIds) : null,
        status: b.status || "draft",
        notes: b.notes ?? null,
      })
      .returning();
    res.status(201).json(segment);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/campaign-segments/:id", requireRole("operator"), async (req, res) => {
  try {
    const segment = await getSegmentOr404(req, res);
    if (!segment) return;
    const b = req.body ?? {};
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (b.name !== undefined) updates.name = b.name;
    if (b.contactTypes !== undefined) updates.contactTypes = b.contactTypes != null ? JSON.stringify(b.contactTypes) : null;
    if (b.filterRules !== undefined) updates.filterRules = b.filterRules != null ? JSON.stringify(b.filterRules) : null;
    if (b.manualLeadIds !== undefined) updates.manualLeadIds = b.manualLeadIds != null ? JSON.stringify(b.manualLeadIds) : null;
    if (b.templateId !== undefined) updates.templateId = b.templateId;
    if (b.sequenceId !== undefined) updates.sequenceId = b.sequenceId;
    if (b.senderName !== undefined) updates.senderName = b.senderName;
    if (b.senderEmail !== undefined) updates.senderEmail = b.senderEmail;
    if (b.replyTo !== undefined) updates.replyTo = b.replyTo;
    if (b.provider !== undefined) updates.provider = b.provider;
    if (b.scheduledFor !== undefined) updates.scheduledFor = b.scheduledFor ? new Date(b.scheduledFor) : null;
    if (b.sendWindowStart !== undefined) updates.sendWindowStart = toMinutes(b.sendWindowStart);
    if (b.sendWindowEnd !== undefined) updates.sendWindowEnd = toMinutes(b.sendWindowEnd);
    if (b.assetIds !== undefined) updates.assetIds = b.assetIds != null ? JSON.stringify(b.assetIds) : null;
    if (b.status !== undefined) updates.status = b.status;
    if (b.notes !== undefined) updates.notes = b.notes;

    const [updated] = await db
      .update(campaignSegmentsTable)
      .set(updates)
      .where(and(eq(campaignSegmentsTable.id, segment.id), eq(campaignSegmentsTable.workspaceId, req.workspaceId!)))
      .returning();
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/campaign-segments/:id", requireRole("operator"), async (req, res) => {
  try {
    const segment = await getSegmentOr404(req, res);
    if (!segment) return;
    await db
      .delete(campaignSegmentsTable)
      .where(and(eq(campaignSegmentsTable.id, segment.id), eq(campaignSegmentsTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Live audience preview for ad-hoc criteria (used by the segment builder before
// saving). Returns the count and a small sample.
router.post("/campaigns/:campaignId/segments/preview-audience", requireRole("operator"), async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const audience = await resolveAudience(req.workspaceId!, {
      contactTypes: req.body?.contactTypes ?? [],
      filterRules: req.body?.filterRules ?? {},
      manualLeadIds: req.body?.manualLeadIds ?? [],
    });
    res.json({
      count: audience.length,
      sample: audience.slice(0, 25).map((l) => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        email: l.email,
        contactType: l.contactType,
        industry: l.industry,
        status: l.status,
        isUnsubscribed: !!l.isUnsubscribed,
        isBounced: !!l.isBounced,
      })),
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/campaign-segments/:id/audience", async (req, res) => {
  try {
    const segment = await getSegmentOr404(req, res);
    if (!segment) return;
    const audience = await resolveAudience(req.workspaceId!, {
      contactTypes: parseJsonArray(segment.contactTypes),
      filterRules: parseJsonObject(segment.filterRules),
      manualLeadIds: parseJsonArray(segment.manualLeadIds),
    });
    res.json({
      count: audience.length,
      contacts: audience.map((l) => ({
        id: l.id,
        companyName: l.companyName,
        contactName: l.contactName,
        email: l.email,
        contactType: l.contactType,
        industry: l.industry,
        status: l.status,
        isUnsubscribed: !!l.isUnsubscribed,
        isBounced: !!l.isBounced,
      })),
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/campaign-segments/:id/performance", async (req, res) => {
  try {
    const segment = await getSegmentOr404(req, res);
    if (!segment) return;
    const performance = await performanceForBulkCampaign(req.workspaceId!, segment.lastBulkCampaignId);
    res.json({ segmentId: segment.id, lastBulkCampaignId: segment.lastBulkCampaignId, lastRunAt: segment.lastRunAt, performance });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Segment send execution (reuses the existing bulk-send engine + pipeline)
// ---------------------------------------------------------------------------
async function resolveSenderIdentity(req: any, segment: any, campaign: any) {
  const [ws] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, req.workspaceId!));
  const wsIdentity: WorkspaceSenderIdentity = (ws?.senderIdentity as WorkspaceSenderIdentity) ?? {};
  return {
    senderName: segment.senderName || campaign.defaultSenderName || wsIdentity.fromName || "Alyssa",
    senderEmail: segment.senderEmail || campaign.defaultSenderEmail || wsIdentity.fromEmail || DEFAULT_FROM_EMAIL,
    replyTo: segment.replyTo || campaign.defaultReplyTo || wsIdentity.replyToEmail || DEFAULT_REPLY_TO,
  };
}

async function sequenceStepsForSet(workspaceId: number, templateSetId: number | null) {
  if (!templateSetId) return undefined;
  const steps = await db
    .select()
    .from(sequenceTemplatesTable)
    .where(and(eq(sequenceTemplatesTable.workspaceId, workspaceId), eq(sequenceTemplatesTable.templateSetId, templateSetId)))
    .orderBy(sequenceTemplatesTable.stepNumber);
  if (steps.length === 0) return undefined;
  return steps.map((s) => ({ stepNumber: s.stepNumber, subject: s.subject || "", body: s.body, delayDays: s.delayDays }));
}

// Shared executor used by segment send and schedule run.
async function executeSegmentSend(opts: {
  req: any;
  campaign: any;
  segment: any;
  templateId: number | null;
  sequenceId: number | null;
  mode: "send_now" | "schedule";
  scheduledFor?: string | Date | null;
  label?: string;
}) {
  const { req, campaign, segment } = opts;
  const templateId = opts.templateId ?? segment.templateId ?? null;
  const sequenceId = opts.sequenceId ?? segment.sequenceId ?? null;

  if (!templateId) {
    return { error: "Segment has no template selected" as const };
  }

  const [template] = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.id, templateId), eq(templatesTable.workspaceId, req.workspaceId!)));
  if (!template) return { error: "Template not found" as const };

  const audience = await resolveAudience(req.workspaceId!, {
    contactTypes: parseJsonArray(segment.contactTypes),
    filterRules: parseJsonObject(segment.filterRules),
    manualLeadIds: parseJsonArray(segment.manualLeadIds),
  });
  if (audience.length === 0) return { error: "Segment audience is empty" as const };

  const recipients = audience.map(leadToRecipient);
  const report = await validateRecipients(recipients, sequenceId ?? undefined, req.workspaceId!);
  const totalSkipped =
    report.skippedNoEmail.length +
    report.skippedInvalidEmail.length +
    report.skippedUnsubscribed.length +
    report.skippedBounced.length +
    report.skippedDuplicateEmail.length +
    report.skippedDuplicateEnrollment.length;

  if (report.ready.length === 0) {
    return { error: "All recipients were suppressed; nothing to send." as const, totalSkipped };
  }

  const sender = await resolveSenderIdentity(req, segment, campaign);
  const sequenceSteps = await sequenceStepsForSet(req.workspaceId!, sequenceId);

  const result = await executeBulkSend(
    {
      recipients: report.ready,
      templateId: template.id,
      templateName: template.name,
      subject: template.subject || template.name,
      body: template.body,
      sequenceId: sequenceId ?? undefined,
      sequenceSteps,
      activateSequence: !!sequenceSteps && sequenceSteps.length > 1,
      mode: opts.mode,
      scheduledFor: opts.scheduledFor ? new Date(opts.scheduledFor).toISOString() : undefined,
      campaignName: `${campaign.name} / ${opts.label || segment.name}`,
      senderEmail: sender.senderEmail,
      senderName: sender.senderName,
      replyTo: sender.replyTo,
      totalSkipped,
    },
    req.workspaceId!,
  );

  return { result, totalSkipped };
}

router.post("/campaign-segments/:id/send", requireRole("manager"), async (req, res) => {
  try {
    const segment = await getSegmentOr404(req, res);
    if (!segment) return;
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, segment.campaignId), eq(campaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const mode: "send_now" | "schedule" = req.body?.mode === "schedule" ? "schedule" : "send_now";
    const scheduledFor = req.body?.scheduledFor ?? segment.scheduledFor ?? null;

    if (mode === "send_now") {
      const conn = await checkResendConnection();
      if (!conn.connected) return res.status(400).json({ message: `Email provider not configured: ${conn.error}` });
    }

    const outcome = await executeSegmentSend({
      req,
      campaign,
      segment,
      templateId: req.body?.templateId ?? null,
      sequenceId: req.body?.sequenceId ?? null,
      mode,
      scheduledFor,
    });

    if ("error" in outcome) {
      return res.status(400).json({ message: outcome.error, totalSkipped: (outcome as any).totalSkipped });
    }

    await db
      .update(campaignSegmentsTable)
      .set({
        lastBulkCampaignId: outcome.result.campaignId,
        lastRunAt: new Date(),
        status: mode === "schedule" ? "scheduled" : "sending",
        updatedAt: new Date(),
      })
      .where(eq(campaignSegmentsTable.id, segment.id));

    res.json(outcome.result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
router.get("/campaigns/:campaignId/schedules", async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const schedules = await db
      .select()
      .from(campaignSchedulesTable)
      .where(eq(campaignSchedulesTable.campaignId, campaign.id))
      .orderBy(campaignSchedulesTable.scheduledFor);
    res.json(schedules);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/campaigns/:campaignId/schedules", requireRole("operator"), async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const b = req.body ?? {};
    if (!b.scheduledFor) return res.status(400).json({ message: "scheduledFor is required" });
    // A schedule must target a segment: the send path resolves its audience from
    // the segment, so a segment-less schedule could never run.
    if (b.segmentId == null) return res.status(400).json({ message: "segmentId is required" });
    const segmentId = Number(b.segmentId);
    if (!(await segmentBelongsToCampaign(segmentId, campaign.id, req.workspaceId!))) {
      return res.status(400).json({ message: "Segment does not belong to this campaign" });
    }
    const [schedule] = await db
      .insert(campaignSchedulesTable)
      .values({
        workspaceId: req.workspaceId!,
        campaignId: campaign.id,
        segmentId,
        label: b.label ?? null,
        templateId: b.templateId ?? null,
        sequenceId: b.sequenceId ?? null,
        scheduledFor: new Date(b.scheduledFor),
        sendWindowStart: toMinutes(b.sendWindowStart),
        sendWindowEnd: toMinutes(b.sendWindowEnd),
        status: b.status || "scheduled",
      })
      .returning();
    res.status(201).json(schedule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/campaign-schedules/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const [existing] = await db
      .select()
      .from(campaignSchedulesTable)
      .where(and(eq(campaignSchedulesTable.id, id), eq(campaignSchedulesTable.workspaceId, req.workspaceId!)));
    if (!existing) return res.status(404).json({ message: "Schedule not found" });
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (b.segmentId !== undefined) {
      // A schedule must always target a segment, and that segment must belong to
      // the schedule's campaign + workspace.
      if (b.segmentId == null) return res.status(400).json({ message: "segmentId is required" });
      const segmentId = Number(b.segmentId);
      if (!(await segmentBelongsToCampaign(segmentId, existing.campaignId, req.workspaceId!))) {
        return res.status(400).json({ message: "Segment does not belong to this campaign" });
      }
      updates.segmentId = segmentId;
    }
    if (b.label !== undefined) updates.label = b.label;
    if (b.templateId !== undefined) updates.templateId = b.templateId;
    if (b.sequenceId !== undefined) updates.sequenceId = b.sequenceId;
    if (b.scheduledFor !== undefined) updates.scheduledFor = new Date(b.scheduledFor);
    if (b.sendWindowStart !== undefined) updates.sendWindowStart = toMinutes(b.sendWindowStart);
    if (b.sendWindowEnd !== undefined) updates.sendWindowEnd = toMinutes(b.sendWindowEnd);
    if (b.status !== undefined) updates.status = b.status;
    const [updated] = await db
      .update(campaignSchedulesTable)
      .set(updates)
      .where(and(eq(campaignSchedulesTable.id, id), eq(campaignSchedulesTable.workspaceId, req.workspaceId!)))
      .returning();
    if (!updated) return res.status(404).json({ message: "Schedule not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/campaign-schedules/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(campaignSchedulesTable)
      .where(and(eq(campaignSchedulesTable.id, id), eq(campaignSchedulesTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Execute a schedule now (or enqueue at its scheduledFor). Uses the schedule's
// segment audience + template/sequence overrides.
router.post("/campaign-schedules/:id/run", requireRole("manager"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [schedule] = await db
      .select()
      .from(campaignSchedulesTable)
      .where(and(eq(campaignSchedulesTable.id, id), eq(campaignSchedulesTable.workspaceId, req.workspaceId!)));
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });
    if (!schedule.segmentId) return res.status(400).json({ message: "Schedule has no segment to send to" });

    const [segment] = await db
      .select()
      .from(campaignSegmentsTable)
      .where(and(eq(campaignSegmentsTable.id, schedule.segmentId), eq(campaignSegmentsTable.workspaceId, req.workspaceId!)));
    if (!segment) return res.status(404).json({ message: "Segment not found" });
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, schedule.campaignId), eq(campaignsTable.workspaceId, req.workspaceId!)));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const mode: "send_now" | "schedule" = req.body?.mode === "send_now" ? "send_now" : "schedule";
    if (mode === "send_now") {
      const conn = await checkResendConnection();
      if (!conn.connected) return res.status(400).json({ message: `Email provider not configured: ${conn.error}` });
    }

    const outcome = await executeSegmentSend({
      req,
      campaign,
      segment,
      templateId: schedule.templateId ?? null,
      sequenceId: schedule.sequenceId ?? null,
      mode,
      scheduledFor: mode === "schedule" ? schedule.scheduledFor : null,
      label: schedule.label || segment.name,
    });

    if ("error" in outcome) {
      return res.status(400).json({ message: outcome.error, totalSkipped: (outcome as any).totalSkipped });
    }

    await db
      .update(campaignSchedulesTable)
      .set({ lastBulkCampaignId: outcome.result.campaignId, lastRunAt: new Date(), status: "queued", updatedAt: new Date() })
      .where(eq(campaignSchedulesTable.id, schedule.id));

    res.json(outcome.result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
router.get("/campaigns/:campaignId/assets", async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const assets = await db
      .select()
      .from(campaignAssetsTable)
      .where(eq(campaignAssetsTable.campaignId, campaign.id))
      .orderBy(desc(campaignAssetsTable.createdAt));
    res.json(assets);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/campaigns/:campaignId/assets", requireRole("operator"), async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const b = req.body ?? {};
    if (!b.title) return res.status(400).json({ message: "title is required" });
    let assetSegmentId: number | null = null;
    if (b.segmentId != null) {
      assetSegmentId = Number(b.segmentId);
      if (!(await segmentBelongsToCampaign(assetSegmentId, campaign.id, req.workspaceId!))) {
        return res.status(400).json({ message: "Segment does not belong to this campaign" });
      }
    }
    const [asset] = await db
      .insert(campaignAssetsTable)
      .values({
        workspaceId: req.workspaceId!,
        campaignId: campaign.id,
        segmentId: assetSegmentId,
        assetId: b.assetId ?? null,
        title: b.title,
        contentType: b.contentType ?? null,
        url: b.url ?? null,
        objectPath: b.objectPath ?? null,
      })
      .returning();
    res.status(201).json(asset);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/campaign-assets/:id", requireRole("operator"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(campaignAssetsTable)
      .where(and(eq(campaignAssetsTable.id, id), eq(campaignAssetsTable.workspaceId, req.workspaceId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Campaign-level aggregate performance (across all segments' last sends)
// ---------------------------------------------------------------------------
router.get("/campaigns/:campaignId/performance", async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;
    const segments = await db
      .select()
      .from(campaignSegmentsTable)
      .where(eq(campaignSegmentsTable.campaignId, campaign.id));

    const totals = { total: 0, sent: 0, scheduled: 0, queued: 0, failed: 0, canceled: 0, paused: 0 };
    const perSegment = [];
    for (const seg of segments) {
      const performance = await performanceForBulkCampaign(req.workspaceId!, seg.lastBulkCampaignId);
      perSegment.push({ segmentId: seg.id, name: seg.name, performance });
      for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += performance[k];
    }
    res.json({ campaignId: campaign.id, totals, segments: perSegment });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
