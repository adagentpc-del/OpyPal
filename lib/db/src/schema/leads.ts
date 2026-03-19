import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  pipelineType: text("pipeline_type").notNull(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
  location: text("location"),
  industry: text("industry"),
  venueProperty: text("venue_property"),
  projectType: text("project_type"),
  estimatedBudget: numeric("estimated_budget", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("New Lead"),
  lastContactDate: text("last_contact_date"),
  nextStep: text("next_step"),
  nextFollowUpDate: text("next_follow_up_date"),
  notes: text("notes"),
  dealValueEstimate: numeric("deal_value_estimate", { precision: 12, scale: 2 }),
  proposalValue: numeric("proposal_value", { precision: 12, scale: 2 }),
  closeProbability: numeric("close_probability", { precision: 5, scale: 2 }),
  forecastValue: numeric("forecast_value", { precision: 12, scale: 2 }),
  source: text("source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
