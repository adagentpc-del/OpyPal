// Unified lifecycle status model shared across the Sales OS. Both leads
// (scheduled_emails pipeline) and contacts (sequence pipeline) are mapped onto
// this single vocabulary so every page shows one consistent status.

export const LIFECYCLE_STATUSES = [
  "Draft",
  "Segmented",
  "Campaign Assigned",
  "Scheduled",
  "Queued",
  "Sent",
  "Follow-Up Active",
  "Replied",
  "Meeting Booked",
  "Paused",
  "Closed Won",
  "Closed Lost",
  "Do Not Contact",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

const truthy = (v: any) => v !== null && v !== undefined && v !== false && v !== "";

function matchExplicit(value: any): LifecycleStatus | null {
  if (!truthy(value)) return null;
  const v = String(value).toLowerCase();
  if (v.includes("won")) return "Closed Won";
  if (v.includes("lost")) return "Closed Lost";
  if (v.includes("meeting") || v.includes("booked")) return "Meeting Booked";
  if (v.includes("do not contact") || v === "dnc" || v === "do_not_contact") return "Do Not Contact";
  if (v.includes("repl")) return "Replied";
  if (v.includes("paus")) return "Paused";
  const exact = LIFECYCLE_STATUSES.find((s) => s.toLowerCase() === v);
  return exact || null;
}

export interface LifecycleInput {
  lifecycleStatus?: any;
  status?: any;
  sequenceStatus?: any;
  doNotContact?: any;
  unsubscribed?: any;
  isUnsubscribed?: any;
  isBounced?: any;
  bounced?: any;
  lastReplyAt?: any;
  lastRepliedAt?: any;
  lastEmailSentAt?: any;
  lastContactDate?: any;
  nextSendAt?: any;
  nextFollowUpDate?: any;
  segmentId?: any;
  campaignId?: any;
  campaignName?: any;
  templateSetId?: any;
  assignedTemplateSet?: any;
  currentStep?: any;
  // Aggregate counts of the record's scheduled_emails (optional)
  scheduledCount?: number;
  queuedCount?: number;
  sentCount?: number;
  pausedCount?: number;
}

export function deriveLifecycleStatus(r: LifecycleInput): LifecycleStatus {
  // 1. Explicit terminal/override wins.
  const explicit = matchExplicit(r.lifecycleStatus);
  if (explicit) return explicit;

  // 2. Hard stops.
  if (truthy(r.doNotContact) || truthy(r.unsubscribed) || truthy(r.isUnsubscribed)) return "Do Not Contact";
  const statusExplicit = matchExplicit(r.status);
  if (statusExplicit === "Do Not Contact" || statusExplicit === "Closed Won" || statusExplicit === "Closed Lost" || statusExplicit === "Meeting Booked") {
    return statusExplicit;
  }
  const seqExplicit = matchExplicit(r.sequenceStatus);

  // 3. Replied.
  if (truthy(r.lastReplyAt) || truthy(r.lastRepliedAt) || statusExplicit === "Replied" || seqExplicit === "Replied") {
    return "Replied";
  }

  // 4. Paused.
  if (statusExplicit === "Paused" || seqExplicit === "Paused" || (r.pausedCount && r.pausedCount > 0)) {
    return "Paused";
  }

  // 5. Active follow-ups: already sent at least one and more are queued/scheduled.
  const hasSent = truthy(r.lastEmailSentAt) || truthy(r.lastContactDate) || (r.sentCount && r.sentCount > 0);
  const hasPending = (r.scheduledCount && r.scheduledCount > 0) || (r.queuedCount && r.queuedCount > 0) || truthy(r.nextSendAt) || truthy(r.nextFollowUpDate);
  if (hasSent && hasPending) return "Follow-Up Active";
  if (r.sentCount && r.sentCount > 0) return "Sent";

  // 6. In the send pipeline.
  if (r.queuedCount && r.queuedCount > 0) return "Queued";
  if ((r.scheduledCount && r.scheduledCount > 0) || String(r.sequenceStatus || "") === "active" || truthy(r.nextSendAt)) return "Scheduled";

  // 7. Assigned / segmented / draft.
  if (truthy(r.campaignId) || truthy(r.campaignName) || truthy(r.templateSetId) || truthy(r.assignedTemplateSet)) return "Campaign Assigned";
  if (truthy(r.segmentId)) return "Segmented";
  return "Draft";
}
