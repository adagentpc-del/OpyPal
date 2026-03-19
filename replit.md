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

### Pipeline (Kanban)
- Drag-and-drop board with 11 stages
- Color-coded cards for Event (blue) vs Agency (yellow)
- Cards show company, contact, deal amount, follow-up date
- Moving cards auto-updates lead status

### Tasks / Follow-Ups
- Task manager linked to leads
- Task types: Follow-up, Call, Send Deck, Proposal, Check-In, Meeting Prep, Post-Meeting Follow-Up
- Filter by due today, overdue, next 7 days
- Mark tasks as complete
- Overdue tasks highlighted in red

### Templates
- Saved outreach templates library
- Categories: Cold Email, Follow-Up Email, LinkedIn Message, SMS, Referral / Partner Outreach
- Copy-to-clipboard, create/edit/delete
- Pre-loaded with 6 starter templates

### Assets
- Asset library with categories: Brochure, Capabilities Deck, Case Study, etc.
- Attach links, searchable
- Can link assets to leads

### Import / Export
- CSV import with column mapping and preview
- Duplicate detection by email + company
- Export leads and tasks to CSV

## Database Schema

Tables in `lib/db/src/schema/`:
- `leads` - CRM lead records
- `tasks` - Tasks/follow-ups linked to leads
- `templates` - Outreach templates
- `assets` - Sales assets/resources
- `activity` - Activity log for dashboard feed

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

## Future-Ready

The codebase is structured to later support:
- Team users / login / auth
- Email sending integration
- Calendar integration
- Reminders
- Proposal tracking expansion
- Partner portals
