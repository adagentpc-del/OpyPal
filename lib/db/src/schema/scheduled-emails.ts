import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { leadsTable } from "./leads";

export const scheduledEmailsTable = pgTable("scheduled_emails", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }).notNull(),
  templateId: integer("template_id"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status").notNull().default("scheduled"),
  sequenceId: integer("sequence_id"),
  sequenceStepNumber: integer("sequence_step_number"),
  sequenceStepId: integer("sequence_step_id"),
  source: text("source").default("manual"),
  originalSubject: text("original_subject"),
  originalBody: text("original_body"),
  pauseReason: text("pause_reason"),
  canceledReason: text("canceled_reason"),
  sentAt: timestamp("sent_at"),
  canceledAt: timestamp("canceled_at"),
  pausedAt: timestamp("paused_at"),
  campaignId: integer("campaign_id"),
  resendMessageId: text("resend_message_id"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  lastAttemptAt: timestamp("last_attempt_at"),
  sendError: text("send_error"),
  queuedAt: timestamp("queued_at"),
  queuePosition: integer("queue_position"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScheduledEmailSchema = createInsertSchema(scheduledEmailsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledEmail = z.infer<typeof insertScheduledEmailSchema>;
export type ScheduledEmail = typeof scheduledEmailsTable.$inferSelect;
