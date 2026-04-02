import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const importsTable = pgTable("imports", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  campaignId: integer("campaign_id"),
  templateSetId: integer("template_set_id"),
  segmentType: text("segment_type"),
  totalRows: integer("total_rows").default(0),
  validRows: integer("valid_rows").default(0),
  invalidRows: integer("invalid_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  skippedRows: integer("skipped_rows").default(0),
  duplicateRows: integer("duplicate_rows").default(0),
  enrolledRows: integer("enrolled_rows").default(0),
  campaignName: text("campaign_name"),
  templateSetName: text("template_set_name"),
  status: text("status").notNull().default("completed"),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
});

export const insertImportSchema = createInsertSchema(importsTable).omit({ id: true });
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof importsTable.$inferSelect;
