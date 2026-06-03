---
name: Opypal API constraints
description: Hard constraints and the established pattern for adding endpoints in the Opypal monorepo.
---

# Opypal API constraints

- **NEVER edit `lib/api-spec` or `lib/api-zod`.** These are generated/contract packages and are off-limits.
  **Consequence:** the generated `@workspace/api-client-react` hooks cannot be extended for new endpoints, and it carries pre-existing codegen breakage (e.g. `SendLog`/asset `*Body` members missing) that surfaces as `tsc` "no exported member" errors. These are pre-existing and do NOT block Vite (esbuild transpiles without typechecking).
  **How to apply:** for new endpoints, define request validation with inline Zod inside the route file, and add a raw-`fetch` + react-query client module on the frontend (`src/lib/campaign-api.ts`) instead of regenerating the client.

- **Auth is cookie-based via the proxy.** Raw `fetch` needs no Authorization header; a fetch-interceptor stamps `x-workspace-id` from localStorage. `<img>`/`<a>` requests carry cookies but NOT that header.

- **TS7030 "not all code paths return"** is an accepted convention across the Express routes (bulk-send.ts, assets.ts, etc.); matching it is fine.
