import { pgTable, serial, integer, text, numeric, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const pricingRulesTable = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  startingPrice: numeric("starting_price"),
  internalCostBasis: numeric("internal_cost_basis"),
  rushFeeRule: text("rush_fee_rule"),
  installFeeRule: text("install_fee_rule"),
  removalFeeRule: text("removal_fee_rule"),
  designFeeRule: text("design_fee_rule"),
  upsellTagsJson: jsonb("upsell_tags_json"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPricingRuleSchema = createInsertSchema(pricingRulesTable);
export type PricingRule = typeof pricingRulesTable.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
