---
name: Opypal dev/prod DB separation & production data recovery
description: Why production data (esp. live-site CSV imports) is not recoverable via Replit checkpoints, and the forensic technique that proves where rows landed.
---

# Dev vs prod databases are separate; checkpoints protect dev only

- The dev database and the deployed/live database are **separate Postgres instances** (observed: dev=`heliumdb`, prod=`neondb`/Neon). Querying prod requires `executeSql({ environment: "production" })`.
- **Replit Agent checkpoints snapshot the development database only.** Production/deployment data is NOT restored by a checkpoint rollback. If a user did an action on the LIVE site (e.g. a CSV import on the published domain), that data lives only in production and cannot be recovered by rolling back the editor.
- A **redeploy/publish can point the live site at a fresh production database**, abandoning the previous prod DB. Production-only data created before that redeploy can be effectively lost; the only avenues are Replit Support (Neon point-in-time recovery, time-limited) or re-importing the original source file.

**Why:** A user reported "400 contacts uploaded to A3" vanished. They had imported on the live site (a3visualcontact.com) ~3 days prior. Neither current dev nor current prod ever held them.

**How to apply:** Before suggesting rollback for "lost data," establish WHERE the data was created (dev preview vs live site) and WHEN. For live-site/production data loss, rollback is the wrong tool — recommend re-importing the source file (best) or Replit Support for prod DB backup recovery.

## Forensic technique: did rows EVER exist in a given DB?
- `SELECT last_value, is_called FROM <table>_id_seq;` reveals the max IDs ever allocated. Every committed INSERT consumes one sequence value and the counter never goes backward (without a DB reset/restore).
- `is_called=false` (last_value=1) ⇒ the table has NEVER had a row in that database's current incarnation.
- If a "success" import of N rows is claimed but the sequence never approached N in either dev or prod, the rows were committed to a *different* (since-replaced) database — not hidden or misfiled in the current one.
- The CSV import page (import-export.tsx) writes to the **leads** table (titled "Import Leads"), inserting row-by-row; it does NOT populate the separate `contacts` or `imports` tables. So "imported contacts" become leads.
