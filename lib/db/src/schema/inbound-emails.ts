import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { leadsTable } from "./leads";

export const inboundEmailsTable = pgTable("inbound_emails", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  scheduledEmailId: integer("scheduled_email_id"),
  campaignId: integer("campaign_id"),
  senderEmail: text("sender_email").notNull(),
  recipientEmail: text("recipient_email"),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  rawHeaders: text("raw_headers"),
  messageId: text("message_id"),
  inReplyTo: text("in_reply_to"),
  references: text("references"),
  matched: boolean("matched").default(false),
  matchMethod: text("match_method"),
  isAutoReply: boolean("is_auto_reply").default(false),
  processedAt: timestamp("processed_at"),
  outlookMessageId: text("outlook_message_id"),
  confidenceScore: integer("confidence_score"),
  classification: text("classification"),
  reviewStatus: text("review_status").default("auto_classified"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInboundEmailSchema = createInsertSchema(inboundEmailsTable).omit({ id: true, createdAt: true });
export type InsertInboundEmail = z.infer<typeof insertInboundEmailSchema>;
export type InboundEmail = typeof inboundEmailsTable.$inferSelect;
