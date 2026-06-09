import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Activity-based reporting for the new Outlook outbound workflow. Replaces the
// old campaign-analytics dashboard: everything is derived from CRM activity
// (logged as the rep works), tasks, and opportunities — not email-tracking
// pixels. All numbers are workspace-scoped.
router.get("/activity-dashboard", async (req, res) => {
  try {
    const ws = req.workspaceId!;

    // Count CRM activity rows of a given type within a time window.
    async function act(type: string, since: "today" | "week"): Promise<number> {
      const cutoff =
        since === "today"
          ? "date_trunc('day', now())"
          : "now() - interval '7 days'";
      const r: any = await db.execute(
        sql.raw(
          `select count(*)::int as n from activity
             where workspace_id = ${ws} and type = '${type}' and created_at >= ${cutoff}`,
        ),
      );
      return Number((r.rows ?? r)?.[0]?.n ?? 0);
    }

    async function scalar(query: string): Promise<number> {
      const r: any = await db.execute(sql.raw(query));
      return Number((r.rows ?? r)?.[0]?.n ?? 0);
    }

    const [
      emailsToday,
      callsToday,
      meetingsToday,
      proposalsToday,
      oppsCreatedToday,
      followUpsDue,
      emailsWeek,
      repliesWeek,
      meetingsWeek,
      surveysWeek,
      quotesWeek,
      pipeline,
    ] = await Promise.all([
      act("email_sent", "today"),
      act("call_made", "today"),
      act("meeting_booked", "today"),
      act("proposal_sent", "today"),
      scalar(`select count(*)::int as n from leads where workspace_id=${ws} and created_at >= date_trunc('day', now())`),
      scalar(`select count(*)::int as n from tasks where workspace_id=${ws} and status='open' and due_date is not null and due_date <= to_char(now(),'YYYY-MM-DD')`),
      act("email_sent", "week"),
      act("reply", "week"),
      act("meeting_booked", "week"),
      act("site_survey", "week"),
      act("quote_requested", "week"),
      scalar(`select coalesce(sum(coalesce(forecast_value, deal_value_estimate, proposal_value, 0)),0)::int as n from leads where workspace_id=${ws} and status not in ('Closed Lost')`),
    ]);

    res.json({
      today: {
        emailsSent: emailsToday,
        callsMade: callsToday,
        meetingsBooked: meetingsToday,
        proposalsSent: proposalsToday,
        opportunitiesCreated: oppsCreatedToday,
        followUpsDue,
      },
      week: {
        emailsSent: emailsWeek,
        replies: repliesWeek,
        meetings: meetingsWeek,
        siteSurveys: surveysWeek,
        quotesRequested: quotesWeek,
        revenuePipeline: pipeline,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
