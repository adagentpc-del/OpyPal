---
name: lib/db composite build + DDL workflow
description: How schema changes in lib/db propagate to consumers, and how to apply DDL in this environment
---

## lib/db is a TS composite project consumed via project references
- `@workspace/db` (lib/db) is built as a TypeScript composite project. Consumers like `artifacts/api-server` resolve its types through project references → the emitted `dist/*.d.ts`, NOT the source.
- **Rule:** after editing a schema/type in `lib/db/src`, you MUST rebuild its dist or consumers typecheck against stale types: `pnpm --filter @workspace/db exec tsc --build --force`.
- **Why:** runtime (tsx) reads `src` directly so the app *runs* with new columns immediately, which masks the problem — only `tsc` against consumers reveals the stale `.d.ts`. This split caused confusing "column missing from type" errors despite the DB and runtime being correct.

## Applying DDL
- `drizzle-kit push` is interactive in this environment and blocks the agent. Do not use it for unattended DDL.
- **How to apply:** run raw SQL with `psql "$DATABASE_URL" -c "ALTER TABLE ..."`. Defaults backfill existing rows (e.g. add `status` with `DEFAULT 'active'`).

## api-server runtime
- api-server runs via `tsx` (no runtime typecheck). Code edits require a workflow restart to reload.
- `pnpm --filter @workspace/api-server run typecheck` currently reports ~150 PRE-EXISTING errors concentrated in legacy files (`outlook-graph.ts`, `personalization.ts`, `resend.ts`, `seed-templates-on-boot.ts`). These are baseline tech debt, unrelated to new work — don't be alarmed; just confirm your touched files aren't in the error list.
