import { eq } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceTemplateCategoriesTable,
  type WorkspaceBranding,
  type WorkspaceSenderIdentity,
  type WorkspaceModule,
} from "@workspace/db";
import { logger } from "./logger";

// Shared default operational settings applied to every new workspace. A
// workspace admin can override these later from the settings module.
const DEFAULT_WORKSPACE_SETTINGS: Record<string, string> = {
  daily_send_cap: "50",
  per_inbox_send_cap: "50",
  send_window_start: "8",
  send_window_end: "18",
  business_days_only: "true",
  weekday_sending_only: "true",
  primary_send_provider: "resend",
  randomized_spacing: "true",
  reply_detection_interval: "30",
  tracking_domain: "",
};

interface WorkspaceSeed {
  name: string;
  slug: string;
  shortCode: string;
  initials: string;
  roleLabel: string;
  workspaceType: string;
  branding: WorkspaceBranding;
  senderIdentity: WorkspaceSenderIdentity;
  modules: WorkspaceModule[];
  templateCategories: { name: string; description: string }[];
}

const WORKSPACE_SEEDS: WorkspaceSeed[] = [
  {
    name: "A3 Visual",
    slug: "a3-visual",
    shortCode: "A3",
    initials: "AV",
    roleLabel: "Sales Team",
    workspaceType: "B2B production / experiential / signage / fabrication",
    branding: {
      displayName: "A3 Visual",
      tagline: "Experiential production & large-format fabrication",
      logoUrl: null,
      primaryColor: "#1b4f9c",
      secondaryColor: "#0f2a52",
      accentColor: "#f5b800",
      fontFamily: "Outfit, Inter, sans-serif",
    },
    senderIdentity: {
      fromName: "A3 Visual",
      fromEmail: "hello@a3visualcontact.com",
      replyToEmail: "hello@a3visualcontact.com",
      signature: "— The A3 Visual Team",
    },
    modules: ["CRM", "Outreach", "Sequences", "Queue", "Analytics", "Companies", "Templates"],
    templateCategories: [
      { name: "Hotels & Hospitality", description: "Outreach to hotels, resorts, and hospitality groups" },
      { name: "Agencies", description: "Outreach to creative, experiential, and marketing agencies" },
      { name: "Developers", description: "Outreach to real estate developers and sales centers" },
      { name: "Venues", description: "Outreach to event venues and stadiums" },
      { name: "Referral Partners", description: "Nurture and activation for referral partners" },
      { name: "Reactivation", description: "Re-engage past contacts and dormant opportunities" },
    ],
  },
  {
    name: "Move Mi",
    slug: "move-mi",
    shortCode: "MM",
    initials: "MM",
    roleLabel: "Workspace Admin",
    workspaceType: "local services / moving / partnerships",
    branding: {
      displayName: "Move Mi",
      tagline: "Local moving & relocation partnerships",
      logoUrl: null,
      primaryColor: "#0f766e",
      secondaryColor: "#0b4f49",
      accentColor: "#f59e0b",
      fontFamily: "Inter, sans-serif",
    },
    senderIdentity: {
      fromName: "Move Mi",
      fromEmail: "hello@movemi.example.com",
      replyToEmail: "hello@movemi.example.com",
      signature: "— The Move Mi Team",
    },
    modules: ["CRM", "Outreach", "Sequences", "Queue", "Companies", "Analytics"],
    templateCategories: [
      { name: "Realtor Outreach", description: "Outreach to realtors and real estate agents" },
      { name: "Property Managers", description: "Outreach to property management companies" },
      { name: "Apartment Buildings", description: "Outreach to apartment complexes and leasing offices" },
      { name: "Referral Partners", description: "Build and nurture referral partnerships" },
      { name: "Local Brand Partners", description: "Co-marketing with local brands and businesses" },
      { name: "Reactivation", description: "Re-engage past leads and partners" },
    ],
  },
  {
    name: "StrataLogic",
    slug: "stratalogic",
    shortCode: "SL",
    initials: "SL",
    roleLabel: "Workspace Admin",
    workspaceType: "clinical SaaS / provider outreach / partnerships",
    branding: {
      displayName: "StrataLogic",
      tagline: "Clinical SaaS & provider partnerships",
      logoUrl: null,
      primaryColor: "#4338ca",
      secondaryColor: "#312e81",
      accentColor: "#22d3ee",
      fontFamily: "Inter, sans-serif",
    },
    senderIdentity: {
      fromName: "StrataLogic",
      fromEmail: "hello@stratalogic.example.com",
      replyToEmail: "hello@stratalogic.example.com",
      signature: "— The StrataLogic Team",
    },
    modules: ["CRM", "Outreach", "Sequences", "Queue", "Analytics", "Companies", "Templates", "Users"],
    templateCategories: [
      { name: "Clinics", description: "Outreach to clinics and medical practices" },
      { name: "Longevity Providers", description: "Outreach to longevity and healthspan providers" },
      { name: "Wellness Clinics", description: "Outreach to wellness and aesthetic clinics" },
      { name: "Pilot Partnerships", description: "Outreach to set up pilot programs" },
      { name: "Demos", description: "Demo scheduling and follow-up" },
      { name: "Conference Follow-up", description: "Follow-up after conferences and events" },
      { name: "Reactivation", description: "Re-engage dormant providers and prospects" },
    ],
  },
  {
    name: "Alyssa Advisory",
    slug: "alyssa-advisory",
    shortCode: "AA",
    initials: "AA",
    roleLabel: "Workspace Admin",
    workspaceType: "consulting / strategy / partnerships",
    branding: {
      displayName: "Alyssa Advisory",
      tagline: "Strategy & growth consulting",
      logoUrl: null,
      primaryColor: "#9333ea",
      secondaryColor: "#6b21a8",
      accentColor: "#f5b800",
      fontFamily: "Outfit, Inter, sans-serif",
    },
    senderIdentity: {
      fromName: "Alyssa Advisory",
      fromEmail: "hello@alyssaadvisory.example.com",
      replyToEmail: "hello@alyssaadvisory.example.com",
      signature: "— Alyssa Advisory",
    },
    modules: ["CRM", "Outreach", "Sequences", "Queue", "Analytics", "Templates"],
    templateCategories: [
      { name: "Strategy Prospects", description: "Outreach to strategy and advisory prospects" },
      { name: "Partnership Outreach", description: "Outreach to potential strategic partners" },
      { name: "Referral Partners", description: "Nurture and activation for referral partners" },
      { name: "Speaking & Events", description: "Outreach for speaking engagements and events" },
      { name: "Discovery Calls", description: "Scheduling and follow-up for discovery calls" },
      { name: "Reactivation", description: "Re-engage past clients and contacts" },
    ],
  },
];

// Idempotently seeds the initial Opypal workspaces with branding, sender
// identity, settings, module access, and sample template categories. Safe to
// run on every boot — existing workspaces are only backfilled where their
// config has not yet been set, so workspace-admin edits are never overwritten.
export async function seedWorkspacesIfNeeded(): Promise<{
  created: number;
  configured: number;
  categories: number;
}> {
  const result = { created: 0, configured: 0, categories: 0 };

  for (const seed of WORKSPACE_SEEDS) {
    try {
      // Conflict-safe insert: if another boot already created the row, this is
      // a no-op and we resolve the id by re-selecting on the unique slug.
      const [inserted] = await db
        .insert(workspacesTable)
        .values({
          name: seed.name,
          slug: seed.slug,
          shortCode: seed.shortCode,
          initials: seed.initials,
          roleLabel: seed.roleLabel,
          workspaceType: seed.workspaceType,
          logoUrl: seed.branding.logoUrl ?? null,
          primaryColor: seed.branding.primaryColor ?? null,
          branding: seed.branding,
          senderIdentity: seed.senderIdentity,
          settings: DEFAULT_WORKSPACE_SETTINGS,
          modules: seed.modules,
        })
        .onConflictDoNothing({ target: workspacesTable.slug })
        .returning();

      let workspaceId: number;

      if (inserted) {
        workspaceId = inserted.id;
        result.created++;
      } else {
        const [existing] = await db
          .select()
          .from(workspacesTable)
          .where(eq(workspacesTable.slug, seed.slug));
        if (!existing) continue;
        workspaceId = existing.id;

        // Field-level backfill: only set a column when it is still empty, so
        // we never overwrite edits a workspace admin has already made.
        const patch: Partial<typeof workspacesTable.$inferInsert> = {};
        if (existing.workspaceType == null) patch.workspaceType = seed.workspaceType;
        if (existing.branding == null) patch.branding = seed.branding;
        if (existing.senderIdentity == null) patch.senderIdentity = seed.senderIdentity;
        if (existing.settings == null) patch.settings = DEFAULT_WORKSPACE_SETTINGS;
        if (existing.modules == null) patch.modules = seed.modules;

        if (Object.keys(patch).length > 0) {
          patch.updatedAt = new Date();
          await db
            .update(workspacesTable)
            .set(patch)
            .where(eq(workspacesTable.id, workspaceId));
          result.configured++;
        }
      }

      if (seed.templateCategories.length) {
        const insertedCategories = await db
          .insert(workspaceTemplateCategoriesTable)
          .values(
            seed.templateCategories.map((c) => ({
              workspaceId,
              name: c.name,
              description: c.description,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: workspaceTemplateCategoriesTable.id });
        result.categories += insertedCategories.length;
      }
    } catch (err: any) {
      // One workspace failing should not abort seeding of the others.
      logger.warn({ err: err.message, slug: seed.slug }, "Workspace seed iteration failed");
    }
  }

  if (result.created || result.configured || result.categories) {
    logger.info(result, "Seeded Opypal workspaces");
  }

  return result;
}
