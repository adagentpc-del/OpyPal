import { Router, type IRouter } from "express";
import { db, templatesTable, templateSetsTable, sequenceTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const MERGE_TOKENS = [
  "{{firstName}}", "{{lastName}}", "{{fullName}}", "{{company}}",
  "{{title}}", "{{industry}}", "{{location}}", "{{customLine}}",
  "{{venueProperty}}", "{{projectType}}", "{{intentSignal}}",
];

const A3_CORE_TEMPLATES = [
  {
    name: "A3 Core - Event Production Intro",
    category: "A3 Core",
    type: "initial_outreach",
    subject: "{{company}} + A3 Visual — Event Production Partner",
    body: `Hi {{firstName}},

{{customLine}}

I'm reaching out from A3 Visual — we specialize in large-format printing, scenic fabrication, and experiential environments for brands like yours in the {{industry}} space.

Whether it's trade show builds, branded activations, or venue transformations, our team handles everything from concept to install.

Would it make sense to connect for 15 minutes to discuss what {{company}} has coming up?

Best,
A3 Visual Team`,
    description: "Initial cold outreach for A3 core event production services",
    audienceTags: "events,trade-shows,activations",
  },
  {
    name: "A3 Core - Portfolio Showcase",
    category: "A3 Core",
    type: "follow_up",
    subject: "Recent A3 Visual work — {{industry}} projects",
    body: `Hi {{firstName}},

Following up on my previous note — wanted to share a few recent A3 Visual projects in the {{industry}} space:

- Large-format scenic builds for branded environments
- Custom fabrication for product launches
- Full venue wraps and experiential activations

Happy to send over a portfolio deck if there's interest. We've supported events at properties and venues across the country.

Any upcoming projects where we could help?

Best,
A3 Visual Team`,
    description: "Follow-up showcasing portfolio for event production",
    audienceTags: "events,trade-shows",
  },
  {
    name: "A3 Core - Case Study Share",
    category: "A3 Core",
    type: "follow_up",
    subject: "How we helped a {{industry}} brand stand out",
    body: `Hi {{firstName}},

I wanted to share a quick case study that might resonate with {{company}}.

We recently partnered with a {{industry}} brand to deliver:
- Full scenic environment design and fabrication
- On-site install and strike coordination
- Branded signage and wayfinding systems

The result was a seamless brand experience that drove measurable engagement. Would love to discuss how we could do something similar for your team.

Worth a quick chat?

Best,
A3 Visual Team`,
    description: "Case study follow-up template",
    audienceTags: "events,experiential",
  },
];

const MEDICAL_TEMPLATES = [
  {
    name: "Medical - Healthcare Environment Intro",
    category: "Medical",
    type: "initial_outreach",
    subject: "Healthcare environments — {{company}} + A3 Visual",
    body: `Hi {{firstName}},

{{customLine}}

A3 Visual works with healthcare organizations to create branded environments that improve patient experience and wayfinding.

Our work includes:
- Interior branding and wall graphics
- Wayfinding and directional signage systems
- Patient experience environment design
- Donor recognition displays

We understand the unique requirements of healthcare spaces — ADA compliance, infection control considerations, and durability standards.

Would it make sense to schedule a brief call to discuss any upcoming facility projects at {{company}}?

Best,
A3 Visual Healthcare Team`,
    description: "Initial outreach for healthcare/medical facilities",
    audienceTags: "healthcare,medical,hospitals",
  },
  {
    name: "Medical - Facility Refresh",
    category: "Medical",
    type: "follow_up",
    subject: "Facility refresh ideas for {{company}}",
    body: `Hi {{firstName}},

Following up — many healthcare organizations are refreshing their physical environments to better reflect their brand and improve patient satisfaction scores.

A3 Visual has helped facilities with:
- Lobby and reception area transformations
- Department-specific branding programs
- Digital integration with physical signage
- Seasonal and campaign-based installations

Any renovation or refresh projects on the horizon for {{company}}?

Best,
A3 Visual Healthcare Team`,
    description: "Follow-up focused on facility refresh opportunities",
    audienceTags: "healthcare,renovation",
  },
  {
    name: "Medical - Conference & Event Support",
    category: "Medical",
    type: "follow_up",
    subject: "Medical conference support — A3 Visual",
    body: `Hi {{firstName}},

As conference season approaches, I wanted to mention that A3 Visual provides full-service exhibit and event support for healthcare organizations.

This includes:
- Custom exhibit design and fabrication
- On-site installation and dismantling
- Branded environments for CME events and symposiums
- Portable display systems for multi-event use

If {{company}} has any upcoming conferences or events, we'd love to help make your presence impactful.

Best,
A3 Visual Healthcare Team`,
    description: "Conference and trade show support for medical clients",
    audienceTags: "healthcare,conferences,exhibits",
  },
];

const REACTIVATION_TEMPLATES = [
  {
    name: "Reactivation - Check In",
    category: "Reactivation",
    type: "reactivation",
    subject: "Checking in — {{company}} + A3 Visual",
    body: `Hi {{firstName}},

It's been a while since we last connected. I wanted to check in and see if {{company}} has any upcoming events, installations, or branding projects where A3 Visual could help.

We've been busy expanding our capabilities in:
- Immersive branded environments
- Sustainable materials and reusable systems
- Digital integration with physical installations

Would love to reconnect if the timing makes sense.

Best,
A3 Visual Team`,
    description: "Reactivation for dormant contacts",
    audienceTags: "reactivation,dormant",
  },
  {
    name: "Reactivation - New Capabilities",
    category: "Reactivation",
    type: "reactivation",
    subject: "New from A3 Visual — thought of {{company}}",
    body: `Hi {{firstName}},

Quick update from A3 Visual — we've launched some new service areas that made me think of {{company}}:

- Projection mapping and immersive experiences
- Modular exhibit systems for flexible deployments
- Turnkey event production from concept to strike

If any of these align with what your team is working on, I'd love to set up a brief call.

Best,
A3 Visual Team`,
    description: "Reactivation highlighting new capabilities",
    audienceTags: "reactivation,upsell",
  },
];

const FOLLOW_UP_SEQUENCE_STEPS = [
  { stepNumber: 1, delayDays: 0, stepLabel: "Initial Outreach", delayUnit: "days" },
  { stepNumber: 2, delayDays: 3, stepLabel: "3-Day Follow-up", delayUnit: "days" },
  { stepNumber: 3, delayDays: 7, stepLabel: "7-Day Follow-up", delayUnit: "days" },
  { stepNumber: 4, delayDays: 14, stepLabel: "14-Day Follow-up", delayUnit: "days" },
  { stepNumber: 5, delayDays: 30, stepLabel: "1-Month Follow-up", delayUnit: "days" },
  { stepNumber: 6, delayDays: 90, stepLabel: "3-Month Follow-up", delayUnit: "days" },
  { stepNumber: 7, delayDays: 180, stepLabel: "6-Month Follow-up", delayUnit: "days" },
  { stepNumber: 8, delayDays: 365, stepLabel: "1-Year Follow-up", delayUnit: "days" },
];

const SEQUENCE_BODIES = [
  null,
  `Hi {{firstName}},

Just following up on my previous note about how A3 Visual could support {{company}}.

Would love to connect briefly — even 10 minutes would be great. What does your schedule look like this week?

Best,
A3 Visual Team`,
  `Hi {{firstName}},

Circling back one more time. I know things get busy, but I think there could be a strong fit between A3 Visual and {{company}}.

We've recently completed projects for companies in your space and would love to share a few relevant examples.

Open to a quick call?

Best,
A3 Visual Team`,
  `Hi {{firstName}},

Last follow-up for now — if the timing isn't right, no worries at all.

If {{company}} has any upcoming events, installations, or branding projects down the road, I'd love to be a resource.

Feel free to reach out anytime.

Best,
A3 Visual Team`,
  `Hi {{firstName}},

It's been about a month since we last reached out. Wanted to quickly check in — has anything changed on {{company}}'s event or branding calendar?

We're always here if you need a production partner.

Best,
A3 Visual Team`,
  `Hi {{firstName}},

Checking in from A3 Visual. It's been a few months and I wanted to see if {{company}} has any Q3/Q4 projects where we could help.

We've been expanding our work in {{industry}} and would love to share what's new.

Worth reconnecting?

Best,
A3 Visual Team`,
  `Hi {{firstName}},

Semi-annual check-in from A3 Visual. We've added new capabilities since we last connected, including immersive environments and modular exhibit systems.

If {{company}} is planning any events or installations, I'd love to discuss how we can help.

Best,
A3 Visual Team`,
  `Hi {{firstName}},

Annual check-in from A3 Visual. I hope the past year has been great for {{company}}.

As you plan for the year ahead, if there are any events, renovations, or branding projects on the horizon, we'd love to be part of the conversation.

Best,
A3 Visual Team`,
];

router.get("/seed-templates/status", async (_req, res) => {
  try {
    const templates = await db.select().from(templatesTable);
    const sets = await db.select().from(templateSetsTable);
    const steps = await db.select().from(sequenceTemplatesTable);
    res.json({
      templates: templates.length,
      templateSets: sets.length,
      sequenceSteps: steps.length,
      mergeTokens: MERGE_TOKENS,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/seed-templates", async (_req, res) => {
  try {
    const existingTemplates = await db.select({ name: templatesTable.name }).from(templatesTable);
    const existingNames = new Set(existingTemplates.map(t => t.name));

    const allTemplates = [...A3_CORE_TEMPLATES, ...MEDICAL_TEMPLATES, ...REACTIVATION_TEMPLATES];
    let templatesCreated = 0;

    const createdTemplateIds: Record<string, number> = {};

    for (const t of allTemplates) {
      if (existingNames.has(t.name)) continue;
      const [created] = await db.insert(templatesTable).values({
        name: t.name,
        category: t.category,
        type: t.type,
        subject: t.subject,
        body: t.body,
        description: t.description,
        audienceTags: t.audienceTags,
        isActive: true,
      }).returning();
      createdTemplateIds[t.name] = created.id;
      templatesCreated++;
    }

    const existingSets = await db.select({ name: templateSetsTable.name }).from(templateSetsTable);
    const existingSetNames = new Set(existingSets.map(s => s.name));

    let sequencesCreated = 0;
    let stepsCreated = 0;

    const sequenceDefs = [
      { name: "A3 Core - Standard Outreach", category: "A3 Core", initialTemplate: "A3 Core - Event Production Intro" },
      { name: "Medical - Healthcare Outreach", category: "Medical", initialTemplate: "Medical - Healthcare Environment Intro" },
      { name: "Reactivation - Win-Back Sequence", category: "Reactivation", initialTemplate: "Reactivation - Check In" },
    ];

    for (const seqDef of sequenceDefs) {
      if (existingSetNames.has(seqDef.name)) continue;

      const [set] = await db.insert(templateSetsTable).values({
        name: seqDef.name,
        description: `Default follow-up sequence for ${seqDef.category} vertical with 3d/7d/14d/1m/3m/6m/1y cadence`,
      }).returning();

      const initialTemplateId = createdTemplateIds[seqDef.initialTemplate] || null;

      for (let i = 0; i < FOLLOW_UP_SEQUENCE_STEPS.length; i++) {
        const step = FOLLOW_UP_SEQUENCE_STEPS[i];
        const bodyOverride = SEQUENCE_BODIES[i];

        await db.insert(sequenceTemplatesTable).values({
          templateSetId: set.id,
          stepNumber: step.stepNumber,
          name: step.stepLabel,
          subject: i === 0 ? (allTemplates.find(t => t.name === seqDef.initialTemplate)?.subject || "Following up") : `Re: Following up — {{company}} + A3 Visual`,
          body: bodyOverride || allTemplates.find(t => t.name === seqDef.initialTemplate)?.body || "Following up on my previous message.",
          delayDays: step.delayDays,
          delayValue: step.delayDays,
          delayUnit: step.delayUnit,
          stepLabel: step.stepLabel,
          channel: "email",
          templateId: i === 0 ? initialTemplateId : null,
          isActive: true,
        });
        stepsCreated++;
      }

      if (initialTemplateId) {
        await db.update(templatesTable).set({
          linkedSequenceId: set.id,
          linkedTemplateSetId: set.id,
          updatedAt: new Date(),
        }).where(eq(templatesTable.id, initialTemplateId));
      }

      sequencesCreated++;
    }

    res.json({
      success: true,
      templatesCreated,
      sequencesCreated,
      stepsCreated,
      mergeTokens: MERGE_TOKENS,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
