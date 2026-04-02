# Workspace

## Overview

A3 Sales OS - Internal sales CRM and outbound operating system for A3 Visual. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts
- **Drag & Drop**: @hello-pangea/dnd
- **Forms**: react-hook-form + @hookform/resolvers
- **Google Sheets**: googleapis (Replit Google Sheets connector)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── a3-sales-os/        # React + Vite frontend (port 22440)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
│   └── src/seed.ts         # Database seed script
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Google Sheets Integration

Lead CRM data syncs bidirectionally with a Google Sheet's **MASTER CRM** tab.

### How it works
- **Read**: On startup, if the local DB has no leads, the app seeds from the MASTER CRM tab
- **Write**: Every lead create, update, status change, duplicate, and delete is synced to the sheet in the background
- **Full sync**: POST `/api/sync/full` pushes all DB leads to the sheet
- **Seed**: POST `/api/sync/seed` pulls leads from sheet into empty DB
- **Status**: GET `/api/sync/status` returns current sync status (connected/syncing/error/disconnected)

### Key files
- `artifacts/api-server/src/lib/google-sheets.ts` — Google Sheets API client (Replit connector auth)
- `artifacts/api-server/src/lib/sheets-sync.ts` — Sync service (read/write/delete/seed/full-sync)
- `artifacts/api-server/src/routes/sync.ts` — Sync API endpoints

### Sheet column mapping
App ID | Pipeline Type | Company Name | Contact Name | Title | Email | Phone | LinkedIn | Location | Industry | Venue / Property | Project Type | Estimated Budget | Status | Last Contact Date | Next Step | Next Follow-Up Date | Notes | Deal Value Estimate | Proposal Value | Close Probability | Forecast Value | Source

### What stays in local DB only
- Tasks / Follow-Ups
- Message Templates
- Marketing Assets
- Activity feed

### Environment variables
- `GOOGLE_SPREADSHEET_ID` — The Google Sheets spreadsheet ID (set via Replit env vars)

## Application Features

### Dashboard
- KPI cards: Total Leads, Active Leads, Pipeline Value, Meetings Booked, Overdue Follow-ups
- Pipeline by Stage bar chart
- Pipeline by Type pie chart
- Recent activity feed
- Upcoming tasks panel

### Leads / CRM
- Clean CRM table with essential columns: Company, Contact, Phone, Email, Location, Pipeline, Status, Next Step, Follow-Up, Source
- Additional details (Title, Industry, Venue, Project Type, Budget, Deal fields, LinkedIn, Notes) in lead detail drawer under collapsible section
- Click any row to open lead detail drawer (right-side panel)
- Lead drawer has 5 sections: Contact Info, CRM Status, Outreach, Outreach History, Additional Details
- Outreach section: template selector, editable email preview with placeholder substitution, asset attachment selector, Copy Email, Send via Outlook, Mark as Contacted
- Asset selector shows uploaded assets from Assets page, with Capabilities Deck badge; assets with URLs included in email body
- Outreach History: logged sent emails with template used, subject, body, assets selected, sender, timestamp
- Post-send confirmation: "Did you send this email?" → Yes saves outreach_history record + updates lead status
- outreach_history table: leadId, actionType, templateName, subject, body, assets, sender, sentAt
- New Lead modal simplified: Company, Contact, Phone, Email, Location, Pipeline, Source
- Edit mode in drawer shows all fields organized by section
- Filter by pipeline, status, source, due today, overdue
- Quick status change dropdown in table
- Auto-calculated forecast value (proposalValue or dealValueEstimate * closeProbability)
- Sync status indicator badge (Connected / Syncing / Error / Disconnected)
- All lead mutations sync to Google Sheets MASTER CRM tab

### Outreach Queue
- Daily outbound execution workspace with 4 views: New Imports, Due Today, Overdue, Awaiting Reply
- Smart lead cards showing company, contact, title, email, pipeline, status, next step, follow-up, source
- Draft generation from templates with placeholder substitution ([First Name], [Company Name], etc.)
- Draft preview, edit, copy, and Send via Outlook with post-send confirmation
- Quick follow-up actions: Tomorrow, 2 business days, Next week, Custom date
- Snooze (push 1 business day) and Skip (hide from queue)
- Batch actions: Generate Drafts, Mark as Contacted, Set Follow-Up, Export
- Sorting: newest imported, oldest follow-up, highest value, pipeline type
- Filtering: pipeline, source, status, location
- Priority highlighting: red for overdue, yellow for due today, ZoomInfo badge for prioritized imports
- Drafts stored in browser localStorage (keyed by lead ID)

### Pipeline (Kanban)
- Drag-and-drop board with 11 stages
- Color-coded cards for Event (blue) vs Agency (yellow)
- Cards show company, contact, deal amount, follow-up date
- Moving cards auto-updates lead status and syncs to Google Sheets

### Tasks / Follow-Ups
- Task manager linked to leads (stored locally, not in Google Sheets)
- Task types: Follow-up, Call, Send Deck, Proposal, Check-In, Meeting Prep, Post-Meeting Follow-Up
- Filter by due today, overdue, next 7 days
- Mark tasks as complete
- Overdue tasks highlighted in red

### Templates
- Saved outreach templates library (stored locally, not in Google Sheets)
- Categories: Cold Email, Follow-Up Email, LinkedIn Message, SMS, Referral / Partner Outreach
- Copy-to-clipboard, create/edit/delete
- Template-asset linking: templates can have linked default assets (linkedAssetIds column, comma-separated IDs)
- "Initial Outreach + A3 Deck" template pre-built with A3 Visual Capabilities Deck linked
- When template with linked assets is selected in lead drawer: assets auto-selected, [A3_CAPABILITIES_DECK_LINK] placeholder replaced with "View our capabilities deck: [URL]" (or fallback text if no URL)
- Template cards show "Linked Assets" section with asset names and URL status
- Template edit modal includes Linked Assets checkbox list

### Assets
- Asset library (stored locally, not in Google Sheets)
- Categories: Brochure, Capabilities Deck, Case Study, etc.
- Attach links, searchable

### Import / Export
- CSV import requires only 5 columns: Company Name, Contact Name, Phone, Email, Location
- Auto-fills: Source=ZoomInfo, Status=New Lead, NextStep=Initial outreach, NextFollowUpDate=tomorrow (next business day)
- Auto-infers Pipeline (Event vs Agency) from company name, title, industry keywords
- Smart header matching with aliases (e.g. "Company" → companyName, "Job Title" → title)
- Duplicate detection: matches by email OR (companyName + contactName)
- Shows required field mapping status with colored badges
- Preview first 5 rows before import
- Import summary card: rows uploaded, imported, duplicates skipped
- Export leads and tasks to CSV
- Imported leads are synced to Google Sheets

## Outbound Sequence Engine (Phase 2)

### Architecture
- 7-step automated email sequence: Day 0 (cold), Day 3, 7, 14, 30 (follow-ups), Day 120, 180 (reactivation)
- Business day calculation for scheduling
- Daily send cap, send window (8am-6pm default), business days only
- Placeholder replacement: [First Name], [Company Name], [Company], [Title], [Location]
- Template-based step content from Cold Email and Follow-Up Email template categories

### Contact Lifecycle
- Statuses: pending → active → completed, paused, paused_replied, dnc
- Enroll: creates 7 sequence steps with personalized content from templates
- Pause: suspends scheduled steps
- Resume (from paused): reschedules paused steps
- Resume (from replied/completed/dnc): full re-enrollment with new steps
- Skip step: advances to next step
- Force send: immediately "sends" current step
- Mark replied: pauses sequence, records reply
- Mark DNC: cancels all steps, flags contact

### CSV Upload Flow
1. Upload CSV → auto-map headers → preview
2. Select campaign, sequence, auto-enroll option
3. Import: validates emails, deduplicates, creates contacts
4. Auto-enroll: creates 7 template-based steps per contact with personalized content

### Frontend Pages
- `/ob/upload` - CSV Upload with preview, campaign/sequence selection
- `/ob/contacts` - Contact table with search, filters, inline actions (pause/resume/skip/force/reply/dnc)
- `/ob/campaigns` - Campaign CRUD cards
- `/ob/sequences` - Sequence definition cards showing 7-step structure
- `/ob/queue` - Sequence queue with scheduled/sent/error filters + Process Queue button
- `/ob/replies` - Replied contacts with re-enroll option
- `/ob/analytics` - 10 KPI cards, campaign/step breakdowns, recent send log, settings modal

### Settings (configurable via Analytics page)
- `daily_send_cap` (default 50)
- `send_window_start` (default 8)
- `send_window_end` (default 18)
- `business_days_only` (default true)

## Database Schema

Tables in `lib/db/src/schema/`:
- `leads` - CRM lead records (synced with Google Sheets MASTER CRM tab)
- `tasks` - Tasks/follow-ups linked to leads (local only)
- `templates` - Outreach templates (local only)
- `assets` - Sales assets/resources (local only)
- `activity` - Activity log for dashboard feed (local only)
- `outreach_history` - Logged sent emails per lead (leadId, actionType, templateName, subject, body, assets, sender, sentAt)
- `contacts` - Outbound contacts with sequence tracking (fullName, company, email, sequenceStatus, currentStep, etc.)
- `campaigns` - Campaign definitions (name, description, isActive)
- `template_sets` - Named sequence configurations
- `sequence_steps` - Individual steps per contact (stepNumber, delayDays, subject, body, status, scheduledFor)
- `send_logs` - Email send history (contactId, stepNumber, subject, status, sentAt)
- `imports` - Import history (fileName, totalRows, importedRows, skippedRows)
- `settings` - Key-value settings (daily_send_cap, send_window_start, etc.)

## API Routes

All routes are in `artifacts/api-server/src/routes/`:

### Phase 1 (CRM)
- `GET/POST /api/leads` - List/create leads
- `GET/PUT/DELETE /api/leads/:id` - CRUD individual leads
- `POST /api/leads/:id/duplicate` - Duplicate a lead
- `PATCH /api/leads/:id/status` - Quick status update
- `POST /api/leads/import` - Bulk CSV import
- `GET /api/leads/:id/history` - Get outreach history
- `POST /api/leads/:id/history` - Log outreach action
- `GET/POST /api/tasks` - List/create tasks
- `PUT/DELETE /api/tasks/:id` - Update/delete tasks
- `PATCH /api/tasks/:id/complete` - Mark task complete
- `GET/POST /api/templates` - List/create templates
- `PUT/DELETE /api/templates/:id` - Update/delete templates
- `GET/POST /api/assets` - List/create assets
- `PUT/DELETE /api/assets/:id` - Update/delete assets
- `GET /api/dashboard` - Dashboard KPIs
- `GET /api/activity` - Recent activity feed
- `GET /api/sync/status` - Google Sheets sync status
- `POST /api/sync/test` - Test Google Sheets connection
- `POST /api/sync/full` - Full sync all leads to sheet
- `POST /api/sync/seed` - Seed DB from sheet (if empty)

### Phase 2 (Outbound Engine)
- `GET/POST /api/contacts` - List/create contacts
- `GET/PUT/DELETE /api/contacts/:id` - CRUD contacts
- `POST /api/contacts/:id/enroll` - Enroll contact in 7-step sequence
- `POST /api/contacts/:id/pause` - Pause sequence
- `POST /api/contacts/:id/resume` - Resume paused / re-enroll replied/completed
- `POST /api/contacts/:id/skip-step` - Skip current step
- `POST /api/contacts/:id/force-send` - Force send current step
- `POST /api/contacts/:id/mark-replied` - Mark as replied (pauses sequence)
- `POST /api/contacts/:id/mark-dnc` - Mark do not contact
- `GET /api/contacts/:id/steps` - Get sequence steps for contact
- `GET/POST /api/campaigns` - List/create campaigns
- `PUT/DELETE /api/campaigns/:id` - Update/delete campaigns
- `GET/POST /api/template-sets` - List/create sequence definitions
- `PUT/DELETE /api/template-sets/:id` - Update/delete sequences
- `GET /api/sequence/queue` - Get sequence queue (filterable)
- `POST /api/sequence/process` - Process due sequence steps (scheduler)
- `GET /api/send-logs` - Get send history
- `GET /api/imports` - Get import history
- `POST /api/imports/upload` - Import contacts from CSV
- `GET /api/outbound-analytics` - Outbound analytics dashboard data
- `GET/PUT /api/outbound-settings` - Get/update outbound settings

## Dropdown Values (Customizable)

**Pipeline Types:** Event, Agency
**Project Types:** Event Activation, Conference, Hotel Event, Brand Activation, Experiential Install, Fabrication, Large Format Printing, Projection Mapping, Ongoing Partnership
**Statuses:** New Lead, Contacted, Replied, Qualified, Meeting Booked, Meeting Completed, Proposal Sent, Negotiation, Closed Won, Closed Lost, Nurture
**Sources:** ZoomInfo, LinkedIn, Referral, Website, Cold Call, Email, Existing Relationship, Other
**Task Types:** Follow-up, Call, Send Deck, Proposal, Check-In, Meeting Prep, Post-Meeting Follow-Up
**Template Categories:** Cold Email, Follow-Up Email, LinkedIn Message, SMS, Referral / Partner Outreach
**Asset Categories:** Brochure, Capabilities Deck, Case Study, Proposal Example, Photos / Completed Work, Brand Assets, Outreach Docs

## Color Theme

The color palette (blue, yellow, black, white) is defined in `artifacts/a3-sales-os/src/index.css` as CSS custom properties in HSL format.

## Commands

- `pnpm --filter @workspace/scripts run seed` - Seed database with demo data
- `pnpm --filter @workspace/api-spec run codegen` - Regenerate API client code
- `pnpm --filter @workspace/db run push` - Push schema changes to database
- `pnpm run typecheck` - Full workspace typecheck
- `pnpm run build` - Build all packages

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array
