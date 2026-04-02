import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templateSetsTable = pgTable("template_sets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTemplateSetSchema = createInsertSchema(templateSetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplateSet = z.infer<typeof insertTemplateSetSchema>;
export type TemplateSet = typeof templateSetsTable.$inferSelect;
