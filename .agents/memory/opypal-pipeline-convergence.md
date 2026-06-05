---
name: Opypal pipeline convergence (leads + contacts)
description: How the two outreach pipelines were unified, and the two invariants that keep them correct.
---

# Two-pipeline convergence

Opypal runs two parallel outreach engines:
- **Leads** → `scheduled_emails` rows fired by the background-scheduler.
- **Contacts** → `sequence_steps` driven by `sequence/process`.

These were converged behind one lifecycle status model (`lifecycle-status.ts`
on the API, `lib/lifecycle.ts` on the FE → `deriveLifecycleStatus`) and a
unified queue view. `scheduled_emails` was made additive-capable of holding
either (`contact_id` added, `lead_id` nullable).

## Invariant 1 — never double-send a contact
`/segments/assign` (routes/segments-ops.ts) creates `scheduled_emails` to
converge records. It MUST skip contacts already running through the sequence
engine — statuses `active`/`pending`/`enrolled`/`in_progress`/`scheduled` — in
addition to stopped statuses (replied/paused/DNC/unsub/bounce). Otherwise both
`sequence/process` AND the background-scheduler fire for the same contact.
**Why:** the two engines are independent; only contacts NOT currently owned by
the sequence engine may converge through scheduled_emails.
**How to apply:** any new code that auto-creates scheduled_emails for contacts
must replicate this skip set.

## Invariant 2 — reply matching must be workspace-scoped
reply-processor.ts falls back to matching inbound mail by sender email when no
threading header matches. That email lookup (both lead-by-email and
contact-by-email) MUST be scoped by `data.workspaceHint` when present; only fall
back to an unscoped lookup when there is no hint.
**Why:** the same email can exist in multiple tenants; an unscoped match pauses
the wrong workspace's records.
**How to apply:** any new sender-based matching path needs the same scoping.

## Segment assignment enrolls full sequences (contacts)
`/segments/assign` now enrolls eligible non-active contacts into the FULL
multi-step sequence (creates a sequence_enrollment + sequence_steps cadence via
the sequence engine), not a single scheduled_emails row. Template set resolves
in priority: payload templateSetId → passed template's linkedTemplateSetId →
contact.templateSetId; with no set it falls back to the default delay cadence
and seeds step 1 with the composed subject/body. Leads still use scheduled_emails
(no sequence engine). Invariant 1 still holds: active/pending/enrolled contacts
are skipped, and because contacts now go through sequence_steps (not
scheduled_emails) only the sequence engine owns them — no background-scheduler
double-send.
