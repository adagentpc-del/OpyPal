# Overview

A3 Sales OS is an internal sales CRM and outbound operating system designed for A3 Visual. Built as a pnpm workspace monorepo using TypeScript, its primary purpose is to streamline sales processes, manage leads, automate outreach, and track engagement. The system aims to enhance sales efficiency, improve lead nurturing, and provide comprehensive analytics for sales performance.

# User Preferences

I want iterative development. I want to be asked before you make any major changes to the codebase. I prefer detailed explanations for complex solutions. I do not want any changes made to the folder `lib/api-spec/` or to the file `artifacts/api-server/src/lib/google-sheets.ts`.

# System Architecture

The A3 Sales OS is a pnpm workspace monorepo built with Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Validation:** Zod (`zod/v4`), `drizzle-zod`
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild (CJS bundle)

**Monorepo Structure:**
- `artifacts/api-server/`: Express API server (port 8080)
- `artifacts/a3-sales-os/`: React + Vite frontend (port 22440)
- `lib/api-spec/`: OpenAPI specification and Orval configuration
- `lib/api-client-react/`: Generated React Query hooks for API interaction
- `lib/api-zod/`: Generated Zod schemas
- `lib/db/`: Drizzle ORM schema and database connection

**UI/UX Design:**
- **Color Scheme:** A palette of blue, yellow, black, and white, defined as CSS custom properties in HSL format within `artifacts/a3-sales-os/src/index.css`.
- **Components:** Utilizes shadcn/ui for consistent and accessible UI components.

**Key Features & Technical Implementations:**

1.  **CRM & Lead Management:**
    *   **Dashboard:** Displays KPIs (Total Leads, Active Leads, Pipeline Value, Meetings Booked, Overdue Follow-ups), pipeline charts, recent activity, and upcoming tasks.
    *   **Lead Details:** A comprehensive CRM table with a right-side drawer for detailed lead information, organized into sections like Contact Info, CRM Status, Outreach, Outreach History, and Additional Details.
    *   **Outreach Integration:** Features a template selector, editable email preview with placeholder substitution, asset attachment, and integration with Outlook for sending. Outreach history is logged, and post-send confirmations update lead status.
    *   **Lead Status & Pipeline:** Quick status change dropdowns, auto-calculated forecast values, and a Kanban board for pipeline visualization with drag-and-drop functionality that updates lead status and syncs with Google Sheets.
    *   **Import/Export:** CSV import with smart header matching, duplicate detection, and auto-inference of pipeline type. Export leads and tasks to CSV.

2.  **Outreach Queue:**
    *   A dedicated workspace for daily outbound activities, offering views for New Imports, Due Today, Overdue, and Awaiting Reply.
    *   Features smart lead cards, draft generation from templates with placeholder substitution, batch actions, and filtering/sorting capabilities.

3.  **Tasks & Follow-Ups:**
    *   Local task manager linked to leads, supporting various task types (Follow-up, Call, Send Deck). Tasks can be filtered by due date and marked as complete.

4.  **Templates & Assets:**
    *   Libraries for outreach templates (Cold Email, Follow-Up Email) and sales assets (Brochure, Capabilities Deck). Templates can be linked to assets, with automatic selection and placeholder replacement during outreach.

5.  **Outbound Sequence Engine (Phase 2):**
    *   **Automated Sequences:** Supports 7-step automated email sequences (Day 0, 3, 7, 14, 30, 120, 180) with business day calculation, daily send caps, and configurable send windows.
    *   **Contact Lifecycle:** Manages contact statuses (pending, active, completed, paused, paused_replied, dnc) with actions like enroll, pause, resume, skip step, force send, mark replied, and mark DNC.
    *   **CSV Upload:** Enhanced CSV upload for contacts, with options for campaign, sequence selection, and auto-enrollment. Includes email validation and deduplication.
    *   **Frontend Pages:** Dedicated pages for CSV upload, contact management, campaign and sequence definition, queue processing, replies, and analytics.
    *   **Settings:** Configurable settings for `daily_send_cap`, `send_window_start`, `send_window_end`, and `business_days_only`.

6.  **Engagement Scoring (Phase 3):**
    *   Calculates an engagement score based on email events (open, click, reply, bounce) and assigns contacts to tiers (cold, warm, hot).
    *   **Template Engine:** Supports variable substitution (`{{first_name}}`, `{{company}}`) and conditional helpers (`{{greeting}}`, `{{intent_line}}`) for personalized outreach.

**Database Schema (Drizzle ORM):**
Key tables include:
-   `leads`: CRM lead records.
-   `tasks`: Local tasks/follow-ups linked to leads.
-   `templates`: Local outreach templates.
-   `assets`: Local sales assets.
-   `activity`: Dashboard activity log.
-   `outreach_history`: Log of sent emails per lead.
-   `contacts`, `campaigns`, `template_sets`, `sequence_enrollments`, `sequence_steps`, `send_logs`, `email_events`, `suppression_list`, `imports`, `settings`: Tables for the Outbound Sequence Engine and analytics.

**TypeScript & Composite Projects:**
The monorepo leverages TypeScript composite projects, with all packages extending `tsconfig.base.json`. Type checking is performed from the root, emitting only `.d.ts` files. Project references are configured for inter-package dependencies.

# External Dependencies

-   **Google Sheets:** Bi-directional sync for lead CRM data with a **MASTER CRM** tab. Utilizes `googleapis` and the Replit Google Sheets connector.
-   **Outlook:** Used for sending emails during outreach.
-   **Recharts:** For data visualization on the dashboard (charts).
-   **@hello-pangea/dnd:** For drag-and-drop functionality in the Kanban pipeline.
-   **react-hook-form:** For form management and validation.
-   **@hookform/resolvers:** Integrates form validation with Zod.