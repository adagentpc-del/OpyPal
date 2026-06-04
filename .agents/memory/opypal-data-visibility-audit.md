---
name: Opypal perceived data-loss = workspace scoping, not deletion
description: How to triage "my templates/emails/uploads are gone" reports in Opypal; where the real data lives and forensic checks that prove deletion vs hidden.
---

# Perceived data loss in Opypal is almost always workspace-scoping, not deletion

**Symptom:** super-admin reports templates / sent emails / uploads "wiped" after the
workspace + white-label updates.

**Reality (verified):** all real data lives in **workspace id 1 = "A3 Visual"**
(slug `a3-visual`), correctly stamped `workspace_id=1`, original April-2026 seed
timestamps, `is_active=true`. The newer workspaces (Move Mi=2, StrataLogic=3,
Alyssa Advisory=4) are mostly empty / freshly seeded.

**Why it looks empty:**
- Super-admin `alyssadeltorre@gmail.com` is **not** a `workspace_members` row; `/api/me`
  returns all workspaces *only because* `isSuperAdmin` short-circuits membership.
- Frontend `scope` defaults to **"platform"** (localStorage `opypal_scope`), so a
  super-admin lands on the platform shell, away from workspace data.
- Current workspace is pinned by localStorage `opypal_current_workspace`; if it points
  at an empty workspace (2/3/4) the workspace shell shows nothing.
- Every query is workspace-scoped by `resolveWorkspace` middleware reading
  `x-workspace-id`. No header (currentId null) → super-admin gets **400 "Workspace
  context required"**; wrong id → that workspace's (empty) data.
- Fix to *see* the data: select / enter the **A3 Visual** workspace. No DB change needed.

**Forensic checks (read-only) that distinguish DELETED vs NEVER-EXISTED vs HIDDEN:**
- Per-table `count(*)` grouped by `workspace_id` incl. NULLs → finds mis-scoped/orphaned rows.
- ID sequence `last_value` + **`is_called`** (`SELECT last_value,is_called FROM <table>_id_seq`):
  `is_called=false` ⇒ the table has **never** had a row inserted (not a deletion).
  In this project `scheduled_emails`, `send_logs`, `outreach_history`, `email_events`,
  `contacts` all had `is_called=false` → "sent email history" never existed in DB.
- Compare row `created_at` against the suspected migration/boot date: April timestamps on
  A3 Visual rows prove the June boot seeders never reseeded/clobbered them.

**Boot seeders are safe (idempotent, never destructive to existing data):**
- `seed-templates-on-boot.ts` seeds workspace 1 only when empty (`existingTemplates.length===0`),
  others via `onConflictDoNothing`.
- `seed-workspace-templates-on-boot.ts` targets only slugs `move-mi`, `stratalogic`,
  guarded by per-workspace "seed only if none exist"; the only delete is admin-safe
  category reconciliation. No SQL migration files exist — schema is drizzle-push.
