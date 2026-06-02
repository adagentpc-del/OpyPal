import type { AppRole } from "@/hooks/use-workspace";

// Mirror of the server-side role/capability model (api-server/src/lib/platform.ts).
// Used to drive nav visibility, route guards, and button enablement. The server
// remains the source of truth — this is purely for UX.

export const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  operator: 2,
  manager: 3,
  workspace_admin: 4,
  super_admin: 5,
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  workspace_admin: "Workspace Admin",
  manager: "Manager",
  operator: "Operator",
  viewer: "Viewer",
  none: "No Access",
};

// Roles that can be assigned to workspace members (super_admin is platform-only).
export const ASSIGNABLE_ROLES: AppRole[] = [
  "workspace_admin",
  "manager",
  "operator",
  "viewer",
];

export type Capability = "view" | "act" | "mutate" | "manage" | "admin";

const CAPABILITY_MIN_ROLE: Record<Capability, AppRole> = {
  view: "viewer",
  act: "operator",
  mutate: "operator",
  manage: "manager",
  admin: "workspace_admin",
};

// True when `role` meets or exceeds the required `min` role.
export function roleAtLeast(role: AppRole | undefined, min: AppRole): boolean {
  return (ROLE_RANK[role ?? ""] ?? 0) >= (ROLE_RANK[min] ?? Number.POSITIVE_INFINITY);
}

// True when the given role (or super_admin) holds the capability.
export function roleCan(role: AppRole | undefined, capability: Capability): boolean {
  if (role === "super_admin") return true;
  return roleAtLeast(role, CAPABILITY_MIN_ROLE[capability]);
}

export function roleLabel(role: string | undefined | null): string {
  if (!role) return "—";
  return ROLE_LABELS[role] ?? role;
}

// Plain-language description of what each role can do, shown on the Access page.
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin:
    "Platform owner. Accesses and manages every workspace, switches between them, and manages all users.",
  workspace_admin:
    "Full control of their own workspace, including members, roles, and settings.",
  manager:
    "Manages day-to-day operations and can manage records, but cannot manage members or settings.",
  operator:
    "Works leads and sends outreach. Can create and edit records, but not manage the workspace.",
  viewer: "Read-only access to the workspace's data.",
};

// The capability matrix rendered on the Access / Permissions page.
export const CAPABILITY_MATRIX: Array<{
  capability: Capability;
  label: string;
  description: string;
}> = [
  { capability: "view", label: "View data", description: "See leads, tasks, and reports" },
  { capability: "act", label: "Act on records", description: "Send outreach, enroll leads" },
  { capability: "mutate", label: "Edit records", description: "Create, update, delete records" },
  { capability: "manage", label: "Manage operations", description: "Templates, assignments" },
  { capability: "admin", label: "Administer workspace", description: "Members, roles, settings" },
];
