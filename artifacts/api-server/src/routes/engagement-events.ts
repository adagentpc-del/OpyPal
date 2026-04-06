import { Router, type IRouter } from "express";
import { db, leadEngagementEventsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { processEngagementEvent, getSmartRules } from "../lib/smart-followup-engine";

const router: IRouter = Router();

router.get("/engagement-events", async (req, res) => {
  try {
    const conditions: any[] = [];
    if (req.query.leadId) conditions.push(eq(leadEngagementEventsTable.leadId, Number(req.query.leadId)));
    if (req.query.eventType) conditions.push(eq(leadEngagementEventsTable.eventType, String(req.query.eventType)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const events = await db.select().from(leadEngagementEventsTable)
      .where(where)
      .orderBy(desc(leadEngagementEventsTable.eventTimestamp))
      .limit(Number(req.query.limit) || 100);

    res.json(events);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/engagement-events", async (req, res) => {
  try {
    const { leadId, eventType, scheduledEmailId, templateId, sequenceId, campaignId, providerEventId, metadata: extra } = req.body;
    if (!leadId || !eventType) return res.status(400).json({ message: "leadId and eventType are required" });

    const result = await processEngagementEvent(Number(leadId), eventType, {
      scheduledEmailId: scheduledEmailId ? Number(scheduledEmailId) : undefined,
      templateId: templateId ? Number(templateId) : undefined,
      sequenceId: sequenceId ? Number(sequenceId) : undefined,
      campaignId: campaignId ? Number(campaignId) : undefined,
      providerEventId,
      extra,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post("/engagement-events/webhook", async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];
    const errors = [];
    for (const evt of events) {
      try {
        const leadId = evt.leadId ? Number(evt.leadId) : null;
        if (!leadId || isNaN(leadId)) { errors.push({ event: evt, error: "Missing or invalid leadId" }); continue; }
        if (!evt.eventType && !evt.type) { errors.push({ event: evt, error: "Missing eventType" }); continue; }
        const result = await processEngagementEvent(leadId, evt.eventType || evt.type, {
          scheduledEmailId: evt.scheduledEmailId ? Number(evt.scheduledEmailId) : undefined,
          providerEventId: evt.providerEventId || evt.id,
          extra: evt.data || evt.metadata,
        });
        results.push(result);
      } catch (itemErr: any) {
        errors.push({ event: evt, error: itemErr.message });
      }
    }
    res.json({ processed: results.length, errors: errors.length, results, errorDetails: errors.length > 0 ? errors : undefined });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/smart-rules", async (_req, res) => {
  res.json(getSmartRules());
});

export default router;
