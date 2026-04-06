import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { templateSetsTable } from "./template-sets";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sequenceTemplatesTable = pgTable("sequence_templates", {
  id: serial("id").primaryKey(),
  templateSetId: integer("template_set_id").notNull().references(() => templateSetsTable.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  name: text("name"),
  subject: text("subject"),
  body: text("body").notNull(),
  delayDays: integer("delay_days").notNull(),
  delayValue: integer("delay_value"),
  delayUnit: text("delay_unit").default("days"),
  stepLabel: text("step_label"),
  channel: text("channel").default("email"),
  templateId: integer("template_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSequenceTemplateSchema = createInsertSchema(sequenceTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSequenceTemplate = z.infer<typeof insertSequenceTemplateSchema>;
export type SequenceTemplate = typeof sequenceTemplatesTable.$inferSelect;
