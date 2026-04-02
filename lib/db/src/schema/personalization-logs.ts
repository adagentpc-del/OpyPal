import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personalizationLogsTable = pgTable("personalization_logs", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  inputFieldsUsed: text("input_fields_used"),
  outputText: text("output_text"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonalizationLogSchema = createInsertSchema(personalizationLogsTable).omit({ id: true, createdAt: true });
export type InsertPersonalizationLog = z.infer<typeof insertPersonalizationLogSchema>;
export type PersonalizationLog = typeof personalizationLogsTable.$inferSelect;
