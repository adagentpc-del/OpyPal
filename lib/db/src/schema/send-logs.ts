import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const sendLogsTable = pgTable("send_logs", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  enrollmentId: integer("enrollment_id"),
  sequenceStepId: integer("sequence_step_id"),
  templateId: integer("template_id"),
  stepNumber: integer("step_number"),
  subjectRendered: text("subject_rendered"),
  bodyRendered: text("body_rendered"),
  subject: text("subject"),
  body: text("body"),
  status: text("status").notNull().default("sent"),
  bounceType: text("bounce_type"),
  smtpResponse: text("smtp_response"),
  customLineSnapshot: text("custom_line_snapshot"),
  messageId: text("message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSendLogSchema = createInsertSchema(sendLogsTable).omit({ id: true });
export type InsertSendLog = z.infer<typeof insertSendLogSchema>;
export type SendLog = typeof sendLogsTable.$inferSelect;
