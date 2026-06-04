---
name: A3 additive template seeding
description: How A3 (workspace 1) template/sequence library is seeded so edits are never clobbered.
---

A3 Visual (workspace_id=1) template library is built by **multiple independent boot seeders**, each idempotent and additive — they only insert records that don't already exist (matched by **template name** within the workspace) and never delete or overwrite. New premium copy lives in its own seeder + a generated typed content module rather than being merged into the original seeder.

**Why:** these become editable DB records in the Templates/Sequences UI; a non-idempotent or replace-style seeder would wipe user edits on every restart/redeploy.

**How to apply:**
- Add new seed batches as a *new* `seed-*-on-boot.ts` wired in `index.ts`; don't mutate existing batches.
- Guard inserts: skip templates whose name already exists in the workspace; create a template set only if `(workspaceId,name)` is absent; insert sequence steps only when the set has zero steps.
- When "assign a default sequence unless an override exists," link **only** rows where `linked_template_set_id IS NULL` — that is the override check.
- To preserve exact user-supplied copy (curly apostrophes `’`, precise line breaks), generate the content as a typed module via `JSON.stringify` of parsed data — never hand-retype it.
- dev DB is separate from live; seeders run on boot, so live picks up new copy on next deploy.
