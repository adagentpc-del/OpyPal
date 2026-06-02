import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const nextActionsTable = pgTable("next_actions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  recommendedForTier: text("recommended_for_tier"),
  recommendedForSegment: text("recommended_for_segment"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNextActionSchema = createInsertSchema(nextActionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNextAction = z.infer<typeof insertNextActionSchema>;
export type NextAction = typeof nextActionsTable.$inferSelect;
