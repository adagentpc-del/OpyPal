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

const STEP_SUBJECTS = [
  "Following up",
  "A quick value note",
  "An idea worth exploring",
  "Checking in",
  "Reconnecting",
  "Worth another look?",
  "Reconnecting after a year",
] as const;

// ===========================================================================
// MOVE MI
// Tone: professional, warm, clear, local, low pressure.
// Tokens: {{firstName}} {{companyName}} {{city}} {{senderName}} {{senderTitle}} {{calendarLink}}
// Follow-up arc: light bump, value reminder, partnership angle, soft check-in,
// reactivation, reactivation w/ local-seasonal angle, annual reconnect.
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
    `Hi {{firstName}},\n\nJust floating this back to the top of your inbox. ${hook}\n\nNo rush at all — happy to share more whenever the timing works.\n\n{{senderName}}\n{{senderTitle}}`,
    // 2 — value reminder (7 days)
    `Hi {{firstName}},\n\nQuick context on why ${audience} like {{companyName}} work with us: ${value}\n\nIf that's helpful, I'm glad to walk through it.\n\n{{senderName}}`,
    // 3 — partnership angle (14 days)
    `Hi {{firstName}},\n\n${partnership} A lot of ${audience} around {{city}} treat us as their go-to moving partner.\n\nOpen to a quick chat? {{calendarLink}}\n\n{{senderName}}`,
    // 4 — soft check-in (1 month)
    `Hi {{firstName}},\n\nNo pressure here — just checking whether smoother moves for your clients is something worth exploring this season.\n\nHappy to keep it simple.\n\n{{senderName}}`,
    // 5 — reactivation (3 months)
    `Hi {{firstName}},\n\nIt's been a little while. If things have gotten busier on your end, we may be able to take some of the moving coordination off your plate.\n\nWorth reconnecting?\n\n{{senderName}}`,
    // 6 — reactivation w/ local/seasonal angle (6 months)
    `Hi {{firstName}},\n\nWith the busy moving season coming up around {{city}}, I wanted to reopen this. ${seasonal}\n\nGlad to help however's easiest.\n\n{{senderName}}`,
    // 7 — annual reconnect (1 year)
    `Hi {{firstName}},\n\nIt's been about a year — reconnecting to see how things are going at {{companyName}}. If a reliable moving partner would help your clients this year, I'd love to be that resource.\n\n{{calendarLink}}\n\n{{senderName}}`,
  ];
}

const MOVE_MI_CATEGORIES: SeedCategory[] = [
  {
    name: "Realtors",
    description: "Outreach to realtors and real estate agents",
    audience: "realtors",
    directIntro: {
      subject: "Smoother moves for your clients",
      body: `Hi {{firstName}},\n\nI'll keep this short. A client's move can shape how they remember the whole closing.\n\nWe help realtors in {{city}} give clients a smoother, lower-stress move with reliable coordination and a clean handoff — so you can stay focused on the deal.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "A partnership idea for {{companyName}}",
      body: `Hi {{firstName}},\n\nRealtors who refer us tell us it makes them look good with clients — the move just gets handled.\n\nThe idea is simple: we become your trusted local moving resource so your clients transition smoothly without extra work on your end.\n\nIf you're open to it, I'd love to explore a simple referral relationship. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "realtors",
      hook: "We help realtors give clients a smooth, on-time move.",
      value: "we reduce stress around move timing and become a trusted local resource your clients remember.",
      partnership: "Becoming a realtor's go-to mover means clients transition smoothly with no extra lift for you.",
      seasonal: "Closings tend to cluster this time of year — having a reliable mover ready keeps clients happy.",
    }),
  },
  {
    name: "Property Managers",
    description: "Outreach to property management companies",
    audience: "property managers",
    directIntro: {
      subject: "Easier tenant move-ins and move-outs",
      body: `Hi {{firstName}},\n\nQuick note — move-ins and move-outs are where a lot of friction tends to show up for property managers.\n\nWe help teams in {{city}} support tenant transitions with reliable coordination and a clean handoff, so there's one less thing to manage.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "A reliable move partner for {{companyName}}",
      body: `Hi {{firstName}},\n\nA dependable moving partner can make resident transitions far smoother for your team.\n\nThe idea is simple: we support your move-ins and move-outs so transitions stay clean and residents get a reliable option.\n\nOpen to exploring a simple partnership? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "property managers",
      hook: "We help property managers reduce friction during tenant transitions.",
      value: "we support tenant move-ins and move-outs and give residents a reliable partner.",
      partnership: "Offering residents a trusted mover takes transition headaches off your team.",
      seasonal: "Lease turnover season is a natural time to have move support lined up.",
    }),
  },
  {
    name: "Apartment Buildings",
    description: "Outreach to apartment complexes and leasing offices",
    audience: "buildings",
    directIntro: {
      subject: "Smoother resident moves",
      body: `Hi {{firstName}},\n\nKeeping this brief — resident moves can get chaotic without a little coordination.\n\nWe help apartment buildings in {{city}} keep move logistics organized, with the option of a simple building partnership so residents always have a go-to mover.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "A resident move partner for {{companyName}}",
      body: `Hi {{firstName}},\n\nSome buildings set up a simple partnership so residents have a reliable mover on hand.\n\nThe idea is simple: we make resident moves smoother with better logistics, and you get a clean, low-effort amenity to offer.\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "buildings",
      hook: "We help apartment buildings keep resident moves organized.",
      value: "we smooth out resident move logistics and can support an optional building partnership.",
      partnership: "An optional building partnership gives residents an easy, reliable moving option.",
      seasonal: "With move season picking up, smoother building logistics go a long way.",
    }),
  },
  {
    name: "Condo Associations",
    description: "Outreach to condo associations and HOAs",
    audience: "associations",
    directIntro: {
      subject: "Organized move coordination for residents",
      body: `Hi {{firstName}},\n\nQuick note — coordinating moves across owners can get tricky for an association.\n\nWe help condo associations in {{city}} keep moving coordination organized with easier communication, for a better resident experience overall.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Smoother resident moves for {{companyName}}",
      body: `Hi {{firstName}},\n\nA coordinated mover tends to make association communication a lot easier.\n\nThe idea is simple: organized move coordination means fewer complaints and a smoother experience for residents.\n\nOpen to exploring a simple arrangement? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "associations",
      hook: "We help condo associations coordinate moves with less hassle.",
      value: "we bring organized coordination and easier communication for a better resident experience.",
      partnership: "Organized move coordination means fewer complaints and happier residents.",
      seasonal: "Ahead of the busy season, a coordinated moving option helps residents plan.",
    }),
  },
  {
    name: "Luxury Residential",
    description: "Outreach for high-end, white-glove residential moves",
    audience: "luxury clients",
    directIntro: {
      subject: "An elevated move experience",
      body: `Hi {{firstName}},\n\nKeeping this short — high-end clients expect a move that feels just as considered as the rest of their experience.\n\nWe give luxury clients in {{city}} an elevated, discreet move with a clean handoff and genuine attention to detail.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "White-glove moves for {{companyName}} clients",
      body: `Hi {{firstName}},\n\nFor luxury clients, the moving experience reflects directly on you.\n\nThe idea is simple: we deliver an elevated, discreet, clean experience that protects the premium standard your clients expect.\n\nIf that's a fit, I'd love to connect. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "luxury clients",
      hook: "We give luxury clients an elevated, discreet moving experience.",
      value: "we bring elevated service, a cleaner client experience, and real discretion.",
      partnership: "An elevated moving partner protects the premium experience your clients expect.",
      seasonal: "As calendars fill up, securing a white-glove mover early matters for luxury clients.",
    }),
  },
  {
    name: "Referral Partners",
    description: "Build and nurture referral partnerships",
    audience: "partners",
    directIntro: {
      subject: "A simple referral relationship",
      body: `Hi {{firstName}},\n\nReaching out because good referral relationships tend to make everyone look better.\n\nWe take a relationship-first approach in {{city}} — easy introductions, reliable follow-through, and business sent back your way.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Reciprocal referrals with {{companyName}}",
      body: `Hi {{firstName}},\n\nWe believe referrals should go both ways.\n\nThe idea is simple: we keep introductions easy and send trusted business back to you, and we both grow from the relationship.\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "partners",
      hook: "We'd love to build a simple, reciprocal referral relationship.",
      value: "we keep introductions easy and take a relationship-first approach.",
      partnership: "Reciprocal referrals mean we both send trusted business each other's way.",
      seasonal: "Heading into a busier stretch, it's a good time to have referral partners lined up.",
    }),
  },
  {
    name: "Local Brand Partners",
    description: "Co-marketing with local brands and businesses",
    audience: "local partners",
    directIntro: {
      subject: "A neighborhood partnership idea",
      body: `Hi {{firstName}},\n\nQuick note — neighborhood partnerships tend to create real value on both sides.\n\nWe're connecting with local brands in {{city}} on cross-promotion and co-marketing that adds value for each other's customers.\n\nWorth a quick conversation? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Co-marketing with {{companyName}}",
      body: `Hi {{firstName}},\n\nCross-promotion with local brands tends to be a win for everyone involved.\n\nThe idea is simple: we co-market and add value for each other's customers — a low-lift neighborhood partnership.\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "local partners",
      hook: "We're exploring neighborhood partnerships with local brands like {{companyName}}.",
      value: "we look for cross-promotion and co-marketing that adds real resident value.",
      partnership: "A neighborhood partnership lets us add value for each other's customers.",
      seasonal: "Seasonal promotions are a natural moment for a local co-marketing tie-in.",
    }),
  },
  {
    name: "Reactivation",
    description: "Re-engage past leads and partners",
    audience: "teams",
    directIntro: {
      subject: "Checking back in",
      body: `Hi {{firstName}},\n\nWe connected a while back and I wanted to reopen the conversation.\n\nTiming may be better now than when we last spoke — and we'd be glad to pick the relationship back up wherever it's useful for {{companyName}}.\n\nWorth reconnecting? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Has the timing changed?",
      body: `Hi {{firstName}},\n\nJust circling back to see if priorities have shifted since we last spoke.\n\nIf smoother moves for your clients would help this season, I'd love to restart the conversation — no pressure either way.\n\n{{calendarLink}}\n\n{{senderName}}`,
    },
    steps: moveMiSteps({
      audience: "teams",
      hook: "Just checking back in to see if the timing is better now.",
      value: "we're glad to restart the relationship whenever it's useful.",
      partnership: "If priorities have shifted, we'd love to restart the conversation.",
      seasonal: "With the season changing, it felt like a good time to reconnect.",
    }),
  },
];

// ===========================================================================
// STRATALOGIC
// Tone: credible, clear, concise, modern healthcare / B2B. Not overhyped.
// Tokens: {{firstName}} {{companyName}} {{senderName}} {{senderTitle}} {{calendarLink}} {{customNote}}
// Follow-up arc: light follow-up, value & use-case reminder, operational clarity /
// workflow angle, soft check-in, pilot / reactivation angle, reactivation w/
// updated relevance, annual reconnect.
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
    `Hi {{firstName}},\n\nBringing this back to the top of your inbox. We help ${audience} with ${useCase}.\n\nNo urgency — happy to share more whenever it's useful.\n\n{{senderName}}\n{{senderTitle}}`,
    // 2 — value & use-case reminder (7 days)
    `Hi {{firstName}},\n\nA bit more context on the use case for {{companyName}}: ${workflow}.\n\nIf it's relevant, I can share a short example.\n\n{{senderName}}`,
    // 3 — operational clarity / workflow angle (14 days)
    `Hi {{firstName}},\n\nWhere most ${audience} feel this is in day-to-day operations: ${useCase} without adding complexity.\n\nWorth a quick look at how that works? {{calendarLink}}\n\n{{senderName}}`,
    // 4 — soft check-in (1 month)
    `Hi {{firstName}},\n\nNo pressure — just checking whether cleaner workflow support is on your radar this quarter.\n\nGlad to keep it brief.\n\n{{senderName}}`,
    // 5 — pilot / reactivation angle (3 months)
    `Hi {{firstName}},\n\nIf evaluating fit is the hard part, ${pilot} is usually the easiest next step — low commitment, practical path.\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}`,
    // 6 — reactivation w/ updated relevance (6 months)
    `Hi {{firstName}},\n\nReopening this with fresh context — we've continued refining how we support ${audience}, and ${workflow}.\n\nIf priorities have shifted, it may be worth another look.\n\n{{senderName}}`,
    // 7 — annual reconnect (1 year)
    `Hi {{firstName}},\n\nIt's been about a year — reconnecting to see how things have evolved at {{companyName}}. If structured workflow support is on the roadmap, I'd welcome the chance to reconnect.\n\n{{calendarLink}}\n\n{{senderName}}`,
  ];
}

const STRATALOGIC_CATEGORIES: SeedCategory[] = [
  {
    name: "Functional Medicine Clinics",
    description: "Outreach to functional medicine practices",
    audience: "functional medicine clinics",
    directIntro: {
      subject: "Cleaner protocol workflows",
      body: `Hi {{firstName}},\n\nReaching out because supplement and protocol workflows tend to get heavy fast without structure.\n\nStrataLogic gives functional medicine clinics structured clinical decision support and cleaner protocol workflows — less operational friction for your providers.\n\n{{customNote}}\n\nOpen to a short look? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "A cleaner workflow for {{companyName}}",
      body: `Hi {{firstName}},\n\nFunctional medicine protocols are powerful, but operationally heavy.\n\nMost clinics we work with want cleaner supplement and protocol workflows without adding complexity. That's our focus: structured decision support with better operational visibility.\n\nHappy to walk through a quick example. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "functional medicine clinics",
      useCase: "cleaner supplement and protocol workflows",
      workflow: "structured clinical decision support with better operational visibility",
      pilot: "a short pilot to see how it fits your protocol workflow",
    }),
  },
  {
    name: "Longevity Clinics",
    description: "Outreach to longevity and healthspan clinics",
    audience: "longevity clinics",
    directIntro: {
      subject: "Scalable systems for complex protocols",
      body: `Hi {{firstName}},\n\nQuick note — complex longevity protocols are only as consistent as the systems behind them.\n\nStrataLogic supports longevity clinics with structured decision support and scalable systems that keep protocols consistent as you grow.\n\n{{customNote}}\n\nOpen to a short look? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Operational consistency for {{companyName}}",
      body: `Hi {{firstName}},\n\nModern longevity workflows are only as good as the systems behind them.\n\nMost clinics we work with want support for complex protocols and real operational consistency. That's our focus: scalable clinic systems that hold up as you scale.\n\nHappy to share a quick example. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "longevity clinics",
      useCase: "support for complex protocols and operational consistency",
      workflow: "scalable clinic systems that keep complex protocols consistent",
      pilot: "a pilot to test fit with your longevity protocols",
    }),
  },
  {
    name: "Wellness Clinics",
    description: "Outreach to wellness and integrative clinics",
    audience: "wellness clinics",
    directIntro: {
      subject: "Clearer practitioner workflows",
      body: `Hi {{firstName}},\n\nReaching out because practitioner workflows tend to get cluttered as a clinic grows.\n\nStrataLogic gives wellness clinics streamlined practitioner support and clearer workflows, with easy operational adoption.\n\n{{customNote}}\n\nOpen to a short look? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Smoother operations for {{companyName}}",
      body: `Hi {{firstName}},\n\nGrowth usually exposes the gaps in day-to-day workflow.\n\nMost wellness clinics we work with want streamlined practitioner support without a heavy rollout. That's our focus: improved workflow clarity with easy adoption.\n\nHappy to show a quick example. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "wellness clinics",
      useCase: "streamlined practitioner support and clearer workflows",
      workflow: "improved workflow clarity with easy operational adoption",
      pilot: "a low-friction pilot for your practitioner team",
    }),
  },
  {
    name: "Med Spas",
    description: "Outreach to med spas and aesthetic providers",
    audience: "med spas",
    directIntro: {
      subject: "Operational support for advanced offerings",
      body: `Hi {{firstName}},\n\nQuick note — more advanced wellness offerings tend to raise the bar on internal process.\n\nStrataLogic gives med spas operational support and clearer internal process, with scalable systems as you add services.\n\n{{customNote}}\n\nOpen to a short look? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Scalable systems for {{companyName}}",
      body: `Hi {{firstName}},\n\nMore advanced services raise the bar on operational support.\n\nMost med spas we work with want a clearer internal process without slowing the team down. That's our focus: operational support and scalable systems.\n\nHappy to walk through a quick example. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "med spas",
      useCase: "operational support for more advanced offerings",
      workflow: "clearer internal process and scalable systems",
      pilot: "a quick pilot to evaluate operational fit",
    }),
  },
  {
    name: "Provider Groups",
    description: "Outreach to multi-provider groups and networks",
    audience: "provider groups",
    directIntro: {
      subject: "Standardization across your providers",
      body: `Hi {{firstName}},\n\nReaching out because standardization across providers is hard to maintain at scale.\n\nStrataLogic helps provider groups with standardization, visibility, and operational coordination across team members.\n\n{{customNote}}\n\nOpen to a short look? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Consistency across {{companyName}}",
      body: `Hi {{firstName}},\n\nCoordinating multiple providers makes consistency the real challenge.\n\nMost groups we work with want standardization and visibility across the team without heavy overhead. That's our focus: operational coordination across providers.\n\nHappy to share a quick example. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "provider groups",
      useCase: "standardization and visibility across your team",
      workflow: "operational coordination and visibility across providers",
      pilot: "a pilot across a subset of your providers",
    }),
  },
  {
    name: "Pilot Partnerships",
    description: "Outreach to set up pilot programs",
    audience: "teams",
    directIntro: {
      subject: "A low-friction pilot",
      body: `Hi {{firstName}},\n\nQuick note — the easiest way to evaluate fit is usually a low-friction pilot.\n\nWith StrataLogic, that means a structured pilot with a practical implementation path: evaluate fit before committing to anything.\n\n{{customNote}}\n\nOpen to exploring it? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Evaluating fit at {{companyName}}",
      body: `Hi {{firstName}},\n\nNo need to commit before you've seen it work in your environment.\n\nMost teams start with a practical way to evaluate fit — a structured pilot with a clear implementation path. Low risk, real signal.\n\nHappy to outline what a pilot looks like. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "teams",
      useCase: "a practical way to evaluate fit",
      workflow: "a clear, low-friction implementation path",
      pilot: "a structured pilot with a practical implementation path",
    }),
  },
  {
    name: "Conference Follow-Up",
    description: "Follow-up after conferences and events",
    audience: "teams",
    directIntro: {
      subject: "Great to connect at the event",
      body: `Hi {{firstName}},\n\nGreat connecting at the event — wanted to continue the conversation we started.\n\nStrataLogic gives teams structured decision support and cleaner workflows, and I'd be glad to pick up where we left off with a short intro or demo.\n\n{{customNote}}\n\nOpen to it? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Continuing our conversation",
      body: `Hi {{firstName}},\n\nFollowing up on our conversation from the event.\n\nIf it's useful, a short demo is the easiest way to continue — I can tailor it to what {{companyName}} is working through right now.\n\nHappy to find a quick time. {{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "teams",
      useCase: "structured decision support and cleaner workflows",
      workflow: "a short intro or demo to pick up where we left off",
      pilot: "a brief demo to continue from the event",
    }),
  },
  {
    name: "Reactivation",
    description: "Re-engage dormant providers and prospects",
    audience: "teams",
    directIntro: {
      subject: "Revisiting the timing",
      body: `Hi {{firstName}},\n\nCircling back in case priorities have shifted since we last spoke.\n\nStrataLogic continues to help teams with structured decision support and cleaner workflows, and I'd be glad to re-open the conversation whenever it's relevant for {{companyName}}.\n\n{{customNote}}\n\nWorth reconnecting? {{calendarLink}}\n\n{{senderName}}\n{{senderTitle}}`,
    },
    valueIntro: {
      subject: "Has the timing changed?",
      body: `Hi {{firstName}},\n\nJust checking whether the timing is better now than when we last spoke.\n\nIf cleaner workflow support has moved up your list, a short pilot conversation is an easy next step — no pressure either way.\n\n{{calendarLink}}\n\n{{senderName}}`,
    },
    steps: strataSteps({
      audience: "teams",
      useCase: "structured decision support and cleaner workflows",
      workflow: "re-opening the conversation whenever it's relevant",
      pilot: "a pilot conversation if priorities have changed",
    }),
  },
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
