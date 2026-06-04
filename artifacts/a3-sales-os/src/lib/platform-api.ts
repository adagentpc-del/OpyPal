// Raw-fetch client for platform (super-admin) endpoints. Per the project's API
// constraint these endpoints are NOT in lib/api-spec / lib/api-zod, so this
// module owns their request/response shapes directly.
const API_BASE = import.meta.env.BASE_URL + "api";

export interface WorkspaceMetrics {
  users: number;
  contacts: number;
  campaigns: number;
  leads: number;
  queued: number;
  replies: number;
}

export interface WorkspaceProviders {
  connected: number;
  errored: number;
  status: "connected" | "error" | "none";
}

export interface OverviewWorkspace {
  id: number;
  name: string;
  slug: string;
  shortCode: string | null;
  initials: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  isActive: boolean;
  createdAt: string;
  metrics: WorkspaceMetrics;
  providers: WorkspaceProviders;
}

export interface PlatformActivity {
  id: number;
  workspaceId: number;
  workspaceName: string;
  type: string;
  description: string;
  createdBy: string | null;
  createdAt: string;
}

export interface PlatformOverview {
  workspaces: OverviewWorkspace[];
  recentActivity: PlatformActivity[];
}

export async function fetchPlatformOverview(): Promise<PlatformOverview> {
  const res = await fetch(`${API_BASE}/admin/overview`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load platform overview");
  return res.json();
}

export function sumMetric(
  workspaces: OverviewWorkspace[],
  key: keyof WorkspaceMetrics,
): number {
  return workspaces.reduce((acc, w) => acc + (w.metrics[key] ?? 0), 0);
}
