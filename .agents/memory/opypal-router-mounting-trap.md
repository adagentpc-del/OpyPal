---
name: Opypal API router-mounting / auth pass-through trap
description: Why a path-less router.use(gate) leaks onto sibling routers, and why per-request Clerk getUser caused spurious 401s
---

# All scoped routers mount at root "/" — middleware leaks across them

In the api-server, every workspace-scoped router is mounted with
`router.use(...scoped, someRouter)` at the SAME root path `/`. Express runs every
mounted router's middleware chain for every request until one sends a response.

**Consequence:** a path-less `router.use(mw)` inside ANY of those routers runs on
ALL API traffic that flows through before reaching its real router — not just that
router's own paths.

**Why this bites:** a blanket `router.use(requireRole("workspace_admin"))` placed
to protect the members routes silently gated the ENTIRE API: any operator/manager
got 403 on `/campaigns/*`, `/leads`, etc., because the members router sits ahead of
them in the mount order and 403s non-admins before the request ever reaches its
intended router.

**How to apply:** when gating a whole router, ALWAYS scope it to that router's path
prefix — `router.use("/members", requireRole(...))` — or attach the gate per-route.
Never use a path-less `router.use(<auth/role gate>)` in a router that's mounted at
root alongside siblings. The mixed routers (outbound, gmail, etc.) already follow
this by exempting pass-through paths in their gates.

# Per-request Clerk getUser → spurious 401 bursts

`loadAuthContext` resolves the caller's email via `clerkClient.users.getUser` on
EVERY request. A single page load fires many parallel API calls, so this produced
a burst of concurrent Clerk lookups; under that burst Clerk transiently
fails/rate-limits and the catch returns 401 — even though `/api/me` (one call)
succeeded moments earlier. Symptom: intermittent 401 on data endpoints while
`/api/me` is 200.

**Fix in place:** userId→email is cached (TTL) with in-flight coalescing and a
stale-value fallback on transient failure, so each user costs ~one Clerk lookup per
window instead of one per request.

**How to apply:** don't call a rate-limited external identity API once per request
behind a fan-out UI; cache + coalesce. The verified session already yields userId
without a network call — only the email needs Clerk.
