// Unified lifecycle status model for the Sales OS frontend. Mirrors the backend
// lib (artifacts/api-server/src/lib/lifecycle-status.ts) so leads and contacts
// render one consistent status everywhere.

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

export const LIFECYCLE_COLORS: Record<LifecycleStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Segmented: "bg-violet-100 text-violet-700 border-violet-200",
  "Campaign Assigned": "bg-indigo-100 text-indigo-700 border-indigo-200",
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Queued: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Sent: "bg-sky-100 text-sky-700 border-sky-200",
  "Follow-Up Active": "bg-amber-100 text-amber-700 border-amber-200",
  Replied: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Meeting Booked": "bg-green-100 text-green-700 border-green-200",
  Paused: "bg-orange-100 text-orange-700 border-orange-200",
  "Closed Won": "bg-green-600 text-white border-green-700",
  "Closed Lost": "bg-rose-100 text-rose-700 border-rose-200",
  "Do Not Contact": "bg-red-100 text-red-700 border-red-200",
};

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
  scheduledCount?: number;
  queuedCount?: number;
  sentCount?: number;
  pausedCount?: number;
}

export function deriveLifecycleStatus(r: LifecycleInput): LifecycleStatus {
  const explicit = matchExplicit(r.lifecycleStatus);
  if (explicit) return explicit;

  if (truthy(r.doNotContact) || truthy(r.unsubscribed) || truthy(r.isUnsubscribed)) return "Do Not Contact";
  const statusExplicit = matchExplicit(r.status);
  if (statusExplicit === "Do Not Contact" || statusExplicit === "Closed Won" || statusExplicit === "Closed Lost" || statusExplicit === "Meeting Booked") {
    return statusExplicit;
  }
  const seqExplicit = matchExplicit(r.sequenceStatus);

  if (truthy(r.lastReplyAt) || truthy(r.lastRepliedAt) || statusExplicit === "Replied" || seqExplicit === "Replied") return "Replied";
  if (statusExplicit === "Paused" || seqExplicit === "Paused" || (r.pausedCount && r.pausedCount > 0)) return "Paused";

  const hasSent = truthy(r.lastEmailSentAt) || truthy(r.lastContactDate) || (r.sentCount && r.sentCount > 0);
  const hasPending = (r.scheduledCount && r.scheduledCount > 0) || (r.queuedCount && r.queuedCount > 0) || truthy(r.nextSendAt) || truthy(r.nextFollowUpDate);
  if (hasSent && hasPending) return "Follow-Up Active";
  if (r.sentCount && r.sentCount > 0) return "Sent";

  if (r.queuedCount && r.queuedCount > 0) return "Queued";
  if ((r.scheduledCount && r.scheduledCount > 0) || String(r.sequenceStatus || "") === "active" || truthy(r.nextSendAt)) return "Scheduled";

  if (truthy(r.campaignId) || truthy(r.campaignName) || truthy(r.templateSetId) || truthy(r.assignedTemplateSet)) return "Campaign Assigned";
  if (truthy(r.segmentId)) return "Segmented";
  return "Draft";
}
