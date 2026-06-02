// Platform-level configuration for the Opypal white-label hierarchy.
//
// Super admins are the Opypal platform operators. They are not stored as
// workspace members — they can see and switch into every workspace. Membership
// in a specific workspace (workspace_admin) is stored in workspace_members.

export const PLATFORM = {
  name: "Opypal",
  foundation: "Opypal Core",
} as const;

// Bootstrap super-admin allowlist. Anyone signing in with one of these emails
// is treated as the Opypal super admin.
export const SUPER_ADMIN_EMAILS = ["alyssadeltorre@gmail.com"];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
}

// Roles a person can hold inside a single workspace (stored in
// workspace_members.role). `super_admin` is platform-level and is NOT one of
// these — it is resolved from SUPER_ADMIN_EMAILS and bypasses workspace roles.
export type WorkspaceRole =
  | "workspace_admin"
  | "manager"
  | "operator"
  | "viewer";

// All assignable workspace roles, lowest → highest privilege. `super_admin` is
// intentionally excluded: it is platform-level and cannot be assigned via the
// member API (it comes only from SUPER_ADMIN_EMAILS).
export const ALL_WORKSPACE_ROLES: WorkspaceRole[] = [
  "viewer",
  "operator",
  "manager",
  "workspace_admin",
];

// Membership lifecycle states stored in workspace_members.status.
export const MEMBER_STATUSES = ["active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

// Higher number = more privilege. Used to gate routes by a minimum role.
export const ROLE_RANK: Record<string, number> = {
  viewer: 1,
  operator: 2,
  manager: 3,
  workspace_admin: 4,
};

// True when `role` meets or exceeds the required `min` role.
export function roleAtLeast(role: string, min: WorkspaceRole): boolean {
  return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[min] ?? Number.POSITIVE_INFINITY);
}

// Coarse capability model used both to gate sensitive actions on the server and
// to drive module/button visibility on the client (mirrored in the frontend's
// lib/permissions.ts). Each capability maps to the minimum role that holds it.
// super_admin holds every capability.
export type Capability =
  | "view" // read workspace data
  | "act" // act on records (send, enroll, edit own work)
  | "mutate" // create/update/delete records
  | "manage" // manage members, settings within a workspace
  | "admin"; // full workspace administration

export const CAPABILITY_MIN_ROLE: Record<Capability, WorkspaceRole> = {
  view: "viewer",
  act: "operator",
  mutate: "operator",
  manage: "manager",
  admin: "workspace_admin",
};

// True when the given role (or super_admin) holds the capability.
export function roleCan(role: string, capability: Capability): boolean {
  if (role === "super_admin") return true;
  return roleAtLeast(role, CAPABILITY_MIN_ROLE[capability]);
}

// Human-friendly labels for roles, shown in the UI.
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  workspace_admin: "Workspace Admin",
  manager: "Manager",
  operator: "Operator",
  viewer: "Viewer",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
