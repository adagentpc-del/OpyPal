---
name: Stale lib/db/dist causes phantom typecheck errors
description: Why `tsc --noEmit` reports "no exported member" for tables that exist in source
---

# Phantom "@workspace/db has no exported member" typecheck errors

Running `tsc --noEmit` (the `typecheck` script) in consuming packages
(`api-server`, `a3-sales-os`) can report errors like
`Module '"@workspace/db"' has no exported member 'leadsTable' / 'workspacesTable'`
for tables that clearly exist and are exported from `lib/db/src/schema/*`.

**Root cause:** `lib/db/package.json` `exports` point at the TypeScript source
(`./src/index.ts`), but a **stale committed `lib/db/dist/index.d.ts`** also
exists and predates many tables. TypeScript's type resolution can prefer the
stale `.d.ts`, so it reports core, long-standing tables as missing. `lib/db`
has **no build script**, so the dist is never regenerated — it is vestigial.

**Why it's misleading:** runtime is unaffected. `tsx` (api-server) and `vite`
(frontends) use esbuild and do **not** typecheck, so the app boots, seeds run,
and routes work fine even while `typecheck` fails wholesale.

**How to apply:**
- Before blaming your own change for a flood of `@workspace/db has no exported
  member` errors, check whether the *same* errors hit tables you never touched
  (e.g. `leadsTable`, `tasksTable`). If so, it's this pre-existing drift, not you.
- The companion symptom in frontends — missing generated hooks like
  `getGetLeadsQueryKey`, `useGetTemplates` from `@workspace/api-client-react` —
  is separate stale codegen from `lib/api-spec` (do NOT hand-edit; it's a hard
  constraint). Both are project-wide drift, not task regressions.
- A real fix would be regenerating/removing the stale `lib/db/dist` and
  re-running api-spec codegen, but that's infra cleanup — out of scope for
  feature work and not required for the app to run.
