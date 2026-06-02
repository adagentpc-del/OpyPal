import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const routingLogsTable = pgTable("routing_logs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  previousRoutingState: text("previous_routing_state"),
  newRoutingState: text("new_routing_state").notNull(),
  reason: text("reason").notNull(),
  recommendedNextAction: text("recommended_next_action"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRoutingLogSchema = createInsertSchema(routingLogsTable).omit({ id: true, createdAt: true });
export type InsertRoutingLog = z.infer<typeof insertRoutingLogSchema>;
export type RoutingLog = typeof routingLogsTable.$inferSelect;
