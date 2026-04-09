# Overview

A3 Sales OS is an internal sales CRM and outbound operating system designed for A3 Visual. Its core purpose is to optimize sales workflows, manage leads, automate outreach, and meticulously track engagement, thereby boosting sales efficiency and providing comprehensive analytics. The system supports lead nurturing, campaign management, and highly personalized outreach. The A3 Partner Portal, a component of this system, facilitates partner intake and internal request management for event production.

# User Preferences

I want iterative development. I want to be asked before you make any major changes to the codebase. I prefer detailed explanations for complex solutions. I do not want any changes made to the folder `lib/api-spec/` or to the file `artifacts/api-server/src/lib/google-sheets.ts`.

# System Architecture

The A3 Sales OS is built as a pnpm workspace monorepo utilizing Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **API Framework:** Express 5
- **Database:** PostgreSQL with Drizzle ORM
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui
- **Validation:** Zod
- **API Codegen:** Orval (from OpenAPI spec)

**Monorepo Structure:**
- `artifacts/api-server/`: Express API server
- `artifacts/a3-sales-os/`: React + Vite frontend (Sales OS)
- `artifacts/a3-partner-portal/`: React + Vite frontend (Partner Portal)
- `lib/api-spec/`: OpenAPI specification
- `lib/api-client-react/`: Generated React Query hooks
- `lib/api-zod/`: Generated Zod schemas
- `lib/db/`: Drizzle ORM schema and database connection

**UI/UX Design:**
- **Color Scheme:** Blue, yellow, black, and white (HSL custom properties).
- **Components:** shadcn/ui for a consistent user interface.
- **Layout:** Global app shell featuring a persistent left sidebar, top header, and mobile slide-out drawer.
- **Navigation:** Centralized configuration in `artifacts/a3-sales-os/src/lib/navigation.ts`, supporting categorized sidebar items and icons.

**Key Features:**

1.  **CRM & Lead Management:** Comprehensive lead details, outreach integration with templates and scheduling, status updates, pipeline management with Kanban board, and CSV import/export.
2.  **Outreach Queue:** Dedicated workspace for daily outbound activities with smart lead cards and batch actions.
3.  **Templates & Assets:** Libraries for outreach templates and sales assets, including an enhanced template page and an upgraded sequence builder.
4.  **Outbound Sequence Engine:** Automated 7-step email sequences with business day calculation, daily send caps, and enhanced CSV upload.
5.  **Engagement Scoring:** Calculates lead engagement based on email events and assigns contacts to tiers (cold, warm, hot).
6.  **AI Personalization Layer:** Integrates with OpenAI for personalized outreach, offering various modes, segment-aware prompts, and data quality assessment.
7.  **Offer Routing & Conversion Logic:** Automated contact classification into routing states (e.g., standard_nurture, hot_priority) based on engagement events.
8.  **Smart Follow-Up Engine & Task/Alert Layer:** Tracks lead engagement, processes inbound events through a configurable rules engine to trigger actions (e.g., pause sequences, create tasks, update priority), and provides an in-app notification system.
9.  **Bulk Outreach with Resend (Queue-Based Model):** Implements a robust queue-based email delivery system with rate limiting, exponential backoff, status tracking, and campaign management, ensuring deliverability safeguards.
10. **Reply Tracking & Inbound Email Processing:** Utilizes tagged reply-to addresses for outbound emails, processes inbound emails via a webhook, matches replies to leads, and automatically pauses sequences upon reply detection (excluding auto-replies). Provides a chronological conversation thread in the UI.
11. **A3 Partner Portal:** A separate application for partner intake and internal request management.
    *   **Admin Side:** Features authentication, dashboard, CRUD operations for partners and pricing rules, request management with AI summaries, and internal notes.
    *   **Public Side:** Branded partner portal pages with multi-step intake forms, conditional logic, and submission triggers that generate AI summaries and send notifications.

12. **Microsoft Outlook / Graph Integration:** Full OAuth2 connection flow for Microsoft 365 mailboxes, send via Outlook or Resend (configurable), inbox sync for inbound and sent folders, thread tracking via conversation IDs.
13. **Background Scheduler:** Automatic follow-up processing (every 60s) and Outlook inbox sync (every 120s), with business-hours enforcement and configurable send windows.
14. **Reply Intelligence & Review Queue:** Confidence-scored reply classification (human_reply / auto_reply / uncertain), uncertain replies routed to manual review queue with full thread context and one-click decisions that pause/resume sequences.
15. **Companies Management:** Company records auto-synced from lead data, with industry tracking, associated leads, and pipeline value aggregation.
16. **Real Settings Page:** Configurable email provider, send windows, throttling, reply intelligence toggles, scheduler start/stop, and Outlook connection management.
17. **Activity Log:** Full system event timeline with type filtering, search, and color-coded event badges.

**Database Schema:** Key tables include `leads`, `tasks`, `templates`, `activity`, `outreach_history`, `scheduled_emails`, `notifications`, `contacts`, `campaigns`, `bulk_send_campaigns`, `inbound_emails`, `partners`, `partner_requests`, `pricing_rules`, `mailbox_connections`, `companies`, and `reply_review_queue`.

# External Dependencies

-   **Google Sheets:** For bi-directional synchronization of lead CRM data with a MASTER CRM tab.
-   **Resend:** Email delivery service used for bulk outreach.
-   **Outlook:** Utilized for individual email sending.
-   **OpenAI:** Integrated via Replit AI Integrations proxy for AI personalization.
-   **Anthropic AI:** Integrated via Replit AI Integrations proxy for AI summaries in the Partner Portal.
-   **Recharts:** For data visualization.