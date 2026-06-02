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

// Default outbound sender identity placeholders for a workspace.
export interface WorkspaceSenderIdentity {
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  signature?: string;
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
