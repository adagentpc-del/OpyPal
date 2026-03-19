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
- Full CRM table with sortable columns, search, and filters
- Filter by pipeline type, status, project type, source, location, follow-up due today, overdue
- Add/edit/delete/duplicate leads via modal
- Quick status change
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

### Assets
- Asset library (stored locally, not in Google Sheets)
- Categories: Brochure, Capabilities Deck, Case Study, etc.
- Attach links, searchable

### Import / Export
- CSV import with column mapping and preview
- Duplicate detection by email + company
- Export leads and tasks to CSV
- Imported leads are synced to Google Sheets

## Database Schema

Tables in `lib/db/src/schema/`:
- `leads` - CRM lead records (synced with Google Sheets MASTER CRM tab)
- `tasks` - Tasks/follow-ups linked to leads (local only)
- `templates` - Outreach templates (local only)
- `assets` - Sales assets/resources (local only)
- `activity` - Activity log for dashboard feed (local only)

## API Routes

All routes are in `artifacts/api-server/src/routes/`:
- `GET/POST /api/leads` - List/create leads
- `GET/PUT/DELETE /api/leads/:id` - CRUD individual leads
- `POST /api/leads/:id/duplicate` - Duplicate a lead
- `PATCH /api/leads/:id/status` - Quick status update
- `POST /api/leads/import` - Bulk CSV import
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
