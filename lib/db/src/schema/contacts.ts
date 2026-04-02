import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company").notNull(),
  title: text("title"),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  industry: text("industry"),
  intentSignal: text("intent_signal"),
  customLine: text("custom_line"),
  whySelected: text("why_selected"),
  segmentType: text("segment_type"),
  campaignName: text("campaign_name"),
  campaignId: integer("campaign_id"),
  assignedTemplateSet: text("assigned_template_set"),
  templateSetId: integer("template_set_id"),
  currentStep: integer("current_step").default(0),
  sequenceStatus: text("sequence_status").notNull().default("pending"),
  engagementScore: integer("engagement_score").default(0),
  engagementTier: text("engagement_tier").default("cold"),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  lastReplyAt: timestamp("last_reply_at"),
  nextSendAt: timestamp("next_send_at"),
  doNotContact: boolean("do_not_contact").default(false),
  unsubscribed: boolean("unsubscribed").default(false),
  bounced: boolean("bounced").default(false),
  bounceStatus: text("bounce_status"),
  sourceFileName: text("source_file_name"),
  uploadedAt: timestamp("uploaded_at"),
  notes: text("notes"),
  importId: integer("import_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
