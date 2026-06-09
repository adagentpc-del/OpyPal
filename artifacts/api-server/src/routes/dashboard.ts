import { Router, type IRouter } from "express";
import { db, leadsTable, tasksTable, activityTable, sendLogsTable, emailEventsTable, contactsTable } from "@workspace/db";
import { eq, sql, lt, and, desc } from "drizzle-orm";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const leads = await db.select().from(leadsTable).where(eq(leadsTable.workspaceId, req.workspaceId!));
    const today = new Date().toISOString().split("T")[0];

    const statusCounts: Record<string, number> = {};
    const stages = [
      "New Lead", "Contacted", "Replied", "Qualified",
      "Meeting Booked", "Meeting Completed", "Proposal Sent",
      "Negotiation", "Closed Won", "Closed Lost", "Nurture"
    ];
    stages.forEach(s => statusCounts[s] = 0);

    let totalPipelineValue = 0;
    let totalForecastValue = 0;
    let closedRevenue = 0;
    let followUpsDueToday = 0;
    let overdueFollowUps = 0;

    const typeAgg: Record<string, { count: number; value: number }> = {
      Event: { count: 0, value: 0 },
      Agency: { count: 0, value: 0 },
    };

    const stageAgg: Record<string, { count: number; value: number }> = {};
    stages.forEach(s => stageAgg[s] = { count: 0, value: 0 });

    for (const lead of leads) {
      const status = lead.status;
      if (statusCounts[status] !== undefined) statusCounts[status]++;

      const dealVal = lead.proposalValue ? parseFloat(lead.proposalValue) : lead.dealValueEstimate ? parseFloat(lead.dealValueEstimate) : 0;
      const forecastVal = lead.forecastValue ? parseFloat(lead.forecastValue) : 0;

      if (status !== "Closed Won" && status !== "Closed Lost") {
        totalPipelineValue += dealVal;
      }
      totalForecastValue += forecastVal;

      if (status === "Closed Won") {
        closedRevenue += dealVal;
      }

      if (lead.nextFollowUpDate === today) followUpsDueToday++;
      if (lead.nextFollowUpDate && lead.nextFollowUpDate < today && status !== "Closed Won" && status !== "Closed Lost") {
        overdueFollowUps++;
      }

      if (typeAgg[lead.pipelineType]) {
        typeAgg[lead.pipelineType].count++;
        typeAgg[lead.pipelineType].value += dealVal;
      }

      if (stageAgg[status]) {
        stageAgg[status].count++;
        stageAgg[status].value += dealVal;
      }
    }

    const pipelineByStage = stages.map(stage => ({
      stage,
      count: stageAgg[stage].count,
      value: stageAgg[stage].value,
    }));

    const pipelineByType = Object.entries(typeAgg).map(([type, data]) => ({
      type,
      count: data.count,
      value: data.value,
    }));

    const wsId = req.workspaceId!;
    const cnt = async (tbl: any, ...conds: any[]) => {
      const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(tbl).where(and(...conds));
      return r?.c || 0;
    };
    const emailsSent = await cnt(sendLogsTable, eq(sendLogsTable.workspaceId, wsId), eq(sendLogsTable.status, "sent"));
    const bounced = await cnt(emailEventsTable, eq(emailEventsTable.workspaceId, wsId), eq(emailEventsTable.eventType, "bounce"));
    const delivered = Math.max(0, emailsSent - bounced);
    const opened = await cnt(emailEventsTable, eq(emailEventsTable.workspaceId, wsId), eq(emailEventsTable.eventType, "open"));
    const repliedEmails = await cnt(emailEventsTable, eq(emailEventsTable.workspaceId, wsId), eq(emailEventsTable.eventType, "reply"));
    const inSequence = await cnt(contactsTable, eq(contactsTable.workspaceId, wsId), eq(contactsTable.sequenceStatus, "active"));
    const openRate = emailsSent ? Math.round((opened / emailsSent) * 1000) / 10 : 0;
    const replyRate = emailsSent ? Math.round((repliedEmails / emailsSent) * 1000) / 10 : 0;
    const deliveredRate = emailsSent ? Math.round((delivered / emailsSent) * 1000) / 10 : 0;

    res.json({
      emailsSent, delivered, opened, repliedEmails, inSequence, openRate, replyRate, deliveredRate,
      totalLeads: leads.length,
      newLeads: statusCounts["New Lead"],
      contacted: statusCounts["Contacted"],
      replied: statusCounts["Replied"],
      qualified: statusCounts["Qualified"],
      meetingsBooked: statusCounts["Meeting Booked"],
      meetingsCompleted: statusCounts["Meeting Completed"],
      proposalsSent: statusCounts["Proposal Sent"],
      negotiation: statusCounts["Negotiation"],
      closedWon: statusCounts["Closed Won"],
      closedLost: statusCounts["Closed Lost"],
      nurture: statusCounts["Nurture"],
      totalPipelineValue,
      totalForecastValue,
      closedRevenue,
      followUpsDueToday,
      overdueFollowUps,
      pipelineByStage,
      pipelineByType,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const items = await db.select().from(activityTable).where(eq(activityTable.workspaceId, req.workspaceId!)).orderBy(desc(activityTable.createdAt)).limit(20);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
