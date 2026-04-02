import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contactsTable } from "./contacts";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sequenceEnrollmentsTable = pgTable("sequence_enrollments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id"),
  templateSetId: integer("template_set_id"),
  currentStep: integer("current_step").default(0),
  sequenceStatus: text("sequence_status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  nextSendAt: timestamp("next_send_at"),
  completedAt: timestamp("completed_at"),
  pausedReason: text("paused_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSequenceEnrollment = z.infer<typeof insertSequenceEnrollmentSchema>;
export type SequenceEnrollment = typeof sequenceEnrollmentsTable.$inferSelect;
