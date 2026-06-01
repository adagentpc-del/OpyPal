// Opypal white-label branding model.
//
// Hierarchy:
//   Platform   → "Opypal"        (what a super admin sees across all tenants)
//   Foundation → "Opypal Core"   (the shared technical platform/back-end)
//   Workspace  → a tenant/account inside Opypal (white-labelled)
//   Workspace 1 (Tenant 1) → "A3 Visual"
//
// Today the app runs in single-workspace mode bound to the A3 Visual
// workspace. Super-admin workspace switching will swap CURRENT_WORKSPACE
// for the selected tenant once the workspace backend lands.

export const PLATFORM = {
  name: "OpyPal",
  fullName: "Opportunity Operations Pal",
  tagline: "Opportunity. Operations. Pal.",
  foundation: "OpyPal Core",
  // Product narrative — what each part of the name means.
  pillars: {
    opportunity: "Pipeline, leads, partnerships, and revenue growth.",
    operations: "Workflow, automation, queue management, and execution.",
    pal: "The system that supports and organizes your business.",
  },
} as const;

export interface Workspace {
  id: string;
  name: string;
  /** Short brand code shown in the logo badge, e.g. "A3". */
  shortCode: string;
  /** Initials shown in the user/profile avatar, e.g. "AV". */
  initials: string;
  /** Role label shown under the workspace in the profile area. */
  roleLabel: string;
}

// Workspace 1 / Tenant 1
export const A3_VISUAL_WORKSPACE: Workspace = {
  id: "a3-visual",
  name: "A3 Visual",
  shortCode: "A3",
  initials: "AV",
  roleLabel: "Sales Team",
};

// The workspace the current session is scoped to.
export const CURRENT_WORKSPACE: Workspace = A3_VISUAL_WORKSPACE;
