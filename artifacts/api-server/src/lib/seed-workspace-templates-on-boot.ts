import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceTemplateCategoriesTable,
  templatesTable,
  templateSetsTable,
  sequenceTemplatesTable,
} from "@workspace/db";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Workspace-aware seed data: template categories, starter templates, and
// default follow-up sequences for the Move Mi and StrataLogic workspaces.
//
// Everything seeded here is tagged with the owning workspace_id so it can be
// scoped per tenant, and is plain editable data in the Templates and
// Sequences modules after seeding. The seed is idempotent and authoritative
// for these two workspaces' categories: it reconciles the category list and
// only inserts templates/sequences when none exist yet for the workspace, so
// later edits in the UI are never overwritten.
//
// Merge tokens used by this copy (resolved by lib/template-engine.ts):
//   Contact:   {{firstName}} {{companyName}} {{city}}
//   Sender:    {{senderName}} {{senderTitle}} {{calendarLink}}
//   Workspace: {{workspaceName}} {{offerSummary}}
//   Move Mi:   {{referralFeeNote}}        (preferred-partner referral fee)
//   StrataLogic:{{betaOfferNote}}         (beta waitlist / 3-year locked pricing)
//   Follow-up: {{originalSubject}}        (threads replies to the first email)
//
// Business logic:
//   Move Mi      — preferred-partner / referral relationship; a referral fee
//                  for each successful move; partners include realtors,
//                  property managers, apartment/condo buildings, referral
//                  partners.
//   StrataLogic  — invite clinics, clinicians, and coaches to a beta waitlist;
//                  early beta users lock in reduced subscription pricing for
//                  three years.
// ---------------------------------------------------------------------------

const FOLLOWUP_STEPS = [
  { stepNumber: 1, delayDays: 3, stepLabel: "3 days", delayValue: 3, delayUnit: "days" },
  { stepNumber: 2, delayDays: 7, stepLabel: "7 days", delayValue: 7, delayUnit: "days" },
  { stepNumber: 3, delayDays: 14, stepLabel: "14 days", delayValue: 14, delayUnit: "days" },
  { stepNumber: 4, delayDays: 30, stepLabel: "1 month", delayValue: 1, delayUnit: "months" },
  { stepNumber: 5, delayDays: 90, stepLabel: "3 months", delayValue: 3, delayUnit: "months" },
  { stepNumber: 6, delayDays: 180, stepLabel: "6 months", delayValue: 6, delayUnit: "months" },
  { stepNumber: 7, delayDays: 365, stepLabel: "1 year", delayValue: 1, delayUnit: "years" },
] as const;

interface SeedCategory {
  name: string;
  description: string;
  audience: string;
  directIntro: { subject: string; body: string };
  valueIntro: { subject: string; body: string };
  steps: string[]; // 7 bodies, aligned to FOLLOWUP_STEPS
}

// Follow-up step subject lines. The first two thread off the original email via
// {{originalSubject}}; the rest are short standalone nudges.
const STEP_SUBJECTS = [
  "Re: {{originalSubject}}",
  "Following up — {{originalSubject}}",
  "One more idea",
  "Checking in",
  "Reconnecting",
  "Worth another look?",
  "Reconnecting after a year",
] as const;

// ===========================================================================
// MOVE MI
// Model: preferred-partner referral relationship; referral fee on every
// successful move. Tone: professional, warm, clear, local, low pressure.
// Arc: light bump, value reminder, partnership angle, soft check-in,
// reactivation, seasonal reactivation, annual reconnect.
// ===========================================================================

function moveMiSteps(opts: {
  audience: string;
  hook: string;
  value: string;
  partnership: string;
  seasonal: string;
}): string[] {
  const { audience, hook, value, partnership, seasonal } = opts;
  return [
    // 1 — light bump (3 days)
    `Hi {{firstName}},\n\nJust floating this back to the top of your inbox. ${hook}\n\nAs a {{workspaceName}} preferred partner, {{referralFeeNote}}\n\nNo rush at all — happy to share more whenever the timing works.\n\n{{senderName}}\n{{senderTitle}}`,
    // 2 — value reminder (7 days)
    `Hi {{firstName}},\n\nQuick context on why ${audience} partner with {{workspaceName}}: ${value}\n\nIt's {{offerSummary}} — and {{referralFeeNote}}\n\nGlad to walk through it.\n\n{{senderName}}`,
    // 3 — partnership angle (14 days)
    `Hi {{firstName}},\n\n${partnership} {{referralFeeNote}}\n\nOpen to a quick chat? {{calendarLink}}\n\n{{senderName}}`,
    // 4 — soft check-in (1 month)
    `Hi {{firstName}},\n\nNo pressure here — just checking whether a referral partnership with {{workspaceName}} is worth exploring for {{companyName}} this season.\n\nHappy to keep it simple.\n\n{{senderName}}`,
    // 5 — reactivation (3 months)
    `Hi {{firstName}},\n\nIt's been a little while. If your clients are moving, we can take the coordination off your plate — and {{referralFeeNote}}\n\nWorth reconnecting?\n\n{{senderName}}`,
    // 6 — seasonal reactivation (6 months)
    `Hi {{firstName}},\n\nWith the busy moving season coming up around {{city}}, I wanted to reopen this. ${seasonal}\n\nThe offer still stands: {{offerSummary}}.\n\n{{senderName}}`,
    // 7 — annual reconnect (1 year)
    `Hi {{firstName}},\n\nIt's been about a year — reconnecting to see how things are going at {{companyName}}. If a reliable moving partner (with a referral fee on every completed move) would help your clients this year, I'd love to be that resource.\n\n{{calendarLink}}\n\n{{senderName}}`,
  ];
}

function moveMiCategory(opts: {
  name: string;
  description: string;
  audience: string;
  directSubject: string;
  directHook: string;
  valueSubject: string;
  valueAngle: string;
  hook: string;
  value: string;
  partnership: string;
  seasonal: string;
}): SeedCategory {
  return {
    name: opts.name,
    description: opts.description,
    audience: opts.audience,
    directIntro: {
      subject: opts.directSubject,
      body: `Hi {{firstName}},\n\n${opts.directHook}\n\n{{workspaceName}} works with ${opts.audience} as preferred referral partners: {{offerSummary}}.\n\n{{referralFeeNote}}\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: opts.valueSubject,
      body: `Hi {{firstName}},\n\n${opts.valueAngle}\n\nThe model is simple: become a {{workspaceName}} preferred partner and get {{offerSummary}}. {{referralFeeNote}}\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: opts.audience,
      hook: opts.hook,
      value: opts.value,
      partnership: opts.partnership,
      seasonal: opts.seasonal,
    }),
  };
}

const MOVE_MI_CATEGORIES: SeedCategory[] = [
  moveMiCategory({
    name: "Realtors",
    description: "Outreach to realtors and real estate agents",
    audience: "realtors",
    directSubject: "A referral fee on every client move",
    directHook:
      "I'll keep this short. A client's move can shape how they remember the whole closing — and it can be a quiet source of referral income for you.",
    valueSubject: "A referral partnership for {{companyName}}",
    valueAngle:
      "Realtors who refer us tell us it makes them look good with clients — the move just gets handled, and they earn on every one.",
    hook: "We help realtors give clients a smooth, on-time move — and pay you for the introduction.",
    value: "we handle move timing and become a trusted local resource your clients remember.",
    partnership:
      "Becoming a realtor's go-to mover means clients transition smoothly with no extra lift for you.",
    seasonal: "Closings tend to cluster this time of year — having a reliable mover ready keeps clients happy.",
  }),
  moveMiCategory({
    name: "Property Managers",
    description: "Outreach to property management companies",
    audience: "property managers",
    directSubject: "Easier tenant moves — and a referral fee",
    directHook:
      "Quick note — move-ins and move-outs are where a lot of friction shows up for property managers, and they can also earn you a referral fee.",
    valueSubject: "A reliable move partner for {{companyName}}",
    valueAngle:
      "A dependable moving partner makes resident transitions smoother for your team — and pays you back on every completed move.",
    hook: "We help property managers reduce friction during tenant transitions — and reward the referral.",
    value: "we support tenant move-ins and move-outs and give residents a reliable partner.",
    partnership: "Offering residents a trusted mover takes transition headaches off your team.",
    seasonal: "Lease turnover season is a natural time to have move support lined up.",
  }),
  moveMiCategory({
    name: "Apartment Buildings",
    description: "Outreach to apartment complexes and leasing offices",
    audience: "apartment buildings",
    directSubject: "Smoother resident moves — and a referral fee",
    directHook:
      "Keeping this brief — resident moves can get chaotic without a little coordination, and a building partnership can earn a referral fee on each one.",
    valueSubject: "A resident move partner for {{companyName}}",
    valueAngle:
      "Some buildings set up a simple partnership so residents have a reliable mover on hand — and the building earns on every referred move.",
    hook: "We help apartment buildings keep resident moves organized — and pay on every referral.",
    value: "we smooth out resident move logistics and can support a building partnership.",
    partnership: "A building partnership gives residents an easy, reliable moving option.",
    seasonal: "With move season picking up, smoother building logistics go a long way.",
  }),
  moveMiCategory({
    name: "Condo Associations",
    description: "Outreach to condo associations and HOAs",
    audience: "condo associations",
    directSubject: "Organized resident moves — and a referral fee",
    directHook:
      "Quick note — coordinating moves across owners can get tricky for an association, and a preferred-mover relationship can return a referral fee.",
    valueSubject: "Smoother resident moves for {{companyName}}",
    valueAngle:
      "A coordinated mover makes association communication easier — and the association earns on every referred move.",
    hook: "We help condo associations coordinate moves with less hassle — and reward referrals.",
    value: "we bring organized coordination and easier communication for a better resident experience.",
    partnership: "Organized move coordination means fewer complaints and happier residents.",
    seasonal: "Ahead of the busy season, a coordinated moving option helps residents plan.",
  }),
  moveMiCategory({
    name: "Luxury Residential",
    description: "Outreach for high-end, white-glove residential moves",
    audience: "luxury real estate professionals",
    directSubject: "An elevated move — and a referral fee",
    directHook:
      "Keeping this short — high-end clients expect a move as considered as the rest of their experience, and the referral can pay you back.",
    valueSubject: "White-glove moves for {{companyName}} clients",
    valueAngle:
      "For luxury clients the moving experience reflects directly on you — and a preferred-partner relationship rewards every introduction.",
    hook: "We give luxury clients an elevated, discreet move — and reward the referral.",
    value: "we bring elevated service, a cleaner client experience, and real discretion.",
    partnership: "An elevated moving partner protects the premium experience your clients expect.",
    seasonal: "As calendars fill up, securing a white-glove mover early matters for luxury clients.",
  }),
  moveMiCategory({
    name: "Referral Partners",
    description: "Build and nurture referral partnerships",
    audience: "referral partners",
    directSubject: "A simple, paid referral relationship",
    directHook:
      "Reaching out because good referral relationships make everyone look better — and ours pays a fee on every successful move.",
    valueSubject: "A referral relationship with {{companyName}}",
    valueAngle:
      "We believe referrals should pay off for the people who make them.",
    hook: "We'd love to set up a simple, paid referral relationship.",
    value: "we keep introductions easy and reward you on every completed move.",
    partnership: "A preferred-partner referral relationship means every introduction you send pays back.",
    seasonal: "Heading into a busier stretch, it's a good time to have referral partners lined up.",
  }),
  moveMiCategory({
    name: "Local Brand Partners",
    description: "Co-marketing with local brands and businesses",
    audience: "local businesses",
    directSubject: "A neighborhood partnership — with a referral fee",
    directHook:
      "Quick note — neighborhood partnerships create real value on both sides, and ours includes a referral fee on every move you send our way.",
    valueSubject: "A local partnership with {{companyName}}",
    valueAngle:
      "Cross-promotion with local brands tends to be a win for everyone — and our preferred-partner model adds a referral fee on top.",
    hook: "We're exploring neighborhood partnerships with local brands like {{companyName}}.",
    value: "we add value for each other's customers and reward referred moves.",
    partnership: "A neighborhood partnership lets us add value for each other's customers — and pays on referrals.",
    seasonal: "Seasonal promotions are a natural moment for a local co-marketing tie-in.",
  }),
  moveMiCategory({
    name: "Reactivation",
    description: "Re-engage past leads and partners",
    audience: "partners",
    directSubject: "Reopening our referral partnership",
    directHook:
      "We connected a while back and I wanted to reopen the conversation — our preferred-partner referral program may be a better fit now.",
    valueSubject: "Has the timing changed?",
    valueAngle:
      "Just circling back to see if priorities have shifted since we last spoke.",
    hook: "Just checking back in to see if the timing is better now.",
    value: "we're glad to restart the relationship — and reward you on every referred move.",
    partnership: "If priorities have shifted, our paid referral partnership is an easy place to restart.",
    seasonal: "With the season changing, it felt like a good time to reconnect.",
  }),
];

// ===========================================================================
// STRATALOGIC
// Model: invite clinics, clinicians, and coaches to a beta waitlist; early
// beta users lock in reduced subscription pricing for three years.
// Tone: credible, clear, concise, modern healthcare / B2B. Not overhyped.
// Arc: light follow-up, value & use-case, workflow angle, soft check-in,
// pilot/reactivation, updated relevance, annual reconnect.
// ===========================================================================

function strataSteps(opts: {
  audience: string;
  useCase: string;
  workflow: string;
  pilot: string;
}): string[] {
  const { audience, useCase, workflow, pilot } = opts;
  return [
    // 1 — light follow-up (3 days)
    `Hi {{firstName}},\n\nBringing this back to the top of your inbox. We're inviting ${audience} to the {{workspaceName}} beta — ${useCase}.\n\n{{betaOfferNote}}\n\nWant me to save {{companyName}} a spot on the waitlist?\n\n{{senderName}}\n{{senderTitle}}`,
    // 2 — value & use-case reminder (7 days)
    `Hi {{firstName}},\n\nA bit more context for {{companyName}}: ${workflow}.\n\nEarly beta users get {{offerSummary}} — {{betaOfferNote}}\n\nGlad to share a short example.\n\n{{senderName}}`,
    // 3 — workflow angle (14 days)
    `Hi {{firstName}},\n\nWhere ${audience} feel this most: ${useCase}, without adding complexity.\n\nWorth a quick look before beta spots fill? {{calendarLink}}\n\n{{senderName}}`,
    // 4 — soft check-in (1 month)
    `Hi {{firstName}},\n\nNo pressure — just checking whether the {{workspaceName}} beta is worth a look for {{companyName}} this quarter. {{betaOfferNote}}\n\nGlad to keep it brief.\n\n{{senderName}}`,
    // 5 — pilot / reactivation angle (3 months)
    `Hi {{firstName}},\n\nIf evaluating fit is the hard part, ${pilot} is the easiest next step — and founding-member pricing is still locked in for early beta users.\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    // 6 — updated relevance (6 months)
    `Hi {{firstName}},\n\nReopening this with fresh context — we've kept refining how we support ${audience}, and ${workflow}.\n\nThe beta waitlist is still open: {{offerSummary}}.\n\n{{senderName}}`,
    // 7 — annual reconnect (1 year)
    `Hi {{firstName}},\n\nIt's been about a year — reconnecting to see how things have evolved at {{companyName}}. If structured workflow support is on the roadmap, the {{workspaceName}} beta (with pricing locked in for three years) is still worth a look.\n\n{{calendarLink}}\n\n{{senderName}}`,
  ];
}

function strataCategory(opts: {
  name: string;
  description: string;
  audience: string;
  directSubject: string;
  directHook: string;
  valueSubject: string;
  valueAngle: string;
  useCase: string;
  workflow: string;
  pilot: string;
}): SeedCategory {
  return {
    name: opts.name,
    description: opts.description,
    audience: opts.audience,
    directIntro: {
      subject: opts.directSubject,
      body: `Hi {{firstName}},\n\n${opts.directHook}\n\nWe're opening a limited beta of {{workspaceName}} to ${opts.audience}, and I'd like to invite {{companyName}} onto the waitlist: {{offerSummary}}.\n\n{{betaOfferNote}}\n\nWant me to save you a spot? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: opts.valueSubject,
      body: `Hi {{firstName}},\n\n${opts.valueAngle}\n\nJoining the {{workspaceName}} beta means {{offerSummary}}. {{betaOfferNote}}\n\nSpots are limited — happy to add {{companyName}} to the waitlist. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: opts.audience,
      useCase: opts.useCase,
      workflow: opts.workflow,
      pilot: opts.pilot,
    }),
  };
}

const STRATALOGIC_CATEGORIES: SeedCategory[] = [
  strataCategory({
    name: "Functional Medicine Clinics",
    description: "Outreach to functional medicine practices",
    audience: "functional medicine clinics",
    directSubject: "An invite to the {{workspaceName}} beta",
    directHook:
      "Reaching out because supplement and protocol workflows get heavy fast without structure — and we're opening early beta access at founding-member pricing.",
    valueSubject: "Founding-member pricing for {{companyName}}",
    valueAngle:
      "Functional medicine protocols are powerful but operationally heavy, and most clinics want cleaner workflows without added complexity.",
    useCase: "cleaner supplement and protocol workflows",
    workflow: "structured clinical decision support with better operational visibility",
    pilot: "a short pilot to see how it fits your protocol workflow",
  }),
  strataCategory({
    name: "Longevity Clinics",
    description: "Outreach to longevity and healthspan clinics",
    audience: "longevity clinics",
    directSubject: "Beta access for {{companyName}}",
    directHook:
      "Quick note — complex longevity protocols are only as consistent as the systems behind them, and we're inviting early clinics into beta at locked-in pricing.",
    valueSubject: "Founding-member pricing for {{companyName}}",
    valueAngle:
      "Modern longevity workflows are only as good as the systems behind them, and most clinics want operational consistency as they scale.",
    useCase: "support for complex protocols and operational consistency",
    workflow: "scalable clinic systems that keep complex protocols consistent",
    pilot: "a pilot to test fit with your longevity protocols",
  }),
  strataCategory({
    name: "Wellness Clinics",
    description: "Outreach to wellness and integrative clinics",
    audience: "wellness clinics",
    directSubject: "An invite to the {{workspaceName}} beta",
    directHook:
      "Reaching out because practitioner workflows get cluttered as a clinic grows — and our beta locks in reduced pricing for early adopters.",
    valueSubject: "Founding-member pricing for {{companyName}}",
    valueAngle:
      "Growth usually exposes the gaps in day-to-day workflow, and most wellness clinics want streamlined practitioner support without a heavy rollout.",
    useCase: "streamlined practitioner support and clearer workflows",
    workflow: "improved workflow clarity with easy operational adoption",
    pilot: "a low-friction pilot for your practitioner team",
  }),
  strataCategory({
    name: "Med Spas",
    description: "Outreach to med spas and aesthetic providers",
    audience: "med spas",
    directSubject: "Beta access for {{companyName}}",
    directHook:
      "Quick note — more advanced offerings raise the bar on internal process, and our beta lets early med spas lock in founding-member pricing.",
    valueSubject: "Founding-member pricing for {{companyName}}",
    valueAngle:
      "More advanced services raise the bar on operational support, and most med spas want a clearer internal process without slowing the team down.",
    useCase: "operational support for more advanced offerings",
    workflow: "clearer internal process and scalable systems",
    pilot: "a quick pilot to evaluate operational fit",
  }),
  strataCategory({
    name: "Provider Groups",
    description: "Outreach to multi-provider groups and networks",
    audience: "provider groups",
    directSubject: "An invite to the {{workspaceName}} beta",
    directHook:
      "Reaching out because standardization across providers is hard to maintain at scale — and our beta locks in reduced pricing for early groups.",
    valueSubject: "Founding-member pricing for {{companyName}}",
    valueAngle:
      "Coordinating multiple providers makes consistency the real challenge, and most groups want standardization and visibility without heavy overhead.",
    useCase: "standardization and visibility across your team",
    workflow: "operational coordination and visibility across providers",
    pilot: "a pilot across a subset of your providers",
  }),
  strataCategory({
    name: "Pilot Partnerships",
    description: "Outreach to set up pilot programs",
    audience: "clinicians and coaches",
    directSubject: "A low-friction beta pilot",
    directHook:
      "Quick note — the easiest way to evaluate fit is a low-friction pilot, and beta participants lock in founding-member pricing for three years.",
    valueSubject: "Evaluating fit at {{companyName}}",
    valueAngle:
      "No need to commit before you've seen it work in your environment — beta gives you a practical way to evaluate fit at locked-in pricing.",
    useCase: "a practical way to evaluate fit",
    workflow: "a clear, low-friction implementation path",
    pilot: "a structured pilot with a practical implementation path",
  }),
  strataCategory({
    name: "Conference Follow-Up",
    description: "Follow-up after conferences and events",
    audience: "clinicians and coaches",
    directSubject: "Great to connect — your {{workspaceName}} beta invite",
    directHook:
      "Great connecting at the event — I wanted to continue the conversation and get you on the {{workspaceName}} beta waitlist while founding-member pricing is open.",
    valueSubject: "Continuing our conversation",
    valueAngle:
      "Following up on our conversation from the event — the easiest next step is a spot on the beta waitlist.",
    useCase: "structured decision support and cleaner workflows",
    workflow: "a short intro or demo to pick up where we left off",
    pilot: "a brief demo to continue from the event",
  }),
  strataCategory({
    name: "Reactivation",
    description: "Re-engage dormant providers and prospects",
    audience: "clinics, clinicians, and coaches",
    directSubject: "Revisiting the timing — beta is open",
    directHook:
      "Circling back in case priorities have shifted since we last spoke — the {{workspaceName}} beta is open, and founding-member pricing is still on the table.",
    valueSubject: "Has the timing changed?",
    valueAngle:
      "Just checking whether the timing is better now than when we last spoke.",
    useCase: "structured decision support and cleaner workflows",
    workflow: "re-opening the conversation whenever it's relevant",
    pilot: "a pilot conversation if priorities have changed",
  }),
];

interface WorkspaceTemplateSeed {
  slug: string;
  categories: SeedCategory[];
  valueIntroLabel: string;
  // Specific placeholder category names this seeder created in earlier
  // iterations that have since been renamed. Only these are cleaned up, so
  // admin-created categories are never deleted.
  legacyCategoryNames: string[];
}

const WORKSPACE_TEMPLATE_SEEDS: WorkspaceTemplateSeed[] = [
  {
    slug: "move-mi",
    categories: MOVE_MI_CATEGORIES,
    valueIntroLabel: "Value-Driven Partnership Intro",
    legacyCategoryNames: ["Realtor Outreach"],
  },
  {
    slug: "stratalogic",
    categories: STRATALOGIC_CATEGORIES,
    valueIntroLabel: "Consultative Value Intro",
    legacyCategoryNames: ["Clinics", "Longevity Providers", "Demos", "Conference Follow-up"],
  },
];

async function reconcileCategories(
  workspaceId: number,
  categories: SeedCategory[],
  legacyNames: string[],
): Promise<number> {
  // One-time cleanup: remove only the specific legacy placeholder categories
  // this seeder previously created (now renamed). Any other categories —
  // including admin-created ones — are preserved so they stay editable.
  if (legacyNames.length > 0) {
    await db
      .delete(workspaceTemplateCategoriesTable)
      .where(
        and(
          eq(workspaceTemplateCategoriesTable.workspaceId, workspaceId),
          inArray(workspaceTemplateCategoriesTable.name, legacyNames),
        ),
      );
  }

  const inserted = await db
    .insert(workspaceTemplateCategoriesTable)
    .values(categories.map((c) => ({ workspaceId, name: c.name, description: c.description })))
    .onConflictDoNothing()
    .returning({ id: workspaceTemplateCategoriesTable.id });

  return inserted.length;
}

export async function seedWorkspaceTemplatesIfNeeded(): Promise<{
  categories: number;
  templates: number;
  sequences: number;
  steps: number;
}> {
  const result = { categories: 0, templates: 0, sequences: 0, steps: 0 };

  for (const ws of WORKSPACE_TEMPLATE_SEEDS) {
    try {
      const [workspace] = await db
        .select({ id: workspacesTable.id })
        .from(workspacesTable)
        .where(eq(workspacesTable.slug, ws.slug));
      if (!workspace) continue;
      const workspaceId = workspace.id;

      result.categories += await reconcileCategories(workspaceId, ws.categories, ws.legacyCategoryNames);

      // Templates: seed only when none exist for this workspace (idempotent;
      // never clobbers edits made later in the Templates module).
      const existingTemplates = await db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.workspaceId, workspaceId))
        .limit(1);

      // Sequences: same per-workspace guard for template sets.
      const existingSets = await db
        .select({ id: templateSetsTable.id })
        .from(templateSetsTable)
        .where(eq(templateSetsTable.workspaceId, workspaceId))
        .limit(1);

      const seedSequences = existingSets.length === 0;
      const seedTemplates = existingTemplates.length === 0;

      // Map of category name -> created sequence (template set) id, used to
      // link each "Direct intro" template to its default follow-up sequence.
      const sequenceIdByCategory: Record<string, number> = {};

      if (seedSequences) {
        for (const cat of ws.categories) {
          const [set] = await db
            .insert(templateSetsTable)
            .values({
              workspaceId,
              name: `${cat.name} Follow-Up`,
              segmentType: cat.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
              category: cat.name,
              description: `Default 7-step follow-up sequence for ${cat.name}`,
              isActive: true,
            })
            .returning();

          sequenceIdByCategory[cat.name] = set.id;

          await db.insert(sequenceTemplatesTable).values(
            FOLLOWUP_STEPS.map((step, i) => ({
              templateSetId: set.id,
              stepNumber: step.stepNumber,
              name: `${cat.name} — Step ${step.stepNumber} (${step.stepLabel})`,
              subject: STEP_SUBJECTS[i],
              body: cat.steps[i],
              delayDays: step.delayDays,
              delayValue: step.delayValue,
              delayUnit: step.delayUnit,
              stepLabel: step.stepLabel,
              channel: "email",
              isActive: true,
            })),
          );

          result.sequences++;
          result.steps += FOLLOWUP_STEPS.length;
        }
      } else {
        // Sequences already exist — resolve their ids so templates can link.
        const sets = await db
          .select({ id: templateSetsTable.id, category: templateSetsTable.category })
          .from(templateSetsTable)
          .where(eq(templateSetsTable.workspaceId, workspaceId));
        for (const s of sets) {
          if (s.category) sequenceIdByCategory[s.category] = s.id;
        }
      }

      if (seedTemplates) {
        for (const cat of ws.categories) {
          const linkedId = sequenceIdByCategory[cat.name] ?? null;

          await db.insert(templatesTable).values({
            workspaceId,
            name: `${cat.name} — Direct Intro`,
            category: cat.name,
            type: "intro",
            subject: cat.directIntro.subject,
            body: cat.directIntro.body,
            description: `Direct intro for ${cat.name}`,
            linkedSequenceId: linkedId,
            linkedTemplateSetId: linkedId,
            isActive: true,
          });

          await db.insert(templatesTable).values({
            workspaceId,
            name: `${cat.name} — ${ws.valueIntroLabel}`,
            category: cat.name,
            type: "intro",
            subject: cat.valueIntro.subject,
            body: cat.valueIntro.body,
            description: `${ws.valueIntroLabel} for ${cat.name}`,
            isActive: true,
          });

          result.templates += 2;
        }
      }

      // Repair pass (always runs): if a Direct Intro template exists with no
      // linked sequence but its category's sequence does exist — e.g. templates
      // and sequences were seeded across separate boots — backfill the link.
      const setsForRepair = await db
        .select({ id: templateSetsTable.id, category: templateSetsTable.category })
        .from(templateSetsTable)
        .where(eq(templateSetsTable.workspaceId, workspaceId));
      const setIdByCategory: Record<string, number> = {};
      for (const s of setsForRepair) {
        if (s.category) setIdByCategory[s.category] = s.id;
      }

      const intros = await db
        .select({
          id: templatesTable.id,
          name: templatesTable.name,
          category: templatesTable.category,
          linkedSequenceId: templatesTable.linkedSequenceId,
        })
        .from(templatesTable)
        .where(eq(templatesTable.workspaceId, workspaceId));

      for (const t of intros) {
        if (t.linkedSequenceId != null) continue;
        if (!t.name.endsWith("— Direct Intro")) continue;
        const setId = t.category ? setIdByCategory[t.category] : undefined;
        if (!setId) continue;
        await db
          .update(templatesTable)
          .set({ linkedSequenceId: setId, linkedTemplateSetId: setId })
          .where(eq(templatesTable.id, t.id));
      }
    } catch (err: any) {
      logger.warn({ err: err.message, slug: ws.slug }, "Workspace template seed iteration failed");
    }
  }

  if (result.categories || result.templates || result.sequences) {
    logger.info(result, "Seeded workspace-specific templates and sequences");
  }

  return result;
}
