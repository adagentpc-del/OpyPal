---
name: runTest per-task run cap
description: Why runTest can reject instantly with "Maximum testing iterations (10) reached" and what it actually means
---

# runTest has a per-task cumulative run cap (~10)

The sandbox `runTest` testing callback enforces a cumulative limit of ~10
test-runs **per task**. Once exhausted, every further call rejects almost
instantly (observed 7–10 ms) by throwing:

> Maximum testing iterations (10) reached. Please ask the user if testing should continue.

**Why this is a trap:** the instant rejection looks identical to a test failure,
so it's easy to misread it as a bug in the app, the test plan, or auth. It is
not — no browser run happens at all. Telltale sign: it throws in well under a
second, whereas a real run takes ~30s+.

**How to apply:**
- If `runTest` throws this in milliseconds, stop retrying. It is a quota guard,
  not a code problem. Diagnose timing first (wrap in `Date.now()`).
- The counter is **not** notebook-local: `code_execution` restart (`restart:true`)
  does NOT reset it. It is persisted in opaque platform agent state
  (`.local/state/replit/agent/*.bin`) — do not edit those.
- It does **not** reset just because the user replies or the task is re-opened
  mid-session. It resets in a fresh session/conversation.
- Budget runs accordingly: a multi-test suite consumes one cap slot per
  `runTest` call. Don't burn the budget on debugging one-off probes if you need
  several real flow tests afterward.
