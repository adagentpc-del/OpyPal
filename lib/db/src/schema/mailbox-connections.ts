import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mailboxConnectionsTable = pgTable("mailbox_connections", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("microsoft"),
  emailAddress: text("email_address").notNull(),
  displayName: text("display_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  tenantId: text("tenant_id"),
  clientId: text("client_id"),
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false),
  lastSyncedAt: timestamp("last_synced_at"),
  syncCursor: text("sync_cursor"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMailboxConnectionSchema = createInsertSchema(mailboxConnectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMailboxConnection = z.infer<typeof insertMailboxConnectionSchema>;
export type MailboxConnection = typeof mailboxConnectionsTable.$inferSelect;
