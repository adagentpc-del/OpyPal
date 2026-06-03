import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

// A segment is a targeted slice of a campaign: one set of recipients (resolved
// from leads by contact type / saved filter rules / manual selection) paired
// with its own template, follow-up sequence, sender identity, assets, and
// scheduled send date. A campaign can hold many segments (e.g. Hotels, Venues).
export const campaignSegmentsTable = pgTable("campaign_segments", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaignsTable.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  // JSON array of contact-type labels (e.g. ["Hotels","Venues"]). Matched
  // against leads.contact_type.
  contactTypes: text("contact_types"),
  // JSON object of additional saved filter rules over lead columns, e.g.
  // { status, pipelineType, source, industry, search }.
  filterRules: text("filter_rules"),
  // JSON array of explicitly-selected lead ids (manual selection). When present
  // it is unioned with the contact-type / filter matches.
  manualLeadIds: text("manual_lead_ids"),
  templateId: integer("template_id"),
  sequenceId: integer("sequence_id"),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  replyTo: text("reply_to"),
  provider: text("provider"),
  scheduledFor: timestamp("scheduled_for"),
  sendWindowStart: integer("send_window_start"),
  sendWindowEnd: integer("send_window_end"),
  // JSON array of asset ids attached to this segment.
  assetIds: text("asset_ids"),
  status: text("status").default("draft"),
  notes: text("notes"),
  // Links to the bulk_send_campaigns row created when this segment is executed.
  lastBulkCampaignId: integer("last_bulk_campaign_id"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignSegmentSchema = createInsertSchema(campaignSegmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaignSegment = z.infer<typeof insertCampaignSegmentSchema>;
export type CampaignSegment = typeof campaignSegmentsTable.$inferSelect;
