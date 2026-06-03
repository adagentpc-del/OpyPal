import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { campaignSegmentsTable } from "./campaign-segments";

// Associates an uploaded file or an existing workspace asset with a campaign and
// optionally a specific segment. Files uploaded via object storage store their
// serving path in objectPath; reused assets reference the shared assets table.
export const campaignAssetsTable = pgTable("campaign_assets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  campaignId: integer("campaign_id")
    .references(() => campaignsTable.id, { onDelete: "cascade" })
    .notNull(),
  segmentId: integer("segment_id").references(() => campaignSegmentsTable.id, { onDelete: "set null" }),
  assetId: integer("asset_id"),
  title: text("title").notNull(),
  contentType: text("content_type"),
  url: text("url"),
  objectPath: text("object_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignAssetSchema = createInsertSchema(campaignAssetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaignAsset = z.infer<typeof insertCampaignAssetSchema>;
export type CampaignAsset = typeof campaignAssetsTable.$inferSelect;
