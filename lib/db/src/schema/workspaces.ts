import { pgTable, serial, integer, text, timestamp, boolean, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-workspace brand placeholders. Filled in by a workspace admin later.
export interface WorkspaceBranding {
  displayName?: string;
  tagline?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
}

// Supported outbound email providers. "forwarding" is inbound-only (a manual
// forwarding inbox fallback) and is never used as an outbound send provider.
export type ProviderType = "outlook" | "gmail" | "resend" | "forwarding";

// Default outbound sender identity + provider routing config for a workspace.
// Stored as JSONB on workspaces.sender_identity (no dedicated columns), so new
// optional fields can be added here without a migration.
export interface WorkspaceSenderIdentity {
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  signature?: string;
  // Preferred outbound provider for this workspace. When unset the workspace
  // settings.primary_send_provider (then resend) is used.
  defaultProvider?: ProviderType;
  // Ordered provider fallback chain. The sender tries each in turn until one
  // succeeds. Resend is always appended as a final fallback when configured.
  providerPriority?: ProviderType[];
  // Manual forwarding inbox address. Inbound mail forwarded to this address is
  // attributed to this workspace and parsed for the original sender/reply.
  forwardingInbox?: string;
  // Fallback Reply-To for contacts with no assigned rep (a real monitored inbox).
  defaultRepReplyTo?: string;
}

// Which product modules are enabled for a workspace.
export type WorkspaceModule =
  | "CRM"
  | "Outreach"
  | "Sequences"
  | "Queue"
  | "Analytics"
  | "Companies"
  | "Templates"
  | "Users";

// Opypal white-label tenants. Each workspace is an isolated account/brand
// inside the Opypal platform. Workspace 1 is "A3 Visual".
export const workspacesTable = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortCode: text("short_code"),
  initials: text("initials"),
  roleLabel: text("role_label").default("Workspace Admin").notNull(),
  // High-level business type, e.g. "local services / moving / partnerships".
  workspaceType: text("workspace_type"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  // Per-workspace placeholder config (filled in by workspace admins later).
  branding: jsonb("branding").$type<WorkspaceBranding>(),
  senderIdentity: jsonb("sender_identity").$type<WorkspaceSenderIdentity>(),
  settings: jsonb("settings").$type<Record<string, string>>(),
  modules: jsonb("modules").$type<WorkspaceModule[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkspaceSchema = createInsertSchema(workspacesTable);
export type Workspace = typeof workspacesTable.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

// Sample template categories aligned to a workspace's business type. These are
// organizational buckets a workspace admin can later attach templates to.
export const workspaceTemplateCategoriesTable = pgTable(
  "workspace_template_categories",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .references(() => workspacesTable.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorkspaceCategory: unique().on(table.workspaceId, table.name),
  }),
);

export const insertWorkspaceTemplateCategorySchema = createInsertSchema(
  workspaceTemplateCategoriesTable,
);
export type WorkspaceTemplateCategory =
  typeof workspaceTemplateCategoriesTable.$inferSelect;
export type InsertWorkspaceTemplateCategory = z.infer<
  typeof insertWorkspaceTemplateCategorySchema
>;

// Maps a person (by email, and once they sign in, by Clerk user id) to a
// workspace with a role. Super admins are not stored here — they are resolved
// from a platform-level allowlist and can see every workspace.
export const workspaceMembersTable = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .references(() => workspacesTable.id, { onDelete: "cascade" })
      .notNull(),
    email: text("email").notNull(),
    clerkUserId: text("clerk_user_id"),
    role: text("role").default("workspace_admin").notNull(),
    // "active" | "suspended". Suspended members keep their row (and history)
    // but are denied access until reactivated.
    status: text("status").default("active").notNull(),
    // Email of the super_admin / workspace_admin who created the membership.
    createdBy: text("created_by"),
    // Address replies to this rep should route to (defaults to `email` when null).
    replyToEmail: text("reply_to_email"),
    // Optional display name for the rep.
    displayName: text("display_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorkspaceEmail: unique().on(table.workspaceId, table.email),
  }),
);

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembersTable);
export type WorkspaceMember = typeof workspaceMembersTable.$inferSelect;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;
