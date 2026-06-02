import { db, activityTable } from "@workspace/db";

// Writes an audit/activity entry. Member-management and other administrative
// actions are recorded here so they surface in the per-workspace Activity Log.
// `leadId` is intentionally omitted (these are workspace-level, not lead-level).
export async function writeAudit(params: {
  workspaceId: number;
  type: string;
  description: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await db.insert(activityTable).values({
      workspaceId: params.workspaceId,
      type: params.type,
      description: params.description,
      createdBy: params.createdBy ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    // Auditing must never break the primary action.
    console.error("[audit] failed to write entry", params.type, err);
  }
}
