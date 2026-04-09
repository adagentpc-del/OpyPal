import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { leadsTable } from "./leads";
import { inboundEmailsTable } from "./inbound-emails";

export const replyReviewQueueTable = pgTable("reply_review_queue", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  inboundEmailId: integer("inbound_email_id").references(() => inboundEmailsTable.id, { onDelete: "cascade" }),
  senderEmail: text("sender_email"),
  subject: text("subject"),
  bodyPreview: text("body_preview"),
  classification: text("classification").notNull().default("uncertain"),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  recommendedAction: text("recommended_action").default("review"),
  reviewedBy: text("reviewed_by"),
  reviewDecision: text("review_decision"),
  reviewedAt: timestamp("reviewed_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReplyReviewSchema = createInsertSchema(replyReviewQueueTable).omit({ id: true, createdAt: true });
export type InsertReplyReview = z.infer<typeof insertReplyReviewSchema>;
export type ReplyReview = typeof replyReviewQueueTable.$inferSelect;
