// Client for the converged segment-assignment + bulk-import endpoints.
//
// These routes are NOT part of lib/api-spec / lib/api-zod (which must never be
// edited), so we call them with plain fetch. The global fetch interceptor stamps
// `x-workspace-id` and Clerk session cookies carry auth, so requests are
// workspace-scoped and authenticated like every other raw-fetch page.

const API_BASE = import.meta.env.BASE_URL + "api";

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message || body?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

export interface AssignSegmentInput {
  segmentId?: number | null;
  leadIds?: number[];
  contactIds?: number[];
  subject: string;
  body: string;
  scheduledFor?: string;
  sendVia?: string;
  templateId?: number | null;
  templateSetId?: number | null;
  campaignId?: number | null;
  source?: string;
  setLifecycle?: boolean;
}

export interface AssignSegmentResult {
  leadsAssigned: number;
  contactsAssigned: number;
  emailsCreated: number;
  skipped: number;
}

// Stamp a segment + lifecycle on the chosen leads/contacts and auto-create
// scheduled_emails for them (the converged send pipeline).
export function assignSegment(input: AssignSegmentInput): Promise<AssignSegmentResult> {
  return apiPost<AssignSegmentResult>("/segments/assign", input);
}

export interface BulkSendInput {
  contactIds: number[];
  subject: string;
  body: string;
  scheduledFor?: string;
  sendVia?: string;
  templateId?: number | null;
  source?: string;
}

export interface BulkSendResult {
  emailsCreated: number;
  skipped: number;
}

// Ad-hoc "Send Email" to selected contacts: creates ONE scheduled email per
// eligible contact (honoring the edited subject/body), not a multi-step
// sequence enrollment. Contacts already in an active sequence or suppressed are
// skipped server-side to avoid double-sends.
export function bulkSendContacts(input: BulkSendInput): Promise<BulkSendResult> {
  return apiPost<BulkSendResult>("/contacts/bulk-send", input);
}

export interface BulkContactInput {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  company?: string;
  title?: string;
  location?: string;
  industry?: string;
  event?: string;
  companyWebsite?: string;
  intentSignal?: string;
  customLine?: string;
  segmentId?: number | null;
  referral?: boolean;
  referredBy?: string;
  referralNotes?: string;
  [key: string]: any;
}

export interface BulkImportResult {
  created: number;
  skipped: number;
  createdIds: number[];
}

// Bulk-import contacts (idempotent on email when dedupeByEmail is true).
export function bulkImportContacts(contacts: BulkContactInput[], dedupeByEmail = true): Promise<BulkImportResult> {
  return apiPost<BulkImportResult>("/contacts/bulk-import", { contacts, dedupeByEmail });
}
