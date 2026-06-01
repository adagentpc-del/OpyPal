import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templateSetsTable = pgTable("template_sets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id"),
  name: text("name").notNull(),
  segmentType: text("segment_type"),
  description: text("description"),
  category: text("category"),
  defaultUseCase: text("default_use_case"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTemplateSetSchema = createInsertSchema(templateSetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplateSet = z.infer<typeof insertTemplateSetSchema>;
export type TemplateSet = typeof templateSetsTable.$inferSelect;
