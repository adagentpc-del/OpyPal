---
name: Sales OS workspace RBAC conventions
description: Role model, super-admin allowlist, and cross-workspace request conventions for a3-sales-os + api-server
---

## Role model
- Workspace roles ranked: `workspace_admin` > `manager` > `operator` > `viewer`. Above all, `super_admin` is granted only by an allowlist (email), never stored as a workspace_members row's role.
- Capability matrix is defined twice on purpose: server (`api-server/src/lib/platform.ts`) and client mirror (`a3-sales-os/src/lib/permissions.ts`). **Keep them in sync** — the client copy is only for UI gating; the server copy is the real enforcement.
- Member access: `clerk-auth.ts` excludes `status = 'suspended'` memberships when building the auth context, so suspending = immediate access denial. Enforcement happens at context-load, not per-route.

## Cross-workspace requests (super-admin)
- The frontend `fetch-interceptor` injects `x-workspace-id` **only when the header is absent**.
- **Rule:** super-admin actions that target a workspace other than the active one (e.g. the global Users page editing a member in another workspace) must set `x-workspace-id` explicitly on the request, or they'll be scoped to the wrong workspace.

## Route guarding gotcha
- All api-server routers mount at `/api` with no path prefix via `router.use(subRouter)`. A catch-all middleware inside one router (e.g. `outbound.ts`) therefore runs for sibling routes too. Public webhook/track paths must be exempted by checking `req.path` (see `isPublicMixedRoutePath`).
- Sensitive control-plane endpoints need explicit `requireRole(...)` even if they sit behind scoped auth — e.g. scheduler start/stop are `workspace_admin`-gated; the `/workspaces/:id/members` listing is `workspace_admin`-gated (membership alone is not enough for user-management surfaces).
