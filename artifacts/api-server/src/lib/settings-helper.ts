import { db, settingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Read a single setting value scoped to a specific workspace.
 * Settings are per-workspace (unique on workspace_id + key), so every
 * processor / route that consults settings MUST pass the workspace it is
 * acting on. Falls back to the provided default when the row is absent.
 */
export async function getSetting(
  workspaceId: number,
  key: string,
  defaultValue: string,
): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(and(eq(settingsTable.workspaceId, workspaceId), eq(settingsTable.key, key)));
    return row?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Read all settings for a workspace as a key/value map. */
export async function getSettingsMap(workspaceId: number): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.workspaceId, workspaceId));
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}
