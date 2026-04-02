import { db, leadsTable, tasksTable, templatesTable, activityTable, assetsTable, templateSetsTable, sequenceTemplatesTable, campaignsTable, settingsTable, nextActionsTable, ctaLibraryTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const A3_GENERAL_TEMPLATES = [
  {
    stepNumber: 1,
    name: "Initial Email",
    delayDays: 0,
    subject: "Quick question on {{company}}",
    body: `{{greeting}}

{{intent_line}}

Curious how you are handling visual execution across print, fabrication, or on site experience.

We work with groups like Disney, NFL, and major venues on large scale installs, projection mapping, and branded environments.

{{company_line}}

Worth a quick conversation?`,
  },
  {
    stepNumber: 2,
    name: "Follow Up 1",
    delayDays: 3,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}

Wanted to circle back here.

Most teams we speak with are either:
1. Managing multiple vendors which creates inconsistency
2. Underutilizing visual environments for revenue or brand impact

If this is active on your end, there is usually an opportunity to improve both execution and ROI.

Open to sharing a few examples if helpful.`,
  },
  {
    stepNumber: 3,
    name: "Follow Up 2",
    delayDays: 7,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}

Quick example for context.

We recently supported projects involving large format installs and immersive visual builds for major brands and venues.

In most cases, the goal was:
1. Increase engagement
2. Improve navigation and wayfinding
3. Enhance overall experience

If this is something your team is exploring, timing it correctly makes a big difference.

Let me know if it makes sense to connect.`,
  },
  {
    stepNumber: 4,
    name: "Follow Up 3",
    delayDays: 14,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}

Not sure if this is currently a priority on your side.

If it is not, no problem. I can reconnect at a better time.

If it is, I can map out exactly what this could look like based on your current direction.

Let me know either way.`,
  },
  {
    stepNumber: 5,
    name: "Follow Up 4",
    delayDays: 30,
    subject: "Re: Quick question on {{company}}",
    body: `{{greeting}}

Going to assume this is not a priority right now.

If that changes, feel free to reach out and I will revisit with you.

Otherwise, I will reconnect down the line as things evolve on your end.`,
  },
  {
    stepNumber: 6,
    name: "Reactivation 1",
    delayDays: 120,
    subject: "Checking in - {{company}}",
    body: `{{greeting}}

Reaching back out as priorities shift throughout the year.

Are there any upcoming projects involving:
1. signage
2. fabrication
3. immersive environments
4. event installations

If so, I can align a few ideas around timing and execution.`,
  },
  {
    stepNumber: 7,
    name: "Reactivation 2",
    delayDays: 180,
    subject: "One more check - {{company}}",
    body: `{{greeting}}

Wanted to check in one more time.

If anything is coming up this quarter or next, I can be a resource on execution, vendors, and scaling visual impact.

If not, I will close this out on my end.`,
  },
];

function makeVariant(base: typeof A3_GENERAL_TEMPLATES, segmentLabel: string) {
  return base.map(t => ({
    ...t,
    name: `${segmentLabel} - ${t.name}`,
  }));
}

async function seed() {
  console.log("Seeding database...");

  await db.delete(activityTable);
  await db.delete(tasksTable);
  await db.delete(assetsTable);
  await db.delete(leadsTable);
  await db.delete(templatesTable);
  await db.delete(sequenceTemplatesTable);
  await db.delete(templateSetsTable);
  await db.delete(campaignsTable);

  const leads = await db.insert(leadsTable).values([
    {
      pipelineType: "Event",
      companyName: "Fontainebleau Miami Beach",
      contactName: "Roberto Diaz",
      title: "VP Events & Experiences",
      email: "roberto.diaz@fontainebleau.com",
      phone: "(305) 555-6789",
      linkedin: "linkedin.com/in/robertodiaz",
      location: "Miami, FL",
      industry: "Hospitality",
      venueProperty: "Fontainebleau Miami Beach",
      projectType: "Projection Mapping",
      estimatedBudget: "175000",
      status: "Closed Won",
      lastContactDate: "2026-03-10",
      nextStep: "Production kickoff",
      notes: "Won contract for NYE projection mapping on main tower facade. Production begins April. Strong relationship with events team.",
      dealValueEstimate: "175000",
      proposalValue: "172000",
      closeProbability: "100",
      forecastValue: "172000",
      source: "Referral",
    },
    {
      pipelineType: "Agency",
      companyName: "Momentum Worldwide",
      contactName: "Jake Torres",
      title: "VP of Production",
      email: "jake.torres@momentum.com",
      phone: "(212) 555-5678",
      linkedin: "linkedin.com/in/jaketorres",
      location: "Los Angeles, CA",
      industry: "Experiential Agency",
      projectType: "Brand Activation",
      estimatedBudget: "150000",
      status: "Proposal Sent",
      lastContactDate: "2026-03-12",
      nextStep: "Follow up on proposal",
      nextFollowUpDate: "2026-03-19",
      notes: "Sent proposal for Nike activation at Art Basel. Decision expected end of month.",
      dealValueEstimate: "150000",
      proposalValue: "142000",
      closeProbability: "75",
      forecastValue: "106500",
      source: "Referral",
    },
    {
      pipelineType: "Event",
      companyName: "The Ritz-Carlton South Beach",
      contactName: "Sarah Mitchell",
      title: "Director of Events",
      email: "sarah.mitchell@ritzcarlton.com",
      phone: "(305) 555-1234",
      linkedin: "linkedin.com/in/sarahmitchell",
      location: "Miami, FL",
      industry: "Hospitality",
      venueProperty: "The Ritz-Carlton South Beach",
      projectType: "Hotel Event",
      estimatedBudget: "85000",
      status: "Qualified",
      lastContactDate: "2026-03-15",
      nextStep: "Send capabilities deck and case studies",
      nextFollowUpDate: "2026-03-21",
      notes: "Interested in branded environment for annual luxury gala.",
      dealValueEstimate: "85000",
      closeProbability: "60",
      forecastValue: "51000",
      source: "LinkedIn",
    },
    {
      pipelineType: "Event",
      companyName: "Orlando World Center Marriott",
      contactName: "Lisa Park",
      title: "Director of Convention Services",
      email: "lisa.park@marriott.com",
      phone: "(407) 555-7890",
      location: "Orlando, FL",
      industry: "Hospitality",
      venueProperty: "Orlando World Center Marriott",
      projectType: "Conference",
      estimatedBudget: "220000",
      status: "Meeting Booked",
      lastContactDate: "2026-03-18",
      nextStep: "Virtual meeting Thursday 2pm EST",
      nextFollowUpDate: "2026-03-22",
      notes: "Massive convention center. Need large format printing and fabrication for annual medical conference.",
      dealValueEstimate: "220000",
      closeProbability: "45",
      forecastValue: "99000",
      source: "ZoomInfo",
    },
    {
      pipelineType: "Agency",
      companyName: "George P. Johnson (GPJ)",
      contactName: "Marcus Williams",
      title: "Senior Producer",
      email: "marcus.w@gpj.com",
      phone: "(310) 555-3456",
      location: "Los Angeles, CA",
      industry: "Event Agency",
      projectType: "Experiential Install",
      estimatedBudget: "320000",
      status: "Negotiation",
      lastContactDate: "2026-03-17",
      nextStep: "Review revised scope and pricing for 3-city tour",
      nextFollowUpDate: "2026-03-20",
      notes: "Multi-city activation for Toyota. Negotiating scope for LA, SF, Miami.",
      dealValueEstimate: "320000",
      proposalValue: "298000",
      closeProbability: "80",
      forecastValue: "238400",
      source: "Existing Relationship",
    },
    {
      pipelineType: "Event",
      companyName: "Moscone Center",
      contactName: "Amanda Chen",
      title: "Event Operations Manager",
      email: "amanda.chen@moscone.com",
      phone: "(415) 555-9012",
      location: "San Francisco, CA",
      industry: "Convention Center",
      venueProperty: "Moscone Center",
      projectType: "Large Format Printing",
      estimatedBudget: "95000",
      status: "Contacted",
      lastContactDate: "2026-03-16",
      nextStep: "Wait for response to intro email",
      nextFollowUpDate: "2026-03-18",
      notes: "Sent cold email. They handle 50+ major events/year.",
      dealValueEstimate: "95000",
      closeProbability: "25",
      forecastValue: "23750",
      source: "ZoomInfo",
    },
    {
      pipelineType: "Agency",
      companyName: "Sparks",
      contactName: "David Kim",
      title: "Creative Director",
      email: "dkim@sparks.com",
      phone: "(215) 555-2345",
      location: "Los Angeles, CA",
      industry: "Experiential Agency",
      projectType: "Fabrication",
      estimatedBudget: "130000",
      status: "Replied",
      lastContactDate: "2026-03-17",
      nextStep: "Schedule intro call",
      nextFollowUpDate: "2026-03-20",
      notes: "Replied to LinkedIn outreach. Interested in fabrication capabilities.",
      dealValueEstimate: "130000",
      closeProbability: "35",
      forecastValue: "45500",
      source: "LinkedIn",
    },
    {
      pipelineType: "Event",
      companyName: "Faena Hotel Miami Beach",
      contactName: "Valentina Ruiz",
      title: "Events & Programming Director",
      email: "valentina.r@faena.com",
      phone: "(305) 555-4567",
      location: "Miami, FL",
      industry: "Luxury Hospitality",
      venueProperty: "Faena Hotel Miami Beach",
      projectType: "Event Activation",
      estimatedBudget: "110000",
      status: "New Lead",
      nextStep: "Send intro email with portfolio",
      nextFollowUpDate: "2026-03-20",
      notes: "Ultra-luxury venue, Art Basel host. Found via ZoomInfo.",
      dealValueEstimate: "110000",
      closeProbability: "20",
      forecastValue: "22000",
      source: "ZoomInfo",
    },
    {
      pipelineType: "Agency",
      companyName: "MAS Event + Design",
      contactName: "Emily Ross",
      title: "Managing Partner",
      email: "emily@maseventdesign.com",
      phone: "(415) 555-0123",
      location: "San Francisco, CA",
      industry: "Boutique Event Agency",
      projectType: "Ongoing Partnership",
      estimatedBudget: "200000",
      status: "Meeting Completed",
      lastContactDate: "2026-03-18",
      nextStep: "Send partnership proposal",
      nextFollowUpDate: "2026-03-21",
      notes: "Great meeting! They need a reliable large format and fabrication partner.",
      dealValueEstimate: "200000",
      closeProbability: "55",
      forecastValue: "110000",
      source: "Website",
    },
    {
      pipelineType: "Event",
      companyName: "JW Marriott LA Live",
      contactName: "Michael Chen",
      title: "Events Coordinator",
      email: "michael.chen@marriott.com",
      phone: "(213) 555-8901",
      location: "Los Angeles, CA",
      industry: "Hospitality",
      venueProperty: "JW Marriott LA Live",
      projectType: "Event Activation",
      estimatedBudget: "65000",
      status: "Closed Lost",
      lastContactDate: "2026-03-05",
      notes: "Lost to competitor on pricing. Keep in nurture.",
      dealValueEstimate: "65000",
      closeProbability: "0",
      forecastValue: "0",
      source: "Cold Call",
    },
    {
      pipelineType: "Event",
      companyName: "Gaylord Palms Resort",
      contactName: "Jennifer Walsh",
      title: "Sr Director of Events",
      email: "jennifer.walsh@gaylordhotels.com",
      phone: "(407) 555-3333",
      location: "Orlando, FL",
      industry: "Hospitality",
      venueProperty: "Gaylord Palms Resort & Convention Center",
      projectType: "Experiential Install",
      estimatedBudget: "180000",
      status: "Proposal Sent",
      lastContactDate: "2026-03-14",
      nextStep: "Follow up on proposal for ICE! holiday experience",
      nextFollowUpDate: "2026-03-19",
      notes: "Sent proposal for annual ICE! holiday experience fabrication.",
      dealValueEstimate: "180000",
      proposalValue: "168000",
      closeProbability: "65",
      forecastValue: "109200",
      source: "Referral",
    },
    {
      pipelineType: "Agency",
      companyName: "NVE Experience Agency",
      contactName: "Priya Patel",
      title: "Director of Production",
      email: "priya@nveexperience.com",
      phone: "(310) 555-7777",
      location: "Los Angeles, CA",
      industry: "Experiential Agency",
      projectType: "Brand Activation",
      estimatedBudget: "250000",
      status: "Qualified",
      lastContactDate: "2026-03-16",
      nextStep: "Present case studies and capabilities",
      nextFollowUpDate: "2026-03-21",
      notes: "Top LA experiential agency. Huge potential for ongoing partnership.",
      dealValueEstimate: "250000",
      closeProbability: "40",
      forecastValue: "100000",
      source: "LinkedIn",
    },
  ]).returning();

  console.log(`Seeded ${leads.length} leads`);

  const tasks = await db.insert(tasksTable).values([
    { leadId: leads[2].id, taskType: "Send Deck", dueDate: "2026-03-21", status: "pending", notes: "Send capabilities deck and hotel case studies to Sarah at Ritz-Carlton" },
    { leadId: leads[1].id, taskType: "Follow-up", dueDate: "2026-03-19", status: "pending", notes: "Follow up on Nike activation proposal with Jake" },
    { leadId: leads[3].id, taskType: "Meeting Prep", dueDate: "2026-03-22", status: "pending", notes: "Prepare presentation for Orlando Marriott virtual meeting" },
    { leadId: leads[4].id, taskType: "Proposal", dueDate: "2026-03-20", status: "pending", notes: "Review revised scope for Toyota multi-city activation" },
    { leadId: leads[7].id, taskType: "Follow-up", dueDate: "2026-03-20", status: "pending", notes: "Send intro email with portfolio to Faena Hotel" },
    { leadId: leads[5].id, taskType: "Check-In", dueDate: "2026-03-18", status: "pending", notes: "Check if Amanda at Moscone received our intro email" },
    { leadId: leads[0].id, taskType: "Call", dueDate: "2026-03-25", status: "pending", notes: "Production kickoff call with Roberto at Fontainebleau" },
    { leadId: leads[6].id, taskType: "Call", dueDate: "2026-03-20", status: "pending", notes: "Schedule intro call with David at Sparks" },
    { leadId: leads[8].id, taskType: "Proposal", dueDate: "2026-03-21", status: "pending", notes: "Send partnership proposal to Emily at MAS Event" },
    { leadId: leads[10].id, taskType: "Follow-up", dueDate: "2026-03-19", status: "pending", notes: "Follow up on ICE! experience proposal with Jennifer" },
    { leadId: leads[11].id, taskType: "Send Deck", dueDate: "2026-03-21", status: "pending", notes: "Present case studies to Priya at NVE Experience" },
    { leadId: leads[0].id, taskType: "Post-Meeting Follow-Up", dueDate: "2026-03-15", status: "completed", notes: "Sent thank you and next steps after contract signing" },
  ]).returning();

  console.log(`Seeded ${tasks.length} tasks`);

  const seededAssets = await db.insert(assetsTable).values([
    { title: "A3 Visual Capabilities Deck 2026", category: "Capabilities Deck", description: "Full capabilities overview including fabrication, large format, projection mapping, and immersive environments.", url: "https://example.com/a3-capabilities-2026.pdf" },
    { title: "Hotel & Venue Portfolio", category: "Case Study", description: "Case studies from Fontainebleau, Ritz-Carlton, W Hotels, and other luxury properties.", url: "https://example.com/hotel-portfolio.pdf" },
    { title: "Brand Activation Lookbook", category: "Brochure", description: "Visual showcase of recent brand activations for Nike, Toyota, Red Bull.", url: "https://example.com/activation-lookbook.pdf" },
    { title: "Projection Mapping Reel", category: "Photos / Completed Work", description: "Video reel of projection mapping installations on hotels and event venues.", url: "https://example.com/projection-reel.mp4" },
    { title: "A3 Visual Brand Guidelines", category: "Brand Assets", description: "Logo files, color palette, font guidelines, and brand usage rules.", url: "https://example.com/brand-guidelines.pdf" },
    { title: "Standard Proposal Template", category: "Proposal Example", description: "Editable proposal template with pricing structure and scope framework.", url: "https://example.com/proposal-template.docx" },
  ]).returning();

  console.log("Seeded 6 assets");

  const capsDeckId = seededAssets.find(a => a.category === "Capabilities Deck")?.id;

  await db.insert(templatesTable).values([
    {
      name: "Cold Email Intro",
      category: "Cold Email",
      subject: "Quick Question",
      body: `Hi [First Name],\n\nQuick question, who handles event production, printing, or visual installations for [Company Name]?\n\nI work with A3 Visual, and we support hotels, venues, and agencies with large format, fabrication, and immersive builds.\n\nIf that's you, happy to connect. If not, would you mind pointing me in the right direction?\n\nThanks so much,\nAlyssa`,
    },
    {
      name: "Follow-Up",
      category: "Follow-Up Email",
      subject: "Following Up",
      body: `Hi [First Name],\n\nJust wanted to follow up here. Would love to connect briefly and see what you have coming up this season.\n\nWe've been supporting a number of venues and agencies with fast-turn, high-impact installs.\n\nOpen to a quick intro next week?\n\nBest,\nAlyssa`,
    },
    {
      name: "Value Follow-Up",
      category: "Follow-Up Email",
      subject: "Quick Share",
      body: `Hi [First Name],\n\nWe recently helped a [venue / agency] elevate their event experience with custom fabrication + large format installs. Happy to share examples if helpful.\n\nWould it be worth a quick conversation?\n\nBest,\nAlyssa`,
    },
    {
      name: "Soft Close",
      category: "Follow-Up Email",
      subject: "Keeping The Door Open",
      body: `Hi [First Name],\n\nTotally understand if timing isn't right. Just wanted to keep the door open.\n\nIf anything comes up where you need support on printing, fabrication, or immersive installs, I'd love to be a resource.\n\nBest,\nAlyssa`,
    },
    {
      name: "LinkedIn Connect",
      category: "LinkedIn Message",
      body: `Hi [Name], would love to connect. Working with venues and agencies on event production + visual environments.`,
    },
    {
      name: "LinkedIn Follow-Up",
      category: "LinkedIn Message",
      body: `Thanks for connecting!\n\nCurious, do you currently handle event production and installs internally, or work with external partners?`,
    },
    {
      name: "Initial Outreach + A3 Deck",
      category: "Cold Email",
      subject: "Quick Question",
      body: `Hi [First Name],\n\nQuick question, who handles event production, printing, visual installations, or experiential builds for [Company Name]?\n\nI've included our A3 capabilities deck here for a quick overview:\n[A3_CAPABILITIES_DECK_LINK]\n\nIf that's you, I'd love to connect briefly.\n\nThanks so much,\nAlyssa`,
      linkedAssetIds: capsDeckId ? String(capsDeckId) : undefined,
    },
  ]).returning();

  console.log("Seeded 7 templates");

  const segmentSets: { name: string; segmentType: string; description: string }[] = [
    { name: "A3 General Sequence", segmentType: "general", description: "Standard 7-step outbound sequence for general contacts" },
    { name: "A3 Hotels Sequence", segmentType: "hotel", description: "7-step outbound sequence for hotel and hospitality contacts" },
    { name: "A3 Agencies Sequence", segmentType: "agency", description: "7-step outbound sequence for agency contacts" },
    { name: "A3 Developers Sequence", segmentType: "developer", description: "7-step outbound sequence for developer contacts" },
    { name: "A3 Venues Sequence", segmentType: "venue", description: "7-step outbound sequence for venue contacts" },
  ];

  for (const setDef of segmentSets) {
    const [set] = await db.insert(templateSetsTable).values({
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

    console.log(`Seeded template set: ${setDef.name} with ${templates.length} templates`);
  }

  const [campaign] = await db.insert(campaignsTable).values({
    name: "Q2 2026 General Outbound",
    description: "Main outbound campaign for Q2 2026",
    isActive: true,
  }).returning();
  console.log(`Seeded campaign: ${campaign.name}`);

  await db.insert(settingsTable).values([
    { key: "daily_send_cap", value: "50" },
    { key: "per_inbox_send_cap", value: "50" },
    { key: "send_window_start", value: "8" },
    { key: "send_window_end", value: "18" },
    { key: "business_days_only", value: "true" },
    { key: "randomized_spacing", value: "true" },
    { key: "reply_detection_interval", value: "30" },
    { key: "tracking_domain", value: "" },
  ]).onConflictDoNothing();
  console.log("Seeded settings");

  await db.insert(activityTable).values([
    { type: "lead_created", description: "New lead created: Fontainebleau Miami Beach", leadId: leads[0].id },
    { type: "status_changed", description: "Fontainebleau Miami Beach status changed to Closed Won", leadId: leads[0].id },
    { type: "lead_created", description: "New lead created: Momentum Worldwide", leadId: leads[1].id },
    { type: "status_changed", description: "Momentum Worldwide status changed to Proposal Sent", leadId: leads[1].id },
    { type: "task_completed", description: "Task 'Post-Meeting Follow-Up' completed for Fontainebleau Miami Beach", leadId: leads[0].id },
    { type: "lead_created", description: "New lead created: NVE Experience Agency", leadId: leads[11].id },
    { type: "lead_created", description: "New lead created: MAS Event + Design", leadId: leads[8].id },
    { type: "status_changed", description: "MAS Event + Design status changed to Meeting Completed", leadId: leads[8].id },
    { type: "lead_created", description: "New lead created: Gaylord Palms Resort", leadId: leads[10].id },
    { type: "status_changed", description: "Gaylord Palms Resort status changed to Proposal Sent", leadId: leads[10].id },
  ]);

  console.log("Seeded activity feed");

  await db.insert(nextActionsTable).values([
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
  ]).onConflictDoNothing();
  console.log("Seeded next actions");

  await db.insert(ctaLibraryTable).values([
    { name: "Quick Conversation", description: "Low-pressure meeting ask", text: "Worth a quick conversation to see if there is a fit?", recommendedForTier: "warm", isActive: true },
    { name: "Share Examples", description: "Offer to share relevant work samples", text: "If helpful, I can send over a few relevant examples based on the type of work your team may be evaluating.", recommendedForTier: "warm", isActive: true },
    { name: "Capabilities Overview", description: "Offer to send capabilities deck", text: "Happy to share a quick capabilities overview if that would be useful.", recommendedForTier: "warm", isActive: true },
    { name: "Project Timing", description: "Check on upcoming project timing", text: "If timing is relevant, we could also set up a short conversation and see whether there is a fit.", recommendedForTier: "warm", isActive: true },
    { name: "Execution Options", description: "Discuss execution possibilities", text: "Would it make sense to walk through some execution options that might be relevant to your team?", recommendedForTier: "hot", isActive: true },
    { name: "Schedule Call", description: "Direct meeting request", text: "Would a 15-minute call make sense this week or next to explore whether there is a fit?", recommendedForTier: "hot", isActive: true },
  ]).onConflictDoNothing();
  console.log("Seeded CTA library");

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
