import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { leadsTable } from "./leads";
import { contactsTable } from "./contacts";
import { companiesTable } from "./companies";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .references(() => workspacesTable.id)
    .notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  url: text("url"),
  contentType: text("content_type"),
  objectPath: text("object_path"),
  linkedLeadId: integer("linked_lead_id").references(() => leadsTable.id, { onDelete: "set null" }),
  linkedContactId: integer("linked_contact_id").references(() => contactsTable.id, { onDelete: "set null" }),
  linkedCompanyId: integer("linked_company_id").references(() => companiesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assetsTable.$inferSelect;
