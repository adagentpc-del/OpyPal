import { db, leadsTable, tasksTable, templatesTable, activityTable, assetsTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  await db.delete(activityTable);
  await db.delete(tasksTable);
  await db.delete(assetsTable);
  await db.delete(leadsTable);
  await db.delete(templatesTable);

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
      notes: "Sent proposal for Nike activation at Art Basel. Decision expected end of month. They love our fabrication quality.",
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
      notes: "Interested in branded environment for annual luxury gala. Budget approved for Q2. Wants to see our hotel portfolio.",
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
      notes: "Massive convention center. Need large format printing and fabrication for annual medical conference. 4-day event, 3000 attendees.",
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
      notes: "Multi-city activation for Toyota. Negotiating scope for LA, SF, Miami. They want immersive environments with projection mapping.",
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
      notes: "Sent cold email. They handle 50+ major events/year. Huge opportunity for ongoing large format partnership.",
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
      nextStep: "Schedule intro call - they're interested",
      nextFollowUpDate: "2026-03-20",
      notes: "Replied to LinkedIn outreach. Interested in our fabrication capabilities for auto show season. High volume potential.",
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
      notes: "Ultra-luxury venue, Art Basel host. Found via ZoomInfo. Perfect fit for our immersive branded environments.",
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
      notes: "Great meeting! They need a reliable large format and fabrication partner for their SF tech client events. 8-10 events/year.",
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
      notes: "Lost to competitor on pricing. They went with a local LA shop. Keep in nurture - their contract renews in 6 months.",
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
      notes: "Sent proposal for annual ICE! holiday experience fabrication. They need massive themed environments. Decision by April 1.",
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
      notes: "Top LA experiential agency. They handle Red Bull, Netflix, major tech launches. Huge potential for ongoing partnership.",
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

  await db.insert(templatesTable).values([
    {
      name: "Cold Email Intro",
      category: "Cold Email",
      subject: "quick question",
      body: `Hi [First Name],

Quick question—who handles event production, printing, or visual installations for [Company Name]?

I work with A3 Visual, and we support hotels, venues, and agencies with large format, fabrication, and immersive builds (projection mapping, branded environments, etc.).

If that's you, happy to connect—if not, would you mind pointing me in the right direction?

Thanks so much,
Alyssa`,
    },
    {
      name: "Follow-Up",
      category: "Follow-Up Email",
      subject: "Following up",
      body: `Hi [First Name],

Just wanted to follow up here—would love to connect briefly and see what you have coming up this season.

We've been supporting a number of venues and agencies with fast-turn, high-impact installs, especially for events and activations.

Open to a quick intro next week?

Best,
Alyssa`,
    },
    {
      name: "Value Follow-Up",
      category: "Follow-Up Email",
      subject: "Quick share",
      body: `Hi [First Name],

We recently helped a [venue / agency] elevate their event experience with custom fabrication + large format installs—happy to share examples if helpful.

Would it be worth a quick conversation?

Best,
Alyssa`,
    },
    {
      name: "Soft Close",
      category: "Follow-Up Email",
      subject: "Keeping the door open",
      body: `Hi [First Name],

Totally understand if timing isn't right—just wanted to keep the door open.

If anything comes up where you need support on printing, fabrication, or immersive installs, I'd love to be a resource.

Best,
Alyssa`,
    },
    {
      name: "LinkedIn Connect",
      category: "LinkedIn Message",
      body: `Hi [Name], would love to connect—working with venues and agencies on event production + visual environments.`,
    },
    {
      name: "LinkedIn Follow-Up",
      category: "LinkedIn Message",
      body: `Thanks for connecting!

Curious—do you currently handle event production and installs internally, or work with external partners?`,
    },
  ]).returning();

  console.log("Seeded 6 templates");

  await db.insert(assetsTable).values([
    { title: "A3 Visual Capabilities Deck 2026", category: "Capabilities Deck", description: "Full capabilities overview including fabrication, large format, projection mapping, and immersive environments.", url: "https://example.com/a3-capabilities-2026.pdf" },
    { title: "Hotel & Venue Portfolio", category: "Case Study", description: "Case studies from Fontainebleau, Ritz-Carlton, W Hotels, and other luxury properties.", url: "https://example.com/hotel-portfolio.pdf" },
    { title: "Brand Activation Lookbook", category: "Brochure", description: "Visual showcase of recent brand activations for Nike, Toyota, Red Bull.", url: "https://example.com/activation-lookbook.pdf" },
    { title: "Projection Mapping Reel", category: "Photos / Completed Work", description: "Video reel of projection mapping installations on hotels and event venues.", url: "https://example.com/projection-reel.mp4" },
    { title: "A3 Visual Brand Guidelines", category: "Brand Assets", description: "Logo files, color palette, font guidelines, and brand usage rules.", url: "https://example.com/brand-guidelines.pdf" },
    { title: "Standard Proposal Template", category: "Proposal Example", description: "Editable proposal template with pricing structure and scope framework.", url: "https://example.com/proposal-template.docx" },
  ]).returning();

  console.log("Seeded 6 assets");

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
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
