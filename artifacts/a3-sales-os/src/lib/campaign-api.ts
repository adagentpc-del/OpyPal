// Client-side data layer for the upgraded Campaign Builder.
//
// The generated `@workspace/api-client-react` hooks only cover the original
// campaigns CRUD surface. The new builder endpoints (segments, assets,
// schedules, audience preview, per-segment performance, object-storage uploads)
// are NOT part of lib/api-spec / lib/api-zod (which must never be edited), so we
// talk to them here with plain `fetch` + react-query. The global fetch
// interceptor stamps `x-workspace-id`, and Clerk session cookies carry auth, so
// these requests are workspace-scoped and authenticated just like every other
// page that uses raw fetch.
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

const API_BASE = import.meta.env.BASE_URL + "api";

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || body?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types (loose — these mirror the server responses without importing api-zod)
// ---------------------------------------------------------------------------
export interface CampaignDetail {
  id: number;
  name: string;
  description?: string | null;
  objective?: string | null;
  owner?: string | null;
  status?: string | null;
  templateSetId?: number | null;
  isActive?: boolean | null;
  startDate?: string | null;
  endDate?: string | null;
  defaultSenderName?: string | null;
  defaultSenderEmail?: string | null;
  defaultReplyTo?: string | null;
  defaultProvider?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  segmentCount: number;
  assetCount: number;
  scheduleCount: number;
}

export interface Performance {
  total: number;
  sent: number;
  scheduled: number;
  queued: number;
  failed: number;
  canceled: number;
  paused: number;
}

export interface Segment {
  id: number;
  campaignId: number;
  name: string;
  contactTypes?: string | null;
  filterRules?: string | null;
  manualLeadIds?: string | null;
  templateId?: number | null;
  sequenceId?: number | null;
  senderName?: string | null;
  senderEmail?: string | null;
  replyTo?: string | null;
  provider?: string | null;
  scheduledFor?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  assetIds?: string | null;
  status?: string | null;
  notes?: string | null;
  lastBulkCampaignId?: number | null;
  audienceCount: number;
  performance: Performance;
}

export interface AudienceContact {
  id: number;
  companyName?: string | null;
  contactName?: string | null;
  email?: string | null;
  contactType?: string | null;
  industry?: string | null;
  status?: string | null;
  isUnsubscribed: boolean;
  isBounced: boolean;
}

export interface CampaignAsset {
  id: number;
  campaignId: number;
  segmentId?: number | null;
  assetId?: number | null;
  title: string;
  contentType?: string | null;
  url?: string | null;
  objectPath?: string | null;
  createdAt: string;
}

export interface CampaignSchedule {
  id: number;
  campaignId: number;
  segmentId?: number | null;
  label?: string | null;
  templateId?: number | null;
  sequenceId?: number | null;
  scheduledFor: string;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  status?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
}

export interface SegmentFilterRules {
  status?: string;
  pipelineType?: string;
  source?: string;
  industry?: string;
  search?: string;
}

export interface SegmentCriteria {
  contactTypes?: string[];
  filterRules?: SegmentFilterRules;
  manualLeadIds?: number[];
}

// Input shape for creating/updating a segment. Unlike `Segment` (whose
// contactTypes/filterRules/etc. come back as JSON-encoded strings from the DB),
// the API accepts these as real arrays/objects and serializes them server-side.
export interface SegmentInput {
  name?: string;
  contactTypes?: string[];
  filterRules?: SegmentFilterRules;
  manualLeadIds?: number[];
  templateId?: number | null;
  sequenceId?: number | null;
  senderName?: string | null;
  senderEmail?: string | null;
  replyTo?: string | null;
  provider?: string | null;
  scheduledFor?: string | null;
  sendWindowStart?: string | null;
  sendWindowEnd?: string | null;
  assetIds?: number[];
  status?: string | null;
  notes?: string | null;
}

export interface AudiencePreview {
  count: number;
  sample: AudienceContact[];
}

export interface CampaignPerformance {
  campaignId: number;
  totals: Performance;
  segments: Array<{ segmentId: number; name: string; performance: Performance }>;
}

export interface SegmentSendResult {
  segmentId: number;
  name: string;
  status: "sent" | "scheduled" | "skipped" | "error";
  message?: string;
  campaignId?: number;
  totalSkipped?: number;
  scheduledFor?: string;
}

export interface SendAllResult {
  campaignId: number;
  mode: "send_now" | "schedule";
  summary: { total: number; sent: number; scheduled: number; skipped: number; failed: number };
  results: SegmentSendResult[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const qk = {
  campaign: (id: number) => ["campaign-detail", id] as const,
  contactTypes: () => ["campaign-contact-types"] as const,
  segments: (campaignId: number) => ["campaign-segments", campaignId] as const,
  segmentAudience: (segmentId: number) => ["segment-audience", segmentId] as const,
  assets: (campaignId: number) => ["campaign-assets", campaignId] as const,
  schedules: (campaignId: number) => ["campaign-schedules", campaignId] as const,
  performance: (campaignId: number) => ["campaign-performance", campaignId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export function useCampaignDetail(id: number, opts?: Partial<UseQueryOptions<CampaignDetail>>) {
  return useQuery<CampaignDetail>({
    queryKey: qk.campaign(id),
    queryFn: () => apiGet<CampaignDetail>(`/campaigns/${id}`),
    enabled: !Number.isNaN(id),
    ...opts,
  });
}

export function useContactTypes() {
  return useQuery<string[]>({
    queryKey: qk.contactTypes(),
    queryFn: () => apiGet<string[]>(`/campaign-contact-types`),
  });
}

export function useSegments(campaignId: number) {
  return useQuery<Segment[]>({
    queryKey: qk.segments(campaignId),
    queryFn: () => apiGet<Segment[]>(`/campaigns/${campaignId}/segments`),
    enabled: !Number.isNaN(campaignId),
  });
}

export function useSegmentAudience(segmentId: number | null) {
  return useQuery<{ count: number; contacts: AudienceContact[] }>({
    queryKey: qk.segmentAudience(segmentId ?? -1),
    queryFn: () => apiGet(`/campaign-segments/${segmentId}/audience`),
    enabled: segmentId != null,
  });
}

export function useAssets(campaignId: number) {
  return useQuery<CampaignAsset[]>({
    queryKey: qk.assets(campaignId),
    queryFn: () => apiGet<CampaignAsset[]>(`/campaigns/${campaignId}/assets`),
    enabled: !Number.isNaN(campaignId),
  });
}

export function useSchedules(campaignId: number) {
  return useQuery<CampaignSchedule[]>({
    queryKey: qk.schedules(campaignId),
    queryFn: () => apiGet<CampaignSchedule[]>(`/campaigns/${campaignId}/schedules`),
    enabled: !Number.isNaN(campaignId),
  });
}

export function useCampaignPerformance(campaignId: number) {
  return useQuery<CampaignPerformance>({
    queryKey: qk.performance(campaignId),
    queryFn: () => apiGet<CampaignPerformance>(`/campaigns/${campaignId}/performance`),
    enabled: !Number.isNaN(campaignId),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useSegmentMutations(campaignId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.segments(campaignId) });
    qc.invalidateQueries({ queryKey: qk.campaign(campaignId) });
    qc.invalidateQueries({ queryKey: qk.performance(campaignId) });
  };

  const create = useMutation({
    mutationFn: (data: SegmentInput) =>
      apiSend<Segment>(`/campaigns/${campaignId}/segments`, "POST", data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SegmentInput }) =>
      apiSend<Segment>(`/campaign-segments/${id}`, "PUT", data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiSend<{ success: boolean }>(`/campaign-segments/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
  const send = useMutation({
    mutationFn: ({ id, scheduledFor }: { id: number; scheduledFor?: string | null }) =>
      apiSend(`/campaign-segments/${id}/send`, "POST", scheduledFor ? { scheduledFor } : {}),
    onSuccess: invalidate,
  });
  const sendAll = useMutation({
    mutationFn: (vars: {
      mode: "send_now" | "schedule";
      scheduledFor?: string | null;
      staggerMinutes?: number | null;
      segmentSchedules?: Array<{ segmentId: number; scheduledFor: string }>;
    }) =>
      apiSend<SendAllResult>(`/campaigns/${campaignId}/send-all-segments`, "POST", vars),
    onSuccess: invalidate,
  });

  return { create, update, remove, send, sendAll };
}

export function usePreviewAudience(campaignId: number) {
  return useMutation({
    mutationFn: (criteria: SegmentCriteria) =>
      apiSend<AudiencePreview>(`/campaigns/${campaignId}/segments/preview-audience`, "POST", criteria),
  });
}

export function useAssetMutations(campaignId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.assets(campaignId) });
    qc.invalidateQueries({ queryKey: qk.campaign(campaignId) });
  };
  const create = useMutation({
    mutationFn: (data: Partial<CampaignAsset>) =>
      apiSend<CampaignAsset>(`/campaigns/${campaignId}/assets`, "POST", data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiSend<{ success: boolean }>(`/campaign-assets/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
  return { create, remove };
}

export function useScheduleMutations(campaignId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.schedules(campaignId) });
    qc.invalidateQueries({ queryKey: qk.campaign(campaignId) });
    qc.invalidateQueries({ queryKey: qk.performance(campaignId) });
  };
  const create = useMutation({
    mutationFn: (data: Partial<CampaignSchedule>) =>
      apiSend<CampaignSchedule>(`/campaigns/${campaignId}/schedules`, "POST", data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CampaignSchedule> }) =>
      apiSend<CampaignSchedule>(`/campaign-schedules/${id}`, "PUT", data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiSend<{ success: boolean }>(`/campaign-schedules/${id}`, "DELETE"),
    onSuccess: invalidate,
  });
  const run = useMutation({
    mutationFn: (id: number) => apiSend(`/campaign-schedules/${id}/run`, "POST", {}),
    onSuccess: invalidate,
  });
  return { create, update, remove, run };
}

// ---------------------------------------------------------------------------
// Object-storage upload helper: requests a presigned PUT URL, uploads the file
// directly to storage, and returns the normalized object path to associate.
// ---------------------------------------------------------------------------
export interface UploadResult {
  objectPath: string;
  name: string;
  contentType: string;
  size: number;
}

export async function uploadCampaignFile(file: File): Promise<UploadResult> {
  const reqRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!reqRes.ok) throw new Error(await readError(reqRes));
  const { uploadURL, objectPath } = (await reqRes.json()) as { uploadURL: string; objectPath: string };

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

  return {
    objectPath,
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}

// Builds a URL the browser can use to view/download a stored object.
export function storageObjectUrl(objectPath: string): string {
  // objectPath is normalized to "/objects/<id>"; the serve route lives under
  // /api/storage. Strip a leading slash to avoid a double slash.
  const clean = objectPath.replace(/^\//, "");
  return `${API_BASE}/storage/${clean}`;
}

// Helpers for parsing JSON-encoded array/object columns returned as strings.
export function parseArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function parseObject<T = Record<string, unknown>>(raw: string | null | undefined): T {
  if (!raw) return {} as T;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? v : ({} as T);
  } catch {
    return {} as T;
  }
}
