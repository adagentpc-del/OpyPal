import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ctaLibraryTable = pgTable("cta_library", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  text: text("text").notNull(),
  recommendedForTier: text("recommended_for_tier"),
  recommendedForSegment: text("recommended_for_segment"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCtaLibrarySchema = createInsertSchema(ctaLibraryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCtaLibraryEntry = z.infer<typeof insertCtaLibrarySchema>;
export type CtaLibraryEntry = typeof ctaLibraryTable.$inferSelect;
