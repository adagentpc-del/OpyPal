import { db, leadsTable, tasksTable, templatesTable, activityTable } from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  await db.delete(activityTable);
  await db.delete(tasksTable);
  await db.delete(leadsTable);
  await db.delete(templatesTable);

  const leads = await db.insert(leadsTable).values([
    {
      pipelineType: "Event",
      companyName: "The Ritz-Carlton Orlando",
      contactName: "Sarah Mitchell",
      title: "Director of Events",
      email: "sarah.mitchell@ritzcarlton.com",
      phone: "(407) 555-1234",
      linkedin: "linkedin.com/in/sarahmitchell",
      location: "Orlando, FL",
      industry: "Hospitality",
      venueProperty: "The Ritz-Carlton Orlando",
      projectType: "Hotel Event",
      estimatedBudget: "75000",
      status: "Qualified",
      lastContactDate: "2026-03-15",
      nextStep: "Send capabilities deck",
      nextFollowUpDate: "2026-03-20",
      notes: "Interested in projection mapping for annual gala. Budget approved for Q2.",
      dealValueEstimate: "75000",
      proposalValue: null,
      closeProbability: "60",
      forecastValue: "45000",
      source: "LinkedIn",
    },
    {
      pipelineType: "Agency",
      companyName: "Momentum Worldwide",
      contactName: "Jake Torres",
      title: "VP of Production",
      email: "jake.torres@momentum.com",
      phone: "(212) 555-5678",
      linkedin: "linkedin.com/in/jaketorres",
      location: "New York, NY",
      industry: "Experiential Agency",
      venueProperty: null,
      projectType: "Brand Activation",
      estimatedBudget: "150000",
      status: "Proposal Sent",
      lastContactDate: "2026-03-12",
      nextStep: "Follow up on proposal",
      nextFollowUpDate: "2026-03-19",
      notes: "Sent proposal for Nike activation at SXSW. Decision expected by end of month.",
      dealValueEstimate: "150000",
      proposalValue: "142000",
      closeProbability: "75",
      forecastValue: "106500",
      source: "Referral",
    },
    {
      pipelineType: "Event",
      companyName: "Wynn Las Vegas",
      contactName: "Amanda Chen",
      title: "Event Manager",
      email: "amanda.chen@wynnlv.com",
      phone: "(702) 555-9012",
      location: "Las Vegas, NV",
      industry: "Hospitality",
      venueProperty: "Wynn Las Vegas",
      projectType: "Conference",
      estimatedBudget: "200000",
      status: "Meeting Booked",
      lastContactDate: "2026-03-18",
      nextStep: "Virtual meeting Tuesday 3pm",
      nextFollowUpDate: "2026-03-22",
      notes: "Large format printing and fabrication for annual tech summit. 3-day event.",
      dealValueEstimate: "200000",
      closeProbability: "40",
      forecastValue: "80000",
      source: "ZoomInfo",
    },
    {
      pipelineType: "Agency",
      companyName: "George P. Johnson",
      contactName: "Marcus Williams",
      title: "Senior Producer",
      email: "marcus.w@gpj.com",
      phone: "(313) 555-3456",
      location: "Detroit, MI",
      industry: "Event Agency",
      projectType: "Experiential Install",
      estimatedBudget: "300000",
      status: "Negotiation",
      lastContactDate: "2026-03-17",
      nextStep: "Review revised scope and pricing",
      nextFollowUpDate: "2026-03-21",
      notes: "Multi-city activation for Ford. Negotiating scope for 5 cities.",
      dealValueEstimate: "300000",
      proposalValue: "285000",
      closeProbability: "80",
      forecastValue: "228000",
      source: "Existing Relationship",
    },
    {
      pipelineType: "Event",
      companyName: "Marriott Marquis DC",
      contactName: "Lisa Park",
      title: "Catering & Events Director",
      email: "lisa.park@marriott.com",
      phone: "(202) 555-7890",
      location: "Washington, DC",
      industry: "Hospitality",
      venueProperty: "Marriott Marquis Washington DC",
      projectType: "Event Activation",
      estimatedBudget: "50000",
      status: "New Lead",
      nextStep: "Send intro email",
      nextFollowUpDate: "2026-03-20",
      notes: "Found via ZoomInfo. Large venue with frequent corporate events.",
      dealValueEstimate: "50000",
      closeProbability: "20",
      forecastValue: "10000",
      source: "ZoomInfo",
    },
    {
      pipelineType: "Agency",
      companyName: "Sparks",
      contactName: "David Kim",
      title: "Creative Director",
      email: "dkim@sparks.com",
      phone: "(215) 555-2345",
      location: "Philadelphia, PA",
      industry: "Experiential Agency",
      projectType: "Fabrication",
      estimatedBudget: "125000",
      status: "Contacted",
      lastContactDate: "2026-03-14",
      nextStep: "Wait for response to cold email",
      nextFollowUpDate: "2026-03-18",
      notes: "Sent cold email intro. Known for high-quality builds.",
      dealValueEstimate: "125000",
      closeProbability: "25",
      forecastValue: "31250",
      source: "Email",
    },
    {
      pipelineType: "Event",
      companyName: "Fontainebleau Miami",
      contactName: "Roberto Diaz",
      title: "VP Events & Experiences",
      email: "roberto.diaz@fontainebleau.com",
      phone: "(305) 555-6789",
      location: "Miami, FL",
      industry: "Hospitality",
      venueProperty: "Fontainebleau Miami Beach",
      projectType: "Projection Mapping",
      estimatedBudget: "180000",
      status: "Closed Won",
      lastContactDate: "2026-03-10",
      nextStep: "Production kickoff",
      notes: "Won contract for NYE projection mapping. Production begins April.",
      dealValueEstimate: "180000",
      proposalValue: "175000",
      closeProbability: "100",
      forecastValue: "175000",
      source: "Referral",
    },
    {
      pipelineType: "Agency",
      companyName: "Jack Morton",
      contactName: "Emily Ross",
      title: "Account Director",
      email: "emily.ross@jackmorton.com",
      phone: "(617) 555-0123",
      location: "Boston, MA",
      industry: "Experiential Agency",
      projectType: "Large Format Printing",
      estimatedBudget: "45000",
      status: "Replied",
      lastContactDate: "2026-03-16",
      nextStep: "Schedule intro call",
      nextFollowUpDate: "2026-03-21",
      notes: "Replied to LinkedIn message. Interested in fast-turn large format.",
      dealValueEstimate: "45000",
      closeProbability: "35",
      forecastValue: "15750",
      source: "LinkedIn",
    },
    {
      pipelineType: "Event",
      companyName: "Hilton Chicago",
      contactName: "Michael O'Brien",
      title: "Events Coordinator",
      email: "mobrien@hilton.com",
      phone: "(312) 555-4567",
      location: "Chicago, IL",
      industry: "Hospitality",
      venueProperty: "Hilton Chicago",
      projectType: "Event Activation",
      estimatedBudget: "35000",
      status: "Closed Lost",
      lastContactDate: "2026-03-05",
      notes: "Lost to competitor. Budget was too tight. Keep in nurture.",
      dealValueEstimate: "35000",
      closeProbability: "0",
      forecastValue: "0",
      source: "Cold Call",
    },
    {
      pipelineType: "Agency",
      companyName: "Czarnowski",
      contactName: "Priya Patel",
      title: "Director of Production",
      email: "priya.patel@czarnowski.com",
      phone: "(702) 555-8901",
      location: "Las Vegas, NV",
      industry: "Exhibit & Event Agency",
      projectType: "Ongoing Partnership",
      estimatedBudget: "500000",
      status: "Meeting Completed",
      lastContactDate: "2026-03-18",
      nextStep: "Send proposal for ongoing partnership",
      nextFollowUpDate: "2026-03-22",
      notes: "Great meeting. They need a reliable large format and fab partner for 2026 events calendar.",
      dealValueEstimate: "500000",
      closeProbability: "50",
      forecastValue: "250000",
      source: "Website",
    },
  ]).returning();

  console.log(`Seeded ${leads.length} leads`);

  const tasks = await db.insert(tasksTable).values([
    { leadId: leads[0].id, taskType: "Send Deck", dueDate: "2026-03-20", status: "pending", notes: "Send capabilities deck to Sarah" },
    { leadId: leads[1].id, taskType: "Follow-up", dueDate: "2026-03-19", status: "pending", notes: "Follow up on Nike activation proposal" },
    { leadId: leads[2].id, taskType: "Meeting Prep", dueDate: "2026-03-22", status: "pending", notes: "Prepare for virtual meeting with Amanda" },
    { leadId: leads[3].id, taskType: "Proposal", dueDate: "2026-03-21", status: "pending", notes: "Review revised scope for Ford activation" },
    { leadId: leads[4].id, taskType: "Follow-up", dueDate: "2026-03-20", status: "pending", notes: "Send intro email to Lisa" },
    { leadId: leads[5].id, taskType: "Check-In", dueDate: "2026-03-18", status: "pending", notes: "Check if David received our email" },
    { leadId: leads[6].id, taskType: "Call", dueDate: "2026-03-25", status: "pending", notes: "Production kickoff call with Roberto" },
    { leadId: leads[7].id, taskType: "Call", dueDate: "2026-03-21", status: "pending", notes: "Schedule intro call with Emily" },
    { leadId: leads[9].id, taskType: "Proposal", dueDate: "2026-03-22", status: "pending", notes: "Send partnership proposal to Priya" },
    { leadId: leads[0].id, taskType: "Post-Meeting Follow-Up", dueDate: "2026-03-17", status: "completed", notes: "Sent thank you email after initial call" },
  ]).returning();

  console.log(`Seeded ${tasks.length} tasks`);

  const templates = await db.insert(templatesTable).values([
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
      subject: null,
      body: `Hi [Name], would love to connect—working with venues and agencies on event production + visual environments.`,
    },
    {
      name: "LinkedIn Follow-Up",
      category: "LinkedIn Message",
      subject: null,
      body: `Thanks for connecting!

Curious—do you currently handle event production and installs internally, or work with external partners?`,
    },
  ]).returning();

  console.log(`Seeded ${templates.length} templates`);

  await db.insert(activityTable).values([
    { type: "lead_created", description: "New lead created: The Ritz-Carlton Orlando", leadId: leads[0].id },
    { type: "lead_created", description: "New lead created: Momentum Worldwide", leadId: leads[1].id },
    { type: "status_changed", description: "Momentum Worldwide status changed to Proposal Sent", leadId: leads[1].id },
    { type: "lead_created", description: "New lead created: Fontainebleau Miami", leadId: leads[6].id },
    { type: "status_changed", description: "Fontainebleau Miami status changed to Closed Won", leadId: leads[6].id },
    { type: "task_completed", description: 'Task "Post-Meeting Follow-Up" completed for The Ritz-Carlton Orlando', leadId: leads[0].id },
  ]);

  console.log("Seeded activity feed");
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
