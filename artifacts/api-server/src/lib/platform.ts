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

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
