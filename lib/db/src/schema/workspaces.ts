import { pgTable, serial, integer, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Opypal white-label tenants. Each workspace is an isolated account/brand
// inside the Opypal platform. Workspace 1 is "A3 Visual".
export const workspacesTable = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortCode: text("short_code"),
  initials: text("initials"),
  roleLabel: text("role_label").default("Workspace Admin").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkspaceSchema = createInsertSchema(workspacesTable);
export type Workspace = typeof workspacesTable.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

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
