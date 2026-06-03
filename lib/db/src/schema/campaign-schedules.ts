import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { campaignSegmentsTable } from "./campaign-segments";

// An additional/staggered scheduled send within a campaign. Lets a campaign
// queue multiple sends over time (e.g. a follow-up template a week later, or
// different segments going out on different dates). Each schedule references a
// segment for its audience and an optional template/sequence override.
export const campaignSchedulesTable = pgTable("campaign_schedules", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaignsTable.id, { onDelete: "cascade" })
    .notNull(),
  segmentId: integer("segment_id").references(() => campaignSegmentsTable.id, { onDelete: "cascade" }),
  label: text("label"),
  templateId: integer("template_id"),
  sequenceId: integer("sequence_id"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sendWindowStart: integer("send_window_start"),
  sendWindowEnd: integer("send_window_end"),
  status: text("status").default("scheduled"),
  lastBulkCampaignId: integer("last_bulk_campaign_id"),
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignScheduleSchema = createInsertSchema(campaignSchedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaignSchedule = z.infer<typeof insertCampaignScheduleSchema>;
export type CampaignSchedule = typeof campaignSchedulesTable.$inferSelect;
