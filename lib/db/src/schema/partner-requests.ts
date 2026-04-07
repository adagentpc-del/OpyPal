import { pgTable, serial, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { partnersTable } from "./partners";

export const partnerRequestsTable = pgTable("partner_requests", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partnersTable.id),
  companyName: text("company_name"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  eventName: text("event_name"),
  eventDate: text("event_date"),
  venueName: text("venue_name"),
  venueAddress: text("venue_address"),
  installDatetime: text("install_datetime"),
  removalDatetime: text("removal_datetime"),
  postEventDisposition: text("post_event_disposition"),
  industry: text("industry"),
  useCase: text("use_case"),
  designAssistanceRequested: text("design_assistance_requested"),
  customFabricationRequested: text("custom_fabrication_requested"),
  immersiveRequested: text("immersive_requested"),
  promotionalItemsRequested: text("promotional_items_requested"),
  additionalNotes: text("additional_notes"),
  status: text("status").default("New").notNull(),
  aiSummary: text("ai_summary"),
  internalSummary: text("internal_summary"),
  estimatedScopeLevel: text("estimated_scope_level"),
  recommendedUpsellsJson: jsonb("recommended_upsells_json"),
  pdfSummaryUrl: text("pdf_summary_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPartnerRequestSchema = createInsertSchema(partnerRequestsTable);
export type PartnerRequest = typeof partnerRequestsTable.$inferSelect;
export type InsertPartnerRequest = z.infer<typeof insertPartnerRequestSchema>;

export const requestItemsTable = pgTable("request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => partnerRequestsTable.id),
  category: text("category"),
  itemName: text("item_name"),
  quantityNote: text("quantity_note"),
  sizeNote: text("size_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRequestItemSchema = createInsertSchema(requestItemsTable);

export const requestUploadsTable = pgTable("request_uploads", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => partnerRequestsTable.id),
  uploadType: text("upload_type"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRequestUploadSchema = createInsertSchema(requestUploadsTable);

export const adminNotesTable = pgTable("admin_notes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => partnerRequestsTable.id),
  noteBody: text("note_body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminNoteSchema = createInsertSchema(adminNotesTable);
