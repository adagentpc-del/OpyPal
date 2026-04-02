import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sequenceStepsTable = pgTable("sequence_steps", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  enrollmentId: integer("enrollment_id"),
  stepNumber: integer("step_number").notNull(),
  templateSetName: text("template_set_name"),
  templateId: integer("template_id"),
  delayDays: integer("delay_days").notNull(),
  subjectRendered: text("subject_rendered"),
  bodyRendered: text("body_rendered"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  skippedAt: timestamp("skipped_at"),
  canceledAt: timestamp("canceled_at"),
  customLineSnapshot: text("custom_line_snapshot"),
  messageId: text("message_id"),
  smtpResponse: text("smtp_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSequenceStepSchema = createInsertSchema(sequenceStepsTable).omit({ id: true, createdAt: true });
export type InsertSequenceStep = z.infer<typeof insertSequenceStepSchema>;
export type SequenceStep = typeof sequenceStepsTable.$inferSelect;
