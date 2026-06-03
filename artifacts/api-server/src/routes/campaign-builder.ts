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

type Performance = { total: number; sent: number; scheduled: number; queued: number; failed: number; canceled: number; paused: number };

function emptyPerformance(): Performance {
  return { total: 0, sent: 0, scheduled: 0, queued: 0, failed: 0, canceled: 0, paused: 0 };
}

// Folds a single (status, count) row into a performance tally.
function accumulatePerformance(out: Performance, status: string | null, count: number) {
  out.total += count;
  if (status === "sent") out.sent += count;
  else if (status === "scheduled") out.scheduled += count;
  else if (status === "queued") out.queued += count;
  else if (status === "failed") out.failed += count;
  else if (status === "canceled") out.canceled += count;
  else if (status === "paused") out.paused += count;
}

// Status-based performance for a given executed bulk-send campaign id.
async function performanceForBulkCampaign(workspaceId: number, bulkCampaignId: number | null) {
  if (!bulkCampaignId) return emptyPerformance();
  const map = await performanceForBulkCampaigns(workspaceId, [bulkCampaignId]);
  return map.get(bulkCampaignId) ?? emptyPerformance();
}

// Batched status-based performance for many bulk-send campaign ids. Computes all
// per-campaign tallies in a single grouped query (instead of one query per id)
// so the segments list and Performance tab stay flat as segment count grows.
// Returns a map keyed by bulk campaign id; every requested non-null id is present
// (with a zeroed tally when it has no scheduled emails yet).
async function performanceForBulkCampaigns(
  workspaceId: number,
  bulkCampaignIds: (number | null | undefined)[],
): Promise<Map<number, Performance>> {
  const ids = Array.from(
    new Set(bulkCampaignIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))),
  );
  const map = new Map<number, Performance>();
  for (const id of ids) map.set(id, emptyPerformance());
  if (ids.length === 0) return map;

  const rows = await db
    .select({
      campaignId: scheduledEmailsTable.campaignId,
      status: scheduledEmailsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(scheduledEmailsTable)
    .where(and(eq(scheduledEmailsTable.workspaceId, workspaceId), inArray(scheduledEmailsTable.campaignId, ids)))
    .groupBy(scheduledEmailsTable.campaignId, scheduledEmailsTable.status);

  for (const r of rows) {
    if (r.campaignId == null) continue;
    const out = map.get(r.campaignId);
    if (out) accumulatePerformance(out, r.status, r.count);
  }
  return map;
}

// Columns required to evaluate a segment's audience criteria in memory. The
// segments list resolves audience counts for every segment from a single
// workspace-wide leads fetch (below) instead of one query per segment.
type MatchableLead = {
  id: number;
  contactType: string | null;
  industry: string | null;
  projectType: string | null;
  status: string | null;
  pipelineType: string | null;
  source: string | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
};

async function fetchWorkspaceLeadsForMatching(workspaceId: number): Promise<MatchableLead[]> {
  return db
    .select({
      id: leadsTable.id,
      contactType: leadsTable.contactType,
      industry: leadsTable.industry,
      projectType: leadsTable.projectType,
      status: leadsTable.status,
      pipelineType: leadsTable.pipelineType,
      source: leadsTable.source,
      companyName: leadsTable.companyName,
      contactName: leadsTable.contactName,
      email: leadsTable.email,
    })
    .from(leadsTable)
    .where(eq(leadsTable.workspaceId, workspaceId));
}

function ciEquals(value: string | null, target: string): boolean {
  return value != null && value.toLowerCase() === target.toLowerCase();
}

function ciIncludes(value: string | null, target: string): boolean {
  return value != null && value.toLowerCase().includes(target.toLowerCase());
}

// In-memory equivalent of resolveAudience used for batch counting. Given a
// pre-fetched set of workspace leads, returns the count of leads matching a
// segment's criteria. Mirrors resolveAudience's SQL semantics: contact-type
// labels match contact_type (exact, case-insensitive) or industry/project_type
// (substring, case-insensitive); status/pipelineType/source are exact matches;
// industry/search are case-insensitive substring matches; manual ids are unioned.
function countAudienceForCriteria(leads: MatchableLead[], criteria: AudienceCriteria): number {
  const contactTypes = (criteria.contactTypes ?? []).filter((t) => typeof t === "string" && t.trim());
  const rules = criteria.filterRules ?? {};
  const manualIds = new Set(
    (criteria.manualLeadIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n)),
  );

  const hasRuleCriteria =
    contactTypes.length > 0 ||
    !!rules.status ||
    !!rules.pipelineType ||
    !!rules.source ||
    !!rules.industry ||
    !!rules.search;

  const matched = new Set<number>();

  if (hasRuleCriteria) {
    for (const lead of leads) {
      if (contactTypes.length > 0) {
        const ok = contactTypes.some(
          (t) => ciEquals(lead.contactType, t) || ciIncludes(lead.industry, t) || ciIncludes(lead.projectType, t),
        );
        if (!ok) continue;
      }
      if (rules.status && lead.status !== String(rules.status)) continue;
      if (rules.pipelineType && lead.pipelineType !== String(rules.pipelineType)) continue;
      if (rules.source && lead.source !== String(rules.source)) continue;
      if (rules.industry && !ciIncludes(lead.industry, String(rules.industry))) continue;
      if (rules.search) {
        const s = String(rules.search);
        if (!(ciIncludes(lead.companyName, s) || ciIncludes(lead.contactName, s) || ciIncludes(lead.email, s))) continue;
      }
      matched.add(lead.id);
    }
  }

  if (manualIds.size > 0) {
    for (const lead of leads) {
      if (manualIds.has(lead.id)) matched.add(lead.id);
    }
  }

  return matched.size;
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

    // Resolve every segment's audience count and performance from two batched
    // queries (one leads fetch + one grouped scheduled-emails query) regardless
    // of segment count, instead of two queries per segment.
    const [leads, perfMap] = await Promise.all([
      fetchWorkspaceLeadsForMatching(req.workspaceId!),
      performanceForBulkCampaigns(
        req.workspaceId!,
        segments.map((s) => s.lastBulkCampaignId),
      ),
    ]);

    const result = segments.map((seg) => {
      const audienceCount = countAudienceForCriteria(leads, {
        contactTypes: parseJsonArray(seg.contactTypes),
        filterRules: parseJsonObject(seg.filterRules),
        manualLeadIds: parseJsonArray(seg.manualLeadIds),
      });
      const performance =
        (seg.lastBulkCampaignId != null ? perfMap.get(seg.lastBulkCampaignId) : undefined) ?? emptyPerformance();
      return { ...seg, audienceCount, performance };
    });
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

// Campaign-wide fan-out: runs the existing per-segment send for every segment in
// the campaign, using each segment's own template/sender/audience. Segments that
// can't run (no template, empty audience, all suppressed, or — in schedule mode —
// no scheduled time) are reported as "skipped" with a reason rather than failing
// the whole batch. An unexpected error on one segment is reported as "error" and
// does not abort the remaining segments.
router.post("/campaigns/:campaignId/send-all-segments", requireRole("manager"), async (req, res) => {
  try {
    const campaign = await getCampaignOr404(req, res);
    if (!campaign) return;

    const mode: "send_now" | "schedule" = req.body?.mode === "schedule" ? "schedule" : "send_now";

    if (mode === "send_now") {
      const conn = await checkResendConnection();
      if (!conn.connected) return res.status(400).json({ message: `Email provider not configured: ${conn.error}` });
    }

    const segments = await db
      .select()
      .from(campaignSegmentsTable)
      .where(eq(campaignSegmentsTable.campaignId, campaign.id))
      .orderBy(campaignSegmentsTable.id);

    if (segments.length === 0) {
      return res.status(400).json({ message: "Campaign has no segments to send" });
    }

    // Optional staggering (schedule mode only): managers can either drip segments
    // out by a fixed interval (base time + N minutes per subsequent segment) or
    // hand-pick a specific time per segment. `segmentSchedules` (per-segment
    // overrides) wins over the computed stagger time, which in turn wins over the
    // segment's own stored scheduledFor. When neither is set we fall back to the
    // legacy behavior (same base time for every segment).
    const baseScheduledFor: string | null =
      mode === "schedule" ? (req.body?.scheduledFor ?? null) : null;
    const rawStagger = Number(req.body?.staggerMinutes);
    const staggerMinutes =
      mode === "schedule" && Number.isFinite(rawStagger) && rawStagger > 0
        ? Math.floor(rawStagger)
        : 0;
    const segmentScheduleOverrides = new Map<number, string>();
    if (mode === "schedule" && Array.isArray(req.body?.segmentSchedules)) {
      for (const entry of req.body.segmentSchedules) {
        const sid = Number(entry?.segmentId);
        const when = entry?.scheduledFor;
        if (Number.isFinite(sid) && typeof when === "string" && when) {
          segmentScheduleOverrides.set(sid, when);
        }
      }
    }

    type SegmentResult = {
      segmentId: number;
      name: string;
      status: "sent" | "scheduled" | "skipped" | "error";
      message?: string;
      campaignId?: number;
      totalSkipped?: number;
      scheduledFor?: string;
    };
    const results: SegmentResult[] = [];
    const summary = { total: segments.length, sent: 0, scheduled: 0, skipped: 0, failed: 0 };

    let staggerIndex = 0;
    for (const segment of segments) {
      let scheduledFor: string | null = null;
      if (mode === "schedule") {
        const override = segmentScheduleOverrides.get(segment.id);
        if (override) {
          scheduledFor = override;
        } else if (baseScheduledFor) {
          const computed = new Date(baseScheduledFor);
          if (staggerMinutes > 0) {
            computed.setMinutes(computed.getMinutes() + staggerIndex * staggerMinutes);
          }
          scheduledFor = computed.toISOString();
        } else {
          scheduledFor = segment.scheduledFor
            ? new Date(segment.scheduledFor).toISOString()
            : null;
        }
      }
      staggerIndex++;

      if (mode === "schedule" && !scheduledFor) {
        summary.skipped++;
        results.push({
          segmentId: segment.id,
          name: segment.name,
          status: "skipped",
          message: "No scheduled time set for this segment",
        });
        continue;
      }

      try {
        const outcome = await executeSegmentSend({
          req,
          campaign,
          segment,
          templateId: null,
          sequenceId: null,
          mode,
          scheduledFor,
        });

        if ("error" in outcome) {
          summary.skipped++;
          results.push({
            segmentId: segment.id,
            name: segment.name,
            status: "skipped",
            message: outcome.error,
            totalSkipped: (outcome as any).totalSkipped,
          });
          continue;
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

        if (mode === "schedule") summary.scheduled++;
        else summary.sent++;
        results.push({
          segmentId: segment.id,
          name: segment.name,
          status: mode === "schedule" ? "scheduled" : "sent",
          campaignId: outcome.result.campaignId,
          totalSkipped: outcome.totalSkipped,
          scheduledFor: mode === "schedule" && scheduledFor ? scheduledFor : undefined,
        });
      } catch (err: any) {
        summary.failed++;
        results.push({
          segmentId: segment.id,
          name: segment.name,
          status: "error",
          message: err?.message || "Unexpected error",
        });
      }
    }

    res.json({ campaignId: campaign.id, mode, summary, results });
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

    // One grouped query covers every segment's last send, instead of one query
    // per segment, so the Performance tab stays flat as segment count grows.
    const perfMap = await performanceForBulkCampaigns(
      req.workspaceId!,
      segments.map((s) => s.lastBulkCampaignId),
    );

    const totals = emptyPerformance();
    const perSegment = segments.map((seg) => {
      const performance =
        (seg.lastBulkCampaignId != null ? perfMap.get(seg.lastBulkCampaignId) : undefined) ?? emptyPerformance();
      for (const k of Object.keys(totals) as (keyof Performance)[]) totals[k] += performance[k];
      return { segmentId: seg.id, name: seg.name, performance };
    });
    res.json({ campaignId: campaign.id, totals, segments: perSegment });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
