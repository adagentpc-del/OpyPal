---
name: Opypal branding & white-label model
description: The platform naming hierarchy and where branding strings must be sourced from
---

# Opypal white-label naming model

Hierarchy (use these exact labels in UI/product copy):
- **Platform**: `Opypal` — what a super admin sees across all tenants.
- **Foundation**: `Opypal Core` — the shared technical platform / back-end.
- **Tenant / Account**: `Workspace` — white-labelled per tenant.
- **Workspace 1 (Tenant 1)**: `A3 Visual`.

**Why:** The product was originally "A3 Sales OS" but pivoted to a multi-tenant white-label platform. "A3 Sales OS" must no longer name the whole platform — it now refers only to the CRM module inside the A3 Visual workspace. Legacy build prompts in `attached_assets/` keep the old name on purpose (migration history).

**How to apply:**
- Never hardcode `A3 Visual`, `Opypal`, or `Opypal Core` as UI string literals. Source them from each frontend's `src/config/branding.ts` (`PLATFORM` + `CURRENT_WORKSPACE`). Both `a3-sales-os` and `a3-partner-portal` have their own copy.
- `CURRENT_WORKSPACE` is a static single-workspace constant today; super-admin workspace switching will later swap it per tenant, so any literal you hardcode now will leak across workspaces.
- Requirement nuance: A3 users SHOULD see A3 Visual (workspace) branding inside their workspace; the platform name "Opypal" appears as a subtle "Powered by Opypal" / "Opypal Core" treatment, plus the super-admin level.
- Remaining (not yet built): real `workspaces` table + tenant_id isolation on CRM data, super-admin role + workspace switcher backend, per-workspace settings/branding loaded dynamically.

**Constraint:** Do NOT edit `lib/api-spec/` (incl. `openapi.yaml`) — standing user preference in `replit.md`. The API spec description still reads "A3 Sales OS API" deliberately for this reason; change it only if the user lifts that restriction (then re-run `pnpm --filter @workspace/api-spec run codegen`).
