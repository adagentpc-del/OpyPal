# Overview

A3 Sales OS is an internal sales CRM and outbound operating system for A3 Visual. Its primary purpose is to streamline sales processes, manage leads, automate outreach, and track engagement, ultimately enhancing sales efficiency and providing comprehensive analytics. The system supports lead nurturing, campaign management, and personalized outreach.

# User Preferences

I want iterative development. I want to be asked before you make any major changes to the codebase. I prefer detailed explanations for complex solutions. I do not want any changes made to the folder `lib/api-spec/` or to the file `artifacts/api-server/src/lib/google-sheets.ts`.

# System Architecture

The A3 Sales OS is a pnpm workspace monorepo built with Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Validation:** Zod, `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild

**Monorepo Structure:**
- `artifacts/api-server/`: Express API server
- `artifacts/a3-sales-os/`: React + Vite frontend
- `lib/api-spec/`: OpenAPI specification and Orval configuration
- `lib/api-client-react/`: Generated React Query hooks
- `lib/api-zod/`: Generated Zod schemas
- `lib/db/`: Drizzle ORM schema and database connection

**UI/UX Design:**
- **Color Scheme:** Blue, yellow, black, and white using HSL CSS custom properties.
- **Components:** shadcn/ui for consistent UI.

**App Shell & Navigation:**
- **Layout:** Global app shell with persistent left sidebar, top header, and mobile slide-out drawer.
- **Navigation Config:** Centralized definition in `artifacts/a3-sales-os/src/lib/navigation.ts` for sidebar items, groups, routes, and icons.
- **Sidebar Structure:** Four main groups: Main (Dashboard, Leads, Companies, Contacts, Campaigns, Email Templates, Sequences, CSV Uploads), Outreach (Outbox, Scheduled Emails, Follow Ups, Deliverability, Opens and Clicks, Unsubscribes), Qualification (Intent Signals, Lead Scoring, Segments, Pipeline), and Admin (Settings, Team Notes, Activity Log).
- **Collapsible Sidebar:** Desktop sidebar toggles between full and icon-only mode with state persistence.
- **Route Handling:** Supports legacy route aliases and placeholder pages for future sections.

**Key Features:**

1.  **CRM & Lead Management:**
    *   **Dashboard:** Displays KPIs, pipeline charts, and activity.
    *   **Lead Details:** Comprehensive CRM table with detailed lead information in a side drawer (Contact Info, CRM Status, Outreach, Outreach History, Additional Details).
    *   **Outreach Integration:** Template selector, editable email preview with placeholder substitution, asset attachment, Outlook integration, email scheduling, sequence activation, and draft saving. Logs outreach history and tracks scheduled emails.
    *   **Lead Status & Pipeline:** Quick status changes, forecast values, and a Kanban board with drag-and-drop functionality and Google Sheets sync.
    *   **Import/Export:** CSV import with smart header matching and duplicate detection; CSV export for leads and tasks.

2.  **Outreach Queue:** Dedicated workspace for daily outbound activities (New Imports, Due Today, Overdue, Awaiting Reply) with smart lead cards, draft generation, and batch actions.

3.  **Tasks & Follow-Ups:** Local task manager linked to leads, supporting various task types.

4.  **Templates & Assets:** Libraries for outreach templates and sales assets.
    *   **Enhanced Templates Page:** Table/card view, search, multi-filter, preview, duplicate, archive/activate, linked sequence display.
    *   **Sequence Builder:** Upgraded with delay unit support, step reordering, channel selection, categories, and default use cases.
    *   **Scheduled Emails Page:** Summary, search, status filters, preview, and actions for scheduled emails.
    *   **Lead Drawer Quick Schedule:** Preset chips for fast email scheduling.

5.  **Outbound Sequence Engine:** Automated 7-step email sequences with business day calculation, daily send caps, and configurable send windows. Manages contact lifecycle statuses and provides enhanced CSV upload with validation and deduplication.

6.  **Engagement Scoring:** Calculates engagement scores based on email events (open, click, reply, bounce) and assigns contacts to tiers (cold, warm, hot).

7.  **AI Personalization Layer:** Integrates with OpenAI (via Replit AI Integrations proxy) for personalized outreach lines. Features personalization service with different modes, segment-aware prompts, data quality assessment, and fallback options. Provides API endpoints and frontend controls for generation, bulk generation, and analytics.

8.  **Offer Routing & Conversion Logic:**
    *   **Routing Engine:** Auto-classifies contacts into various routing states (e.g., standard_nurture, hot_priority, qualified_opportunity) based on engagement.
    *   **Routing Logic:** Defines rules for state transitions based on engagement events (bounced, unsubscribed, replied, clicked).
    *   **Frontend:** Dedicated routing page with queues, next actions, CTA library management, and analytics.

9.  **Smart Follow-Up Engine:**
    *   **Engagement Intelligence:** Tracks detailed lead engagement fields (score, status, last engagement type/time).
    *   **Rules Engine:** Processes inbound engagement events through configurable rules to trigger actions (pause/cancel sequences, suppress lead, update engagement, create notifications).
    *   **Notifications System:** In-app notifications with a dedicated UI and polling for unread counts.
    *   **Enhanced Lead Drawer:** Displays engagement intelligence, activity timeline, and bulk sequence actions. Lead table shows engagement score badges and smart next actions.

**Database Schema (Drizzle ORM):**
Key tables include `leads` (with engagement intelligence), `tasks`, `templates`, `assets`, `activity`, `outreach_history`, `scheduled_emails`, `notifications`, `lead_engagement_events`, `contacts`, `campaigns`, `sequence_enrollments`, `personalization_logs`, `routing_logs`, `next_actions`, and `cta_library`.

# External Dependencies

-   **Google Sheets:** Bi-directional sync for lead CRM data with a **MASTER CRM** tab.
-   **Outlook:** Used for sending emails.
-   **Recharts:** For data visualization.
-   **@hello-pangea/dnd:** For drag-and-drop functionality.
-   **react-hook-form:** For form management.
-   **@hookform/resolvers:** For integrating form validation with Zod.