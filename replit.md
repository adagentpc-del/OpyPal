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
- `artifacts/a3-sales-os/`: React + Vite frontend (Sales OS)
- `artifacts/a3-partner-portal/`: React + Vite frontend (Partner Portal)
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

9.  **Smart Follow-Up Engine & Task/Alert Layer:**
    *   **Engagement Intelligence:** Tracks detailed lead engagement fields (score, status, last engagement type/time).
    *   **Rules Engine:** Processes inbound engagement events through configurable rules to trigger actions (pause/cancel sequences, suppress lead, update engagement, create notifications, create tasks, update priority flags).
    *   **Auto-Task Creation:** System-generated tasks on reply (review_reply), click (check_high_intent), bounce (verify_bounced_email), warm lead (3+ opens), high intent score threshold (≥30), sequence paused. Deduplicated to prevent spam on repeated events.
    *   **Task System:** Tasks have title, taskType, priority (low/medium/high/urgent), source (user/system), status (open/in_progress/completed/dismissed), dueDate, linkedLeadId, createdBy. API: GET/POST /tasks, GET /tasks/summary, PATCH /tasks/:id/complete, PATCH /tasks/:id/dismiss, DELETE /tasks/:id.
    *   **Auto-Rules Configuration:** Toggleable rules via GET/PUT /tasks/auto-rules. Controls: create_task_on_reply, create_task_on_click, create_task_on_bounce, notify_on_reply/bounce/click/unsubscribe, high_intent_score_threshold.
    *   **Notifications System:** In-app notifications with severity levels (urgent/important/warning/info), severity filter pills, lead links with company/contact names via JOIN. Polling for unread counts.
    *   **Dashboard Alert Widgets:** Six alert cards: Replies to Review, High Intent Leads, Tasks Due Today, Overdue Tasks, Bounced to Review, Paused Sequences.
    *   **Lead Drawer Tasks:** Tasks section with open/overdue/completed tasks, quick complete/dismiss buttons, quick-create task dropdown.
    *   **Priority Flag Badges:** Leads table shows priority flag badges (urgent/high/review) from auto-engine events.
    *   **Tasks Page:** Full table view at /follow-ups with 7 filter tabs (all/open/today/overdue/urgent/system/completed), search, type filter, Auto Rules settings modal, New Task modal.
    *   **Enhanced Lead Drawer:** Displays engagement intelligence, activity timeline, and bulk sequence actions. Lead table shows engagement score badges and smart next actions.

10. **Bulk Outreach with Resend (Queue-Based Model):**
    *   **Resend Integration:** Email delivery via Resend connector (`artifacts/api-server/src/lib/resend.ts`). Uses Replit connector credentials pattern (never cached client). Sender: admin@universalaestheticawards.com. Default reply-to: alyssa@a3visual.com (configurable per campaign).
    *   **Send Queue Processor:** (`artifacts/api-server/src/lib/send-queue.ts`) Queue-based email delivery with configurable rate limiting (sends/hr), delay between sends, batch processing. Features exponential backoff retry for temporary errors (429, timeout, etc.), max 3 retries per email, per-email status tracking (queued → sending → sent/failed/retry_pending), abort/pause/resume control per campaign, counter persistence across pause/resume cycles.
    *   **Bulk Send Engine:** (`artifacts/api-server/src/lib/bulk-send-engine.ts`) Queues emails (status="queued") instead of sending immediately. Handles recipient validation/suppression, per-recipient personalization, campaign creation with rate config, and fires queue processor asynchronously for send_now mode.
    *   **Campaign Tracking:** `bulk_send_campaigns` table tracks name, template, sequence, sender, replyTo, rate config (sendsPerHour, delayBetweenSendsMs, batchSize), totals (selected/queued/sent/scheduled/skipped/failed/retried), status, queue timestamps.
    *   **Email Queue Fields:** `scheduled_emails` has retryCount, maxRetries, lastAttemptAt, sendError, queuedAt, queuePosition, fromEmail, replyTo.
    *   **API Routes:** `GET /bulk-send/sender-config` (from/reply-to/rate defaults with connection status), `POST /bulk-send/validate`, `POST /bulk-send/execute` (queues + starts processor), `GET /bulk-send/campaigns`, `GET /bulk-send/campaigns/:id`, `GET /bulk-send/campaigns/:id/progress`, `POST /bulk-send/campaigns/:id/pause`, `POST /bulk-send/campaigns/:id/resume`, `GET /bulk-send/queue-status`.
    *   **Frontend:** BulkOutreachModal with sender config (reply-to field, from email display), rate limiting controls (sends/hr, delay, batch size), queue-aware results (shows "queued" status with queue position and config summary). Send mode labeled "Queue & Send" for send_now.
    *   **Deliverability Safeguards:** Server-side suppression enforcement, queue-based rate limiting, exponential backoff retry, campaign-level pause/resume.

11. **Reply Tracking & Inbound Email Processing:**
    *   **Reply-To Tagging:** Every outbound email includes a tagged reply-to: `adeltorre+lead_{leadId}_email_{emailId}@a3visual.com`. Actual reply delivery goes to Outlook (adeltorre@a3visual.com). Tags are generated in `send-queue.ts` via `generateTaggedReplyTo()`.
    *   **Inbound Email Webhook:** `POST /api/inbound-email` accepts inbound email data from forwarding service or email provider. Flexible field parsing supports multiple provider formats (Resend, SendGrid, Mailgun, etc.).
    *   **Lead Matching:** Three-tier matching: (1) reply-to tag parsing, (2) In-Reply-To header matching against resendMessageId, (3) sender email fallback against lead email. Unmatched emails stored for manual review.
    *   **Reply Processor:** (`artifacts/api-server/src/lib/reply-processor.ts`) Processes inbound emails: creates activity, updates lead engagement (lastRepliedAt, engagementStatus="engaged"), marks scheduled email as replied (repliedAt, replyDetected), creates notification.
    *   **Auto-Pause Sequences:** When a non-auto-reply is detected, all future scheduled/queued emails for that lead are paused with reason "reply_received". Activity logged: "Sequence paused — reply received".
    *   **Auto-Reply Detection:** Detects out-of-office/auto-replies via subject/body pattern matching. Auto-replies create activity but do NOT pause sequences or update engagement status.
    *   **Conversation Thread:** `GET /api/leads/:leadId/conversation` returns chronological thread of outbound (sent) and inbound (reply) messages. Displayed in lead drawer as expandable cards with sent/reply badges.
    *   **Data Model:** `inbound_emails` table (senderEmail, recipientEmail, subject, bodyText, bodyHtml, rawHeaders, inReplyTo, references, matched, matchMethod, isAutoReply). `scheduled_emails` has repliedAt, replyDetected fields.
    *   **UI Indicators:** Green "Replied" badge on lead table rows, "Paused — Reply" badge on scheduled email cards, reply_received/auto_reply_received/sequence_paused activity types in timeline, Conversation section in lead drawer with outbound/inbound cards.
    *   **Manual Reply Logging:** Existing manual "Log Reply" button in activity timeline still works for cases where webhook is not set up.

**Database Schema (Drizzle ORM):**
Key tables include `leads` (with engagement intelligence, lastRepliedAt), `tasks`, `templates`, `assets`, `activity`, `outreach_history`, `scheduled_emails` (with campaignId, resendMessageId, repliedAt, replyDetected, retryCount, queuePosition, fromEmail, replyTo), `notifications`, `lead_engagement_events`, `contacts`, `campaigns`, `sequence_enrollments`, `personalization_logs`, `routing_logs`, `next_actions`, `cta_library`, `bulk_send_campaigns`, and `inbound_emails`.

12. **A3 Partner Portal:**
    *   **Purpose:** Partner intake and internal request management portal for A3 Visual. Enables partners/clients to submit event production requests through branded portal pages, and internal team to manage requests, partners, and pricing.
    *   **Artifact:** `artifacts/a3-partner-portal/` at `/a3-partner-portal/` path, port 20989.
    *   **Admin Side (auth required):**
        - Login: Simple email/password auth (admin@a3visual.com / a3visual2024), stored in localStorage via Zustand.
        - Dashboard: Request summary stats, recent requests, partner list.
        - Partners CRUD: Create/edit partners with slug-based portal URLs, branding options, pricing display toggles.
        - Requests: Searchable/filterable list, detail view with AI summary, internal summary, upsell recommendations, status management, internal notes.
        - Pricing Rules: CRUD table grouped by 6 categories (Printing, Rentals, Design and artwork, Custom fabrication, Immersive experiences, Promotional items).
        - Assets: Library grouped by partner.
    *   **Public Side (no auth):**
        - `/partner/:slug` — Branded portal page with partner intro, YouTube sizzle reel, starting-at pricing, and multi-step intake form (5 steps: Contact & Event, Industry & Use Case, Services, Uploads, Review & Submit).
        - Conditional logic: custom fab/immersive/design warnings, artwork upload reminder.
        - Submission triggers: AI summary via Anthropic (claude-sonnet-4-6), internal summary generation, upsell recommendations, scope estimation, admin email notification via Resend.
    *   **API Routes:** `GET/POST/PUT/DELETE /api/partners`, `GET /api/partners/slug/:slug`, `GET/POST /api/partner-requests`, `PATCH /api/partner-requests/:id/status`, `POST /api/partner-requests/:id/notes`, `GET /api/partner-requests/dashboard/summary`, `GET/POST/PUT/DELETE /api/pricing-rules`.
    *   **Database Tables:** `partners`, `partner_requests`, `request_items`, `request_uploads`, `admin_notes`, `pricing_rules`.
    *   **AI Integration:** Anthropic AI via Replit AI Integrations proxy (env vars: AI_INTEGRATIONS_ANTHROPIC_BASE_URL, AI_INTEGRATIONS_ANTHROPIC_API_KEY). Uses `@anthropic-ai/sdk` directly in `partner-ai.ts`.
    *   **Frontend:** React + Vite + Tailwind + shadcn/ui. Uses direct fetch calls (not generated API hooks) since no changes to api-spec allowed. Zustand for auth state. wouter for routing. framer-motion for transitions.
    *   **Request Statuses:** New, Reviewing, Waiting for files, Waiting for dimensions, Quote prep, Quote sent, Follow up, Closed won, Closed lost.
    *   **Scope Levels:** Small, Medium, High (auto-estimated based on items/categories).

# External Dependencies

-   **Google Sheets:** Bi-directional sync for lead CRM data with a **MASTER CRM** tab.
-   **Resend:** Email delivery service for bulk outreach (connected via Replit integration, sender: admin@universalaestheticawards.com).
-   **Outlook:** Used for individual email sending.
-   **Recharts:** For data visualization.
-   **@hello-pangea/dnd:** For drag-and-drop functionality.
-   **react-hook-form:** For form management.
-   **@hookform/resolvers:** For integrating form validation with Zod.