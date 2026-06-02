import { db, templatesTable, templateSetsTable, sequenceTemplatesTable, settingsTable, nextActionsTable, ctaLibraryTable } from "@workspace/db";
import { logger } from "./logger";

const A3_GENERAL_TEMPLATES = [
  {
    stepNumber: 1,
    name: "Initial Email",
    delayDays: 0,
    subject: "Quick question on {{company}}",
    body: `{{greeting}}\n\n{{intent_line}}\n\nCurious how you are handling visual execution across print, fabrication, or on site experience.\n\nWe work with groups like Disney, NFL, and major venues on large scale installs, projection mapping, and branded environments.\n\n{{company_line}}\n\nWorth a quick conversation?`,
  },
  {
    stepNumber: 2,
    name: "Follow Up 1",
    delayDays: 3,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}\n\nWanted to circle back here.\n\nMost teams we speak with are either:\n1. Managing multiple vendors which creates inconsistency\n2. Underutilizing visual environments for revenue or brand impact\n\nIf this is active on your end, there is usually an opportunity to improve both execution and ROI.\n\nOpen to sharing a few examples if helpful.`,
  },
  {
    stepNumber: 3,
    name: "Follow Up 2",
    delayDays: 7,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}\n\nQuick example for context.\n\nWe recently supported projects involving large format installs and immersive visual builds for major brands and venues.\n\nIn most cases, the goal was to elevate guest experience while keeping production tightly managed.\n\nWould a brief intro be useful to share examples?`,
  },
  {
    stepNumber: 4,
    name: "Follow Up 3",
    delayDays: 14,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}\n\nNot sure if this is on your radar right now, so I'll keep this brief.\n\nIf visual production, fabrication, or experiential builds are something your team is actively planning, happy to share what we've built for similar groups.\n\nLet me know if it makes sense to connect.`,
  },
  {
    stepNumber: 5,
    name: "Follow Up 4",
    delayDays: 30,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}\n\nChecking in one more time before I close this out.\n\nIf there is anything coming up where visual production support would be useful, we'd love to be considered.\n\nOtherwise, no worries — happy to circle back later in the year.`,
  },
  {
    stepNumber: 6,
    name: "Reactivation 1",
    delayDays: 120,
    subject: "Reconnecting on {{company}}",
    body: `{{greeting}}\n\nIt's been a few months — wanted to reconnect briefly.\n\nWe've been busy with new projects across hospitality, agencies, and venues. If anything is shaping up on your side, we'd love to be considered.\n\nWorth a quick check-in?`,
  },
  {
    stepNumber: 7,
    name: "Reactivation 2",
    delayDays: 180,
    subject: "Quick check-in — {{company}}",
    body: `{{greeting}}\n\nFinal check-in for now.\n\nIf there's an upcoming event, install, or experiential project where we could help, just say the word.\n\nOtherwise, no worries — keeping the door open whenever timing is right.`,
  },
];

function makeVariant(base: typeof A3_GENERAL_TEMPLATES, segmentLabel: string) {
  return base.map(t => ({ ...t, name: `${segmentLabel} - ${t.name}` }));
}

const SEGMENT_SETS = [
  { name: "A3 General Sequence", segmentType: "general", description: "Standard 7-step outbound sequence for general contacts" },
  { name: "A3 Hotels Sequence", segmentType: "hotel", description: "7-step outbound sequence for hotel and hospitality contacts" },
  { name: "A3 Agencies Sequence", segmentType: "agency", description: "7-step outbound sequence for agency contacts" },
  { name: "A3 Developers Sequence", segmentType: "developer", description: "7-step outbound sequence for developer contacts" },
  { name: "A3 Venues Sequence", segmentType: "venue", description: "7-step outbound sequence for venue contacts" },
];

const STANDALONE_TEMPLATES = [
  { name: "Cold Email Intro", category: "Cold Email", type: "intro", subject: "Quick Question", body: `Hi [First Name],\n\nQuick question, who handles event production, printing, or visual installations for [Company Name]?\n\nI work with A3 Visual, and we support hotels, venues, and agencies with large format, fabrication, and immersive builds.\n\nIf that's you, happy to connect. If not, would you mind pointing me in the right direction?\n\nThanks so much,\nAlyssa` },
  { name: "Follow-Up", category: "Follow-Up Email", type: "follow_up", subject: "Following Up", body: `Hi [First Name],\n\nJust wanted to follow up here. Would love to connect briefly and see what you have coming up this season.\n\nWe've been supporting a number of venues and agencies with fast-turn, high-impact installs.\n\nOpen to a quick intro next week?\n\nBest,\nAlyssa` },
  { name: "Value Follow-Up", category: "Follow-Up Email", type: "follow_up", subject: "Quick Share", body: `Hi [First Name],\n\nWe recently helped a [venue / agency] elevate their event experience with custom fabrication + large format installs. Happy to share examples if helpful.\n\nWould it be worth a quick conversation?\n\nBest,\nAlyssa` },
  { name: "Soft Close", category: "Follow-Up Email", type: "follow_up", subject: "Keeping The Door Open", body: `Hi [First Name],\n\nTotally understand if timing isn't right. Just wanted to keep the door open.\n\nIf anything comes up where you need support on printing, fabrication, or immersive installs, I'd love to be a resource.\n\nBest,\nAlyssa` },
  { name: "LinkedIn Connect", category: "LinkedIn Message", type: "custom", subject: null, body: `Hi [Name], would love to connect. Working with venues and agencies on event production + visual environments.` },
  { name: "LinkedIn Follow-Up", category: "LinkedIn Message", type: "custom", subject: null, body: `Thanks for connecting!\n\nCurious, do you currently handle event production and installs internally, or work with external partners?` },
  { name: "Initial Outreach + A3 Deck", category: "Cold Email", type: "intro", subject: "Quick Question", body: `Hi [First Name],\n\nQuick question, who handles event production, printing, visual installations, or experiential builds for [Company Name]?\n\nI've included our A3 capabilities deck here for a quick overview:\n[A3_CAPABILITIES_DECK_LINK]\n\nIf that's you, I'd love to connect briefly.\n\nThanks so much,\nAlyssa` },
];

const DEFAULT_SETTINGS = [
  { key: "daily_send_cap", value: "50" },
  { key: "per_inbox_send_cap", value: "50" },
  { key: "send_window_start", value: "8" },
  { key: "send_window_end", value: "18" },
  { key: "business_days_only", value: "true" },
  { key: "weekday_sending_only", value: "true" },
  { key: "primary_send_provider", value: "resend" },
  { key: "randomized_spacing", value: "true" },
  { key: "reply_detection_interval", value: "30" },
  { key: "tracking_domain", value: "" },
];

const DEFAULT_NEXT_ACTIONS = [
  { name: "continue_sequence", description: "Continue with the current automated sequence", recommendedForTier: "cold", isActive: true },
  { name: "reactivation_later", description: "Move to reactivation pool for long-term follow-up", recommendedForTier: "cold", isActive: true },
  { name: "send_capabilities_overview", description: "Send a capabilities overview deck", recommendedForTier: "warm", isActive: true },
  { name: "send_case_study", description: "Send a relevant case study based on segment", recommendedForTier: "warm", isActive: true },
  { name: "manual_review", description: "Flag for manual review by sales team", recommendedForTier: "warm", isActive: true },
  { name: "manual_followup", description: "Direct manual follow-up recommended", recommendedForTier: "hot", isActive: true },
  { name: "book_call", description: "Request a meeting or phone call", recommendedForTier: "hot", isActive: true },
  { name: "mark_qualified", description: "Mark as qualified opportunity candidate", recommendedForTier: "hot", isActive: true },
  { name: "move_to_pipeline", description: "Move contact to the sales pipeline as an opportunity", recommendedForTier: "hot", isActive: true },
  { name: "archive", description: "Archive contact — no further outreach needed", isActive: true },
];

const DEFAULT_CTAS = [
  { name: "Quick Conversation", description: "Low-pressure meeting ask", text: "Worth a quick conversation to see if there is a fit?", recommendedForTier: "warm", isActive: true },
  { name: "Share Examples", description: "Offer to share relevant work samples", text: "If helpful, I can send over a few relevant examples based on the type of work your team may be evaluating.", recommendedForTier: "warm", isActive: true },
  { name: "Capabilities Overview", description: "Offer to send capabilities deck", text: "Happy to share a quick capabilities overview if that would be useful.", recommendedForTier: "warm", isActive: true },
  { name: "Project Timing", description: "Check on upcoming project timing", text: "If timing is relevant, we could also set up a short conversation and see whether there is a fit.", recommendedForTier: "warm", isActive: true },
  { name: "Execution Options", description: "Discuss execution possibilities", text: "Would it make sense to walk through some execution options that might be relevant to your team?", recommendedForTier: "hot", isActive: true },
  { name: "Schedule Call", description: "Direct meeting request", text: "Would a 15-minute call make sense this week or next to explore whether there is a fit?", recommendedForTier: "hot", isActive: true },
];

export async function seedTemplatesIfEmpty(): Promise<{ templates: number; sets: number; steps: number }> {
  const result = { templates: 0, sets: 0, steps: 0 };

  const existingTemplates = await db.select({ id: templatesTable.id }).from(templatesTable).limit(1);
  if (existingTemplates.length === 0) {
    for (const t of STANDALONE_TEMPLATES) {
      await db.insert(templatesTable).values({
        workspaceId: 1,
        name: t.name,
        category: t.category,
        type: t.type,
        subject: t.subject || undefined,
        body: t.body,
        isActive: true,
      });
      result.templates++;
    }
    logger.info({ count: result.templates }, "Seeded standalone email templates");
  }

  const existingSets = await db.select({ id: templateSetsTable.id }).from(templateSetsTable).limit(1);
  if (existingSets.length === 0) {
    for (const setDef of SEGMENT_SETS) {
      const [set] = await db.insert(templateSetsTable).values({
        workspaceId: 1,
        name: setDef.name,
        segmentType: setDef.segmentType,
        description: setDef.description,
        isActive: true,
      }).returning();

      const templates = setDef.segmentType === "general"
        ? A3_GENERAL_TEMPLATES
        : makeVariant(A3_GENERAL_TEMPLATES, setDef.name.replace("A3 ", "").replace(" Sequence", ""));

      await db.insert(sequenceTemplatesTable).values(
        templates.map(t => ({
          templateSetId: set.id,
          stepNumber: t.stepNumber,
          name: t.name,
          subject: t.subject,
          body: t.body,
          delayDays: t.delayDays,
          isActive: true,
        }))
      );

      result.sets++;
      result.steps += templates.length;
    }
    logger.info({ sets: result.sets, steps: result.steps }, "Seeded sequence template sets");
  }

  await db.insert(settingsTable).values(DEFAULT_SETTINGS.map(s => ({ ...s, workspaceId: 1 }))).onConflictDoNothing();
  await db.insert(nextActionsTable).values(DEFAULT_NEXT_ACTIONS.map(a => ({ ...a, workspaceId: 1 }))).onConflictDoNothing();
  await db.insert(ctaLibraryTable).values(DEFAULT_CTAS.map(c => ({ ...c, workspaceId: 1 }))).onConflictDoNothing();

  return result;
}
