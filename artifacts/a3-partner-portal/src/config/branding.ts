// Opypal white-label branding model (Partner Portal).
//
// Hierarchy:
//   Platform   → "Opypal"        (what a super admin sees across all tenants)
//   Foundation → "Opypal Core"   (the shared technical platform/back-end)
//   Workspace  → a tenant/account inside Opypal (white-labelled)
//   Workspace 1 (Tenant 1) → "A3 Visual"
//
// The Partner Portal admin is scoped to a single workspace (A3 Visual today).
// Public partner pages keep their own per-partner branding, which is the
// workspace's white-label surface for external collaborators.

export const PLATFORM = {
  name: "Opypal",
  foundation: "Opypal Core",
} as const;

export interface Workspace {
  id: string;
  name: string;
  roleLabel: string;
}

// Workspace 1 / Tenant 1
export const A3_VISUAL_WORKSPACE: Workspace = {
  id: "a3-visual",
  name: "A3 Visual",
  roleLabel: "Workspace Admin",
};

// The workspace the current admin session is scoped to.
export const CURRENT_WORKSPACE: Workspace = A3_VISUAL_WORKSPACE;
