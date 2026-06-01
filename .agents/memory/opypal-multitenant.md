---
name: Opypal multi-tenant model
description: How super-admin vs. workspace-admin roles resolve, and the current limit of tenant data isolation.
---

# Opypal workspace / role model

- **Super admin** is an email allowlist (platform operators), resolved server-side from the signed-in Clerk user's email. Super admins are NOT rows in `workspace_members`; they implicitly see and switch into every workspace.
- **Workspace admins** are rows in `workspace_members` (keyed by email; Clerk user id is backfilled on first sign-in). They are scoped to the workspaces they belong to.
- `GET /me` returns `{ email, isSuperAdmin, role, platform, workspaces[] }` and drives the frontend workspace context + switcher in both apps.
- Workspace CRUD and member assignment are super-admin-only; member listing also allows a member of that workspace.

**Current isolation limit (known gap, not a bug to "fix" silently):** the partner-portal domain tables (partners, partner_requests, pricing_rules) have NO `workspace_id` column. All partner data implicitly belongs to A3 Visual = Workspace 1. So a workspace admin who signs in sees the single shared A3 Visual dataset; there is no per-workspace partner data yet. True data tenancy for these tables would require a schema migration (add workspace_id FK + backfill + filter every query by `req.authContext` memberships/super-admin). Treat that as a deliberate future scope item, not an oversight.
