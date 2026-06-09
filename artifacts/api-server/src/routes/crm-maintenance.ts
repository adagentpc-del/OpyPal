import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

// Outreach-history tables that get cleared on a reset. Order matters for FKs:
// child/log tables first, parents last. CRM content (contacts, companies,
// leads/opportunities, templates, imports, assets, notes, tasks) is preserved.
// NOTE: the suppression_list is intentionally NOT cleared — real opt-outs must
// survive a reset so we never email someone who unsubscribed.
const OUTREACH_TABLES = [
  "email_events",
  "send_logs",
  "scheduled_emails",
  "next_actions",
  "sequence_steps",
  "sequence_enrollments",
  "bulk_send_campaigns",
  "personalization_logs",
  "reply_review_queue",
  "routing_logs",
  "lead_engagement_events",
  "outreach_history",
  "inbound_emails",
  "activity",
] as const;

async function countRows(table: string, workspaceId: number): Promise<number> {
  const r: any = await db.execute(
    sql.raw(`select count(*)::int as n from ${table} where workspace_id = ${workspaceId}`),
  );
  const rows = r.rows ?? r;
  return Number(rows?.[0]?.n ?? 0);
}

// Preview the impact of a reset: what is preserved vs how many outreach rows
// would be removed. Read-only.
router.get("/crm-maintenance/preview", requireRole("workspace_admin"), async (req, res) => {
  try {
    const ws = req.workspaceId!;
    const [contacts, companies, leads, templates, imports] = await Promise.all([
      countRows("contacts", ws),
      countRows("companies", ws),
      countRows("leads", ws),
      countRows("templates", ws),
      countRows("imports", ws),
    ]);

    const breakdown: Record<string, number> = {};
    let outreachToRemove = 0;
    for (const t of OUTREACH_TABLES) {
      const n = await countRows(t, ws);
      breakdown[t] = n;
      outreachToRemove += n;
    }

    res.json({
      preserved: {
        contacts,
        companies,
        opportunities: leads,
        templates,
        imports,
      },
      outreachToRemove,
      breakdown,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Execute the reset: clear all outreach history and reset every contact to a
// clean "Not Contacted" state. Preserves contacts, companies, opportunities
// (leads), templates, imports, assets, notes, tags, segments, custom fields and
// rep/account ownership — AND real opt-outs (unsubscribed, do-not-contact,
// bounced, suppression list) so we never re-email someone who opted out.
router.post("/crm-maintenance/reset-outreach", requireRole("workspace_admin"), async (req, res) => {
  try {
    const ws = req.workspaceId!;

    // Tally what we're about to remove (for the response/audit).
    let removed = 0;
    for (const t of OUTREACH_TABLES) removed += await countRows(t, ws);

    await db.execute(sql.raw("BEGIN"));
    try {
      for (const t of OUTREACH_TABLES) {
        await db.execute(sql.raw(`DELETE FROM ${t} WHERE workspace_id = ${ws}`));
      }
      await db.execute(
        sql.raw(`UPDATE contacts SET
          sequence_status = 'pending',
          outreach_status = 'Not Contacted',
          email_status = CASE
            WHEN do_not_contact = true THEN 'Do Not Contact'
            WHEN unsubscribed = true THEN 'Unsubscribed'
            WHEN bounced = true THEN 'Bounced'
            ELSE 'Ready For Outreach' END,
          engagement_score = 0,
          engagement_tier = 'cold',
          current_step = 0,
          last_email_sent_at = NULL,
          last_reply_at = NULL,
          next_send_at = NULL,
          outlook_status = NULL,
          follow_up_date = NULL,
          routing_state = 'standard_nurture',
          routing_locked = false,
          recommended_next_action = NULL,
          qualified_status = 'unreviewed',
          campaign_name = NULL,
          campaign_id = NULL,
          assigned_template_set = NULL,
          template_set_id = NULL,
          lifecycle_status = NULL,
          updated_at = now()
        WHERE workspace_id = ${ws}`),
      );
      await db.execute(sql.raw("COMMIT"));
    } catch (e) {
      await db.execute(sql.raw("ROLLBACK"));
      throw e;
    }

    res.json({ success: true, removed, message: `Reset complete — ${removed} outreach records removed; all contacts set to "Not Contacted". Opt-outs preserved.` });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
