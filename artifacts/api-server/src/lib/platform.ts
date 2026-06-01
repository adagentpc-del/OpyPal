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

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
