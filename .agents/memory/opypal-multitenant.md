---
name: Opypal multi-tenant model
description: How super-admin vs. workspace-admin roles resolve, and the current limit of tenant data isolation.
---

# Opypal workspace / role model

- **Super admin** is an email allowlist (platform operators), resolved server-side from the signed-in Clerk user's email. Super admins are NOT rows in `workspace_members`; they implicitly see and switch into every workspace.
- **Workspace admins** are rows in `workspace_members` (keyed by email; Clerk user id is backfilled on first sign-in). They are scoped to the workspaces they belong to.
- `GET /me` returns `{ email, isSuperAdmin, role, platform, workspaces[] }` and drives the frontend workspace context + switcher in both apps.
- Workspace CRUD and member assignment are super-admin-only; member listing also allows a member of that workspace.

## Partner-portal tenancy (IMPLEMENTED)

All 7 partner-domain tables — `partners`, `partner_assets`, `partner_requests`, `request_items`, `request_uploads`, `admin_notes`, `pricing_rules` — now carry a `workspace_id` FK that is **NOT NULL with no DB default** (the default was used only transiently to backfill, then dropped so the app must always set it explicitly). Existing rows were backfilled to A3 Visual = Workspace 1.

**Enforcement pattern (apply to any new partner-domain table/route):**
- Protected routes chain `requireAuth → resolveWorkspace → requireRole(min)`. `resolveWorkspace` reads the target workspace from `x-workspace-id` (header > query > body); super-admins may target any *existing* workspace, members must be members of it. It sets `req.workspaceId` / `req.workspaceRole`.
- Every read/write/delete filters by `eq(table.workspaceId, req.workspaceId)`. By-id ops put `workspaceId` in the WHERE so a foreign id returns **404** (no row), defeating record-id manipulation. Verified: `partner id=1` is invisible when scoped to ws2.
- Inserts/updates **strip client-supplied `workspaceId`/`id`** from the body and stamp the server-resolved `workspaceId`.
- **Why no DB default:** a silent default would let a forgotten `.workspaceId` write leak rows into ws1. Forcing explicit assignment surfaces the bug at insert time.

**Public (unauthenticated) endpoints derive workspace server-side, never from the client:**
- `GET /partners/slug/:slug` → workspace comes from the fetched partner row; its pricing/assets are filtered by that partner's `workspaceId`.
- `POST /partner-requests` → requires a valid `partnerId` (else 400/404); workspace is taken from the loaded partner record.

**Role model:** `WorkspaceRole` union + `ROLE_RANK {viewer:1, operator:2, manager:3, workspace_admin:4}` + `roleAtLeast()` in `platform.ts`. super_admin bypasses `requireRole`. Gating in use: reads = viewer; request status/notes = operator; partner/pricing/asset config + deletes = manager.

**Frontend:** `api.ts` injects `x-workspace-id` from localStorage `opypal_pp_current_workspace`; `use-workspace.tsx` persists the resolved id *before* scoped queries run and calls `queryClient.clear()` on switch; `App.tsx` `WorkspaceGate` blocks admin render until a workspace resolves (and shows "no workspace access" for a member with 0 workspaces).

## Remaining gap (NOT yet workspace-scoped)
The **CRM / sales-os domain** tables (leads, contacts, companies, campaigns, scheduled_emails, activity, settings, mailbox_connections, bulk_send_campaigns, suppression_list, inbound_emails, etc.) have NO `workspace_id` and are still single-tenant (implicitly A3 Visual). Same migration + enforcement pattern would be needed to isolate them.
