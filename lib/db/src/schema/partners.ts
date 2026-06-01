import { pgTable, serial, integer, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const partnersTable = pgTable("partners", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  companyName: text("company_name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  smallA3BadgeEnabled: boolean("small_a3_badge_enabled").default(true),
  introHeadline: text("intro_headline"),
  introText: text("intro_text"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  venueAddress: text("venue_address"),
  industryFocus: text("industry_focus"),
  useCaseOptionsJson: jsonb("use_case_options_json"),
  globalSizzleReelUrl: text("global_sizzle_reel_url"),
  partnerVideoUrl: text("partner_video_url"),
  pricingDisplayEnabled: boolean("pricing_display_enabled").default(false),
  isActive: boolean("is_active").default(true),
  adminEmail: text("admin_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPartnerSchema = createInsertSchema(partnersTable);
export type Partner = typeof partnersTable.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export const partnerAssetsTable = pgTable("partner_assets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  partnerId: serial("partner_id").references(() => partnersTable.id),
  assetType: text("asset_type"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPartnerAssetSchema = createInsertSchema(partnerAssetsTable);
export type PartnerAsset = typeof partnerAssetsTable.$inferSelect;
