---
name: Opypal campaign builder
description: Durable design decisions for the multi-segment campaign builder in a3-sales-os + api-server.
---

# Campaign builder (multi-segment) decisions

- **Segments target LEADS, not contacts.**
  **Why:** the send pipeline is lead-based (`scheduled_emails.lead_id` FK → leads, driven by bulk-send-engine). Contacts have no working send path. Audience resolution matches contact-type labels against lead `contact_type`/`industry`/`project_type` (case-insensitive) so existing data is targetable before explicit tagging.
  **How to apply:** any new segment targeting/criteria must resolve to leads and feed the existing bulk-send/scheduled_emails path tagged with `campaignId`.

- **Private object serving (`GET /storage/objects/*`) must be auth + workspace gated.**
  **Why:** it streams from `PRIVATE_OBJECT_DIR`; serving it unauthenticated leaks files cross-workspace. Browsers fetch these via `<img>`/`<a>` (cookies flow automatically; no `x-workspace-id` header), so the workspace is derived from the `campaign_assets` row whose `objectPath` matches, then checked against `req.authContext.memberships` (super admin bypasses). Objects with no asset row are not served.
  **How to apply:** never serve `PRIVATE_OBJECT_DIR` publicly; gate by looking up the owning record and checking membership.

- **Send windows are stored as integer minutes-since-midnight.**
  **Why:** schema columns `sendWindowStart`/`sendWindowEnd` are integers, but the UI sends `HH:MM` from `<input type="time">`. Backend coerces via a `toMinutes()` helper on every write; frontend converts back with `minutesToTime()` for display.
  **How to apply:** coerce time inputs at the API boundary; don't pass `HH:MM` strings into integer columns.

- **Schedules must reference a segment.**
  **Why:** the schedule run path resolves its audience from the segment, so a segment-less ("whole campaign") schedule can never execute. Creation rejects null `segmentId`; the segment must belong to the schedule's campaign + workspace (validated via `segmentBelongsToCampaign`). Asset `segmentId` is validated the same way.
  **How to apply:** validate relational refs (segment↔campaign↔workspace) on schedule/asset writes; don't expose UI paths that the backend can't run.

- **Campaign-wide send fans out over per-segment sends; it does NOT bypass them.**
  **Why:** "send/schedule all segments" loops the campaign's segments and calls the same `executeSegmentSend` used by the single-segment path, so each segment keeps its own template/sender/audience and the same suppression/validation rules. Unsendable segments (no template, empty audience, all-suppressed, or schedule mode with no time) are collected as per-segment `skipped`/`error` results instead of aborting the batch — the loop never throws out the whole run for one bad segment.
  **How to apply:** any new batch action over segments should reuse the per-segment executor and report per-item outcomes, not reimplement the send.
