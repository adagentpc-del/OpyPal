import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { leadsTable } from "./leads";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata"),
  relatedTemplateId: integer("related_template_id"),
  relatedSequenceId: integer("related_sequence_id"),
  relatedScheduledEmailId: integer("related_scheduled_email_id"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;
