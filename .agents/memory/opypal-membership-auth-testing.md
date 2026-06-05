---
name: Opypal membership & assign-eligibility (auth/testing)
description: Non-obvious gotchas when seeding workspace_members and testing /segments/assign eligibility.
---

# workspace_members email is matched lowercased
The Clerk auth middleware resolves the caller's email and `.toLowerCase()`s it, then
looks up `workspace_members` by `eq(email, lowercased)`. Any membership row you seed
for a test/user MUST be inserted lowercase or access silently fails with the
"No workspace access" gate even though the row exists.
**Why:** cost two failed UI-test runs inserting a mixed-case nanoid email.
**How to apply:** seed `INSERT ... VALUES (..., lower('<email>'), ...)`, or pick a
fully-lowercase login email. Memberships are re-queried every request (only the
userId→email map is cached 5 min), so a page reload after the insert is enough — no
server restart needed.

# Contact send-eligibility "eligible" vs "skipped"
A contact is eligible for either `/segments/assign` (sequence enroll) or
`/contacts/bulk-send` (single scheduled_email) ONLY when its `sequence_status` is
NOT in the stopped set [paused_replied,paused_manual,do_not_contact,unsubscribed,
bounce] AND NOT in the active set [active,pending,enrolled,in_progress,scheduled].
So 'pending' is SKIPPED (counts as in-pipeline). Eligible = null/'completed'/etc.
**How to apply:** to seed an "eligible" contact for assign tests use status
'completed' (null may be coerced back by a column default), and 'active' to test the
no-double-send skip path.
