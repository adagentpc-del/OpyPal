import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sendLogsTable = pgTable("send_logs", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  sequenceStepId: integer("sequence_step_id"),
  stepNumber: integer("step_number"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").notNull().default("sent"),
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const insertSendLogSchema = createInsertSchema(sendLogsTable).omit({ id: true });
export type InsertSendLog = z.infer<typeof insertSendLogSchema>;
export type SendLog = typeof sendLogsTable.$inferSelect;
