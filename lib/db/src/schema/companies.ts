import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  name: text("name").notNull(),
  website: text("website"),
  industry: text("industry"),
  subIndustry: text("sub_industry"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  phone: text("phone"),
  notes: text("notes"),
  leadCount: integer("lead_count").default(0),
  totalDealValue: numeric("total_deal_value", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
