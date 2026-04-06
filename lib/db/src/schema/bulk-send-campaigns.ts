import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bulkSendCampaignsTable = pgTable("bulk_send_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name"),
  templateId: integer("template_id"),
  templateName: text("template_name"),
  sequenceId: integer("sequence_id"),
  sequenceName: text("sequence_name"),
  sender: text("sender"),
  senderEmail: text("sender_email"),
  totalSelected: integer("total_selected").default(0),
  totalSent: integer("total_sent").default(0),
  totalScheduled: integer("total_scheduled").default(0),
  totalSkipped: integer("total_skipped").default(0),
  totalFailed: integer("total_failed").default(0),
  status: text("status").default("pending"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBulkSendCampaignSchema = createInsertSchema(bulkSendCampaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBulkSendCampaign = z.infer<typeof insertBulkSendCampaignSchema>;
export type BulkSendCampaign = typeof bulkSendCampaignsTable.$inferSelect;
