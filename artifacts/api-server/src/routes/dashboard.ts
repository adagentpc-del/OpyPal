import { Router, type IRouter } from "express";
import { db, leadsTable, tasksTable, activityTable } from "@workspace/db";
import { eq, sql, lt, and, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard", async (req, res) => {
  try {
    const leads = await db.select().from(leadsTable);
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

    res.json({
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
    const items = await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(20);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
