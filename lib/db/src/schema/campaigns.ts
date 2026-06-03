import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  objective: text("objective"),
  owner: text("owner"),
  status: text("status").default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  defaultSenderName: text("default_sender_name"),
  defaultSenderEmail: text("default_sender_email"),
  defaultReplyTo: text("default_reply_to"),
  defaultProvider: text("default_provider"),
  templateSetId: text("template_set_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
