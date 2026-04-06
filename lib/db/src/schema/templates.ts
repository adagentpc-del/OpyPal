import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  type: text("type").default("custom"),
  subject: text("subject"),
  body: text("body").notNull(),
  description: text("description"),
  linkedAssetIds: text("linked_asset_ids"),
  linkedTemplateSetId: integer("linked_template_set_id"),
  linkedSequenceId: integer("linked_sequence_id"),
  isActive: boolean("is_active").default(true),
  audienceTags: text("audience_tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
