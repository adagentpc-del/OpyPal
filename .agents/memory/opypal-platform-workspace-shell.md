---
name: Opypal platform/workspace two-level shell
description: How the super-admin platform shell vs white-label workspace shell is selected and kept in sync with the route.
---

# Two-level navigation shell (Opypal a3-sales-os)

Super admins have a PLATFORM shell (`/platform/*`, platform sidebar) and a
WORKSPACE shell (white-label sidebar). Non-super-admins must NEVER see the
platform shell.

## Rules / decisions
- The **route is the source of truth** for which shell renders, not persisted
  scope alone. `AppLayout` derives `isPlatform` from the path: any `/platform/*`
  page is always the platform shell. `/users` and `/access` are *shared* pages
  reused by both shells — they follow the active `scope`.
  **Why:** trusting persisted `opypal_scope` alone let a super admin open
  `/platform/*` while scope was "workspace" and get the wrong (workspace) shell.
- `use-workspace` runs a **route→scope sync effect** (super admins only): on
  `/platform/*` it forces scope "platform"; on any non-shared, non-root route it
  forces "workspace"; `/`, `/users`, `/access` are neutral and keep current scope.
  **Why:** keeps the shared pages and the `/` redirect consistent after a reload
  or deep link where persisted scope disagrees with the URL.
- `effectiveScope` in the provider forces "workspace" for non-super-admins, so a
  regular user can never be in platform scope.
- Super admins with **zero workspaces** must never hit "No workspace access":
  `SignedInHome` redirects them to `/platform` when scope is platform OR they
  have no workspaces; and `/users` + `/access` use `RequireWorkspaceOrSuper`
  (super admins bypass the workspace requirement). **How to apply:** any new
  cross-workspace page reused in the platform sidebar should use
  `sharedRoute`/`RequireWorkspaceOrSuper`, not `protectedRoute`.
- White-label theming: `useApplyWorkspaceTheme` sets `--primary/--ring/
  --sidebar-primary/--sidebar-ring` from the workspace `primaryColor` (hex→HSL
  triplet) only in the workspace shell, and removes them on the platform shell +
  on cleanup so brand color never bleeds across shells.
