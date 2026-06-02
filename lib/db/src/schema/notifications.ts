import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { leadsTable } from "./leads";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").default("info"),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id"),
  campaignId: integer("campaign_id"),
  taskId: integer("task_id"),
  metadata: jsonb("metadata"),
  priority: text("priority").default("normal"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
