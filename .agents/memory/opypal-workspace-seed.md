---
name: OpyPal workspace template/sequence seeding
description: How boot seeding for workspace-scoped templates, categories, and follow-up sequences is kept idempotent and edit-safe
---

# OpyPal workspace template & sequence seeding

OpyPal (artifacts/a3-sales-os) seeds workspace-scoped data on API boot. Two seeders run in order in the api-server boot sequence: workspaces/categories first, then templates+sequences.

## Idempotency & edit-safety rules (must preserve)
- **Templates and sequences use per-workspace "any-row" guards**: seed only when zero rows exist for that workspace_id. This never clobbers later admin edits. Acceptable because seeding is all-or-nothing within a single boot.
- **Category reconcile must NOT delete by "not in canonical list"** — that wipes admin-created categories on every boot. Instead delete ONLY a hardcoded list of known legacy placeholder names (renamed in earlier iterations), then insert canonical via onConflictDoNothing.
  - **Why:** a code review caught the over-broad delete; it conflicts with the requirement that seeded categories stay editable.
- **A link-repair pass runs every boot**: backfills linked_sequence_id/linked_template_set_id on "— Direct Intro" templates whose category sequence exists but link is null. Covers partial-state across separate boots. Only Direct Intro templates get linked; value-intro templates stay unlinked by design.

## Data shape per seeded workspace (Move Mi, StrataLogic)
- 8 categories, 16 templates (2/category: Direct Intro + a value-intro), 8 sequences (1/category), 56 steps (7/sequence at delays 3,7,14,30,90,180,365 days).
- linked_sequence_id and linked_template_set_id both point at template_sets; frontend reads linkedSequenceId||linkedTemplateSetId.

## Scope notes
- Sequences = template_sets (definition) + sequence_templates (steps). sequence_enrollments/sequence_steps are runtime, not definitions.
- Only Move Mi (id 2) and StrataLogic (id 3) get template/sequence seeding; A3 Visual (1) and Alyssa Advisory (4) keep their category placeholders only.
