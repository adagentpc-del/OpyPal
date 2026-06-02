import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { leadsTable } from "./leads";

export const outreachHistoryTable = pgTable("outreach_history", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }).notNull(),
  actionType: text("action_type").notNull(),
  templateName: text("template_name"),
  subject: text("subject"),
  body: text("body"),
  assets: text("assets"),
  sender: text("sender"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertOutreachHistorySchema = createInsertSchema(outreachHistoryTable).omit({ id: true, sentAt: true });
export type InsertOutreachHistory = z.infer<typeof insertOutreachHistorySchema>;
export type OutreachHistory = typeof outreachHistoryTable.$inferSelect;
