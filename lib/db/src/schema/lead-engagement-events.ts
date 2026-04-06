import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { leadsTable } from "./leads";

export const leadEngagementEventsTable = pgTable("lead_engagement_events", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leadsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id"),
  scheduledEmailId: integer("scheduled_email_id"),
  templateId: integer("template_id"),
  sequenceId: integer("sequence_id"),
  eventType: text("event_type").notNull(),
  eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),
  providerEventId: text("provider_event_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeadEngagementEventSchema = createInsertSchema(leadEngagementEventsTable).omit({ id: true, createdAt: true });
export type InsertLeadEngagementEvent = z.infer<typeof insertLeadEngagementEventSchema>;
export type LeadEngagementEvent = typeof leadEngagementEventsTable.$inferSelect;
