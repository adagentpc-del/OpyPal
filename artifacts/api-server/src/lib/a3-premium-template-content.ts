// AUTO-GENERATED A3 Visual premium template copy (workspace 1).
  // Source of truth for the boot seeder in seed-a3-premium-templates-on-boot.ts.
  // After seeding, these become editable DB records in the Templates / Sequences UI.
  // Merge tokens: {{firstName}} {{companyName}} {{city}} {{senderName}} {{senderTitle}}
  //               {{calendarLink}} {{customNote}} {{originalSubject}}

  export interface A3PremiumTemplate {
    name: string;
    subject: string;
    body: string;
  }

  export interface A3PremiumCategory {
    category: string;
    templates: A3PremiumTemplate[];
  }

  export interface A3PremiumStep {
    stepNumber: number;
    delayDays: number;
    delayValue: number;
    delayUnit: string;
    stepLabel: string;
    subject: string;
    body: string;
  }

  export const A3_PREMIUM_SEQUENCE_NAME = "A3 Premium Default Follow-Up Sequence";

  export const A3_PREMIUM_CATEGORIES: A3PremiumCategory[] = [
  {
    "category": "Hotels and Hospitality",
    "templates": [
      {
        "name": "Hospitality Executive Intro",
        "subject": "A3 Visual for hospitality environments and events",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support hospitality properties and event-driven environments with large-format print, fabrication, signage, branded installations, and visual execution that needs to look elevated and come together cleanly.\r\n\r\nReaching out in case {{companyName}} ever needs a strong partner for property branding, launches, seasonal moments, event graphics, wayfinding, or custom visual production.\r\n\r\nIf relevant, I’d be glad to connect briefly.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Hospitality Value Intro",
        "subject": "Visual execution support for hospitality teams",
        "body": "Hi {{firstName}},\r\n\r\nHospitality teams often need visual partners who can support both presentation and execution without adding more friction internally.\r\n\r\nA3 Visual helps with branded environments, print, fabrication, signage, installs, and event-related visual production where quality and timing both matter.\r\n\r\nHappy to send a short overview if useful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Venues and Convention Centers",
    "templates": [
      {
        "name": "Venue Direct Intro",
        "subject": "A3 Visual for venue branding and event production",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support venues with event graphics, sponsor branding, signage, fabrication, branded environments, and installation support across fast-moving event calendars.\r\n\r\nReaching out in case {{companyName}} ever needs a reliable visual production partner for sponsor deliverables, temporary branding, wayfinding, or event execution.\r\n\r\nWould be glad to connect if helpful.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Venue Operational Value Intro",
        "subject": "Support for venue graphics and branded execution",
        "body": "Hi {{firstName}},\r\n\r\nVenue teams usually need partners who can execute quickly, stay organized, and deliver a polished visual result without creating unnecessary back-and-forth.\r\n\r\nThat is where A3 Visual tends to fit well.\r\n\r\nWe support signage, sponsor assets, branded environments, fabrication, and installation across live events and venue activations.\r\n\r\nHappy to share more context if helpful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Agencies and Brand Activations",
    "templates": [
      {
        "name": "Agency Strategic Intro",
        "subject": "Production support for branded activations",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe work with agencies and brand teams on large-format print, fabrication, branded environments, installations, and visual execution for activations, events, and campaign moments.\r\n\r\nReaching out in case you ever need a partner who can help translate strong creative into polished real-world execution.\r\n\r\nWould be glad to connect if useful.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Agency Creative Operations Intro",
        "subject": "A strong execution partner for brand environments",
        "body": "Hi {{firstName}},\r\n\r\nWhen a concept moves from deck to execution, the quality of the production partner matters.\r\n\r\nA3 Visual supports agencies and brand teams with print, fabrication, signage, installation, and custom visual production for activations and branded environments that need to land well both visually and operationally.\r\n\r\nHappy to send a short overview if useful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Developers and Commercial Real Estate",
    "templates": [
      {
        "name": "Developer Direct Intro",
        "subject": "A3 Visual for property branding and launches",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support developers and commercial real estate teams with signage, branded environments, large-format graphics, fabrication, and installation for launches, sales environments, property branding, and special events.\r\n\r\nReaching out in case {{companyName}} ever needs a visual production partner who can support presentation-heavy environments with strong execution.\r\n\r\nWould be glad to connect if relevant.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Developer Launch Support Intro",
        "subject": "Visual support for development and property teams",
        "body": "Hi {{firstName}},\r\n\r\nFor property and development teams, visual execution often needs to do more than just look good. It has to support the brand, the environment, and the moment.\r\n\r\nA3 Visual helps with that through large-format graphics, fabrication, signage, installation, and branded environments for launches, leasing, presentations, and property-related events.\r\n\r\nHappy to share more context if helpful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Sports and Entertainment",
    "templates": [
      {
        "name": "Sports Direct Intro",
        "subject": "A3 Visual for sports and live environments",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support sports and entertainment environments with sponsor graphics, branded assets, fabrication, large-format print, signage, and installation support for high-visibility live experiences.\r\n\r\nReaching out in case {{companyName}} ever needs a trusted partner for event visuals, sponsor environments, or branded production that has to move quickly and land cleanly.\r\n\r\nWould be glad to connect if useful.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Sports Operational Support Intro",
        "subject": "Sponsor and event production support",
        "body": "Hi {{firstName}},\r\n\r\nSports and entertainment teams often need visual partners who understand both speed and presentation.\r\n\r\nA3 Visual supports sponsor graphics, venue branding, fabrication, and installation for live event environments where visibility, timing, and execution all matter.\r\n\r\nHappy to send a quick overview if helpful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Event Producers and Festivals",
    "templates": [
      {
        "name": "Event Producer Direct Intro",
        "subject": "Visual production support for events and festivals",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support events, festivals, and production teams with signage, sponsor assets, branded graphics, fabrication, large-format print, and install support across live environments.\r\n\r\nReaching out in case {{companyName}} ever needs a strong production partner for event branding, sponsor integration, or on-site visual execution.\r\n\r\nWould be glad to connect if relevant.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Event Producer Execution Intro",
        "subject": "A3 Visual for event branding and execution",
        "body": "Hi {{firstName}},\r\n\r\nEvent teams often need partners who can execute across multiple visual needs without creating extra complexity.\r\n\r\nA3 Visual supports that with print, graphics, fabrication, sponsor visuals, and install coordination for events and festival environments that need to feel polished and well-run.\r\n\r\nHappy to send more context if useful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Printing and Production Partners",
    "templates": [
      {
        "name": "Production Partner Intro",
        "subject": "Potential production partnership",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe often support projects involving large-format print, fabrication, installation, event graphics, and specialty execution, and I thought it may be worth connecting in case there is an opportunity to support one another where capabilities, timing, geography, or scope align.\r\n\r\nOpen to a brief intro if useful.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Overflow Support Intro",
        "subject": "Overflow and specialty production support",
        "body": "Hi {{firstName}},\r\n\r\nReaching out because A3 Visual is often brought in where a partner needs additional support around fabrication, large-format production, installation, or more specialized visual execution.\r\n\r\nThought it could be useful to connect in case there is room for a reciprocal relationship around overflow, regional support, or select project types.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "General Intro",
    "templates": [
      {
        "name": "General Clean Intro",
        "subject": "Intro from A3 Visual",
        "body": "Hi {{firstName}},\r\n\r\nI wanted to introduce A3 Visual.\r\n\r\nWe support brands, venues, agencies, hospitality groups, event teams, and commercial environments with large-format print, fabrication, signage, branded environments, installations, and specialty visual production.\r\n\r\nReaching out in case there may be a fit now or down the road.\r\n\r\nWould be glad to connect if useful.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "General Premium Intro",
        "subject": "Visual production and execution support",
        "body": "Hi {{firstName}},\r\n\r\nMany teams need a reliable partner once a project moves from concept into production and execution.\r\n\r\nA3 Visual supports that with print, graphics, fabrication, installations, branded environments, and custom visual work across a wide range of projects and environments.\r\n\r\nHappy to send a short overview if helpful.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  },
  {
    "category": "Reactivation",
    "templates": [
      {
        "name": "Reactivation Polished Reconnect",
        "subject": "Reconnecting from A3 Visual",
        "body": "Hi {{firstName}},\r\n\r\nWanted to reconnect and reintroduce A3 Visual.\r\n\r\nWe continue to support clients with large-format print, fabrication, signage, branded installations, event graphics, and custom visual production across a range of environments.\r\n\r\nIf you are reviewing partners or have anything upcoming where an additional resource could be useful, I’d be glad to reconnect.\r\n\r\nBest,\r\n{{senderName}}"
      },
      {
        "name": "Reactivation Seasonal Reconnect",
        "subject": "Quick reconnect",
        "body": "Hi {{firstName}},\r\n\r\nReaching back out in case the timing is better now.\r\n\r\nIf visual production, signage, branded installations, fabrication, or event-related graphics are relevant for your team this season, A3 is worth keeping in mind.\r\n\r\nBest,\r\n{{senderName}}"
      }
    ]
  }
];

  export const A3_PREMIUM_STEPS: A3PremiumStep[] = [
  {
    "stepNumber": 1,
    "delayDays": 3,
    "delayValue": 3,
    "delayUnit": "days",
    "stepLabel": "3 days",
    "subject": "Re: {{originalSubject}}",
    "body": "Hi {{firstName}},\r\n\r\nJust wanted to move this back up in case it got buried.\r\n\r\nThought A3 could be a useful resource if visual production, signage, fabrication, or branded execution support ever becomes relevant for {{companyName}}.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 2,
    "delayDays": 7,
    "delayValue": 7,
    "delayUnit": "days",
    "stepLabel": "7 days",
    "subject": "Re: {{originalSubject}}",
    "body": "Hi {{firstName}},\r\n\r\nFollowing up here.\r\n\r\nA3 typically supports teams that need a partner capable of handling both presentation and execution across print, fabrication, installs, and branded environments.\r\n\r\nHappy to send a short overview if useful.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 3,
    "delayDays": 14,
    "delayValue": 14,
    "delayUnit": "days",
    "stepLabel": "14 days",
    "subject": "Re: {{originalSubject}}",
    "body": "Hi {{firstName}},\r\n\r\nWanted to reach out once more.\r\n\r\nIf your team ever needs a visual production partner that can support fast-moving or presentation-sensitive work cleanly, A3 is worth keeping in mind.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 4,
    "delayDays": 30,
    "delayValue": 1,
    "delayUnit": "months",
    "stepLabel": "1 month",
    "subject": "Re: {{originalSubject}}",
    "body": "Hi {{firstName}},\r\n\r\nChecking back in here in case the timing is better now.\r\n\r\nIf this is relevant for anything upcoming, I’d be glad to reconnect.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 5,
    "delayDays": 90,
    "delayValue": 3,
    "delayUnit": "months",
    "stepLabel": "3 months",
    "subject": "Reconnecting on A3 Visual",
    "body": "Hi {{firstName}},\r\n\r\nWanted to circle back and reintroduce A3 Visual.\r\n\r\nIf you are reviewing partners for print, fabrication, signage, branded environments, or event-related visual execution, I’d be glad to reconnect.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 6,
    "delayDays": 180,
    "delayValue": 6,
    "delayUnit": "months",
    "stepLabel": "6 months",
    "subject": "Quick check-in",
    "body": "Hi {{firstName}},\r\n\r\nReaching back out in case this is more relevant now.\r\n\r\nA3 continues to support teams that need high-quality visual execution across environments where timing and presentation both matter.\r\n\r\nBest,\r\n{{senderName}}"
  },
  {
    "stepNumber": 7,
    "delayDays": 365,
    "delayValue": 1,
    "delayUnit": "years",
    "stepLabel": "1 year",
    "subject": "Reconnecting this year",
    "body": "Hi {{firstName}},\r\n\r\nI had reached out previously and wanted to reconnect in case the timing is better now.\r\n\r\nIf an additional visual production partner would be useful this year, I’d be glad to connect.\r\n\r\nBest,\r\n{{senderName}}"
  }
];
  