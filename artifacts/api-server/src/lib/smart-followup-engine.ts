import { db, leadsTable, scheduledEmailsTable, activityTable, notificationsTable, leadEngagementEventsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

interface SmartRule {
  name: string;
  eventType: string;
  actions: SmartAction[];
}

interface SmartAction {
  type: "pause_sequence" | "cancel_sequence" | "suppress" | "update_engagement" | "update_score" | "notify" | "update_status" | "update_next_action" | "create_activity";
  params?: Record<string, any>;
}

const DEFAULT_RULES: SmartRule[] = [
  {
    name: "Reply received",
    eventType: "replied",
    actions: [
      { type: "pause_sequence" },
      { type: "update_engagement", params: { status: "engaged", scoreChange: 25 } },
      { type: "update_next_action", params: { action: "Manual follow-up — lead replied" } },
      { type: "notify", params: { title: "Reply received", priority: "high" } },
      { type: "create_activity", params: { type: "reply_logged", description: "Lead replied to outreach" } },
    ],
  },
  {
    name: "Unsubscribed",
    eventType: "unsubscribed",
    actions: [
      { type: "cancel_sequence" },
      { type: "suppress", params: { reason: "unsubscribed" } },
      { type: "update_engagement", params: { status: "suppressed", scoreChange: -10 } },
      { type: "notify", params: { title: "Lead unsubscribed", priority: "normal" } },
      { type: "create_activity", params: { type: "lead_unsubscribed", description: "Lead unsubscribed from outreach" } },
    ],
  },
  {
    name: "Bounced",
    eventType: "bounced",
    actions: [
      { type: "cancel_sequence" },
      { type: "suppress", params: { reason: "bounced" } },
      { type: "update_engagement", params: { status: "bounced", scoreChange: -15 } },
      { type: "update_next_action", params: { action: "Review — email bounced" } },
      { type: "notify", params: { title: "Email bounced", priority: "normal" } },
      { type: "create_activity", params: { type: "email_bounced", description: "Email bounced — address may be invalid" } },
    ],
  },
  {
    name: "Clicked no reply",
    eventType: "clicked",
    actions: [
      { type: "update_engagement", params: { status: "interested", scoreChange: 10 } },
      { type: "update_next_action", params: { action: "High intent — manual follow-up recommended" } },
      { type: "notify", params: { title: "Lead clicked link", priority: "high" } },
      { type: "create_activity", params: { type: "email_clicked", description: "Lead clicked a link in the email" } },
    ],
  },
  {
    name: "Opened no reply",
    eventType: "opened",
    actions: [
      { type: "update_engagement", params: { status: "aware", scoreChange: 3 } },
      { type: "create_activity", params: { type: "email_opened", description: "Lead opened the email" } },
    ],
  },
  {
    name: "Sent",
    eventType: "sent",
    actions: [
      { type: "update_engagement", params: { scoreChange: 0 } },
      { type: "create_activity", params: { type: "email_sent", description: "Email sent to lead" } },
    ],
  },
  {
    name: "Delivered",
    eventType: "delivered",
    actions: [
      { type: "create_activity", params: { type: "email_delivered", description: "Email delivered successfully" } },
    ],
  },
  {
    name: "Failed",
    eventType: "failed",
    actions: [
      { type: "update_next_action", params: { action: "Review — email delivery failed" } },
      { type: "notify", params: { title: "Email delivery failed", priority: "normal" } },
      { type: "create_activity", params: { type: "email_failed", description: "Email delivery failed" } },
    ],
  },
];

export async function processEngagementEvent(
  leadId: number,
  eventType: string,
  metadata?: {
    scheduledEmailId?: number;
    templateId?: number;
    sequenceId?: number;
    campaignId?: number;
    providerEventId?: string;
    extra?: Record<string, any>;
  }
): Promise<{ actionsApplied: string[] }> {
  const actionsApplied: string[] = [];

  const eventRow: any = {
    leadId,
    eventType,
    eventTimestamp: new Date(),
  };
  if (metadata?.scheduledEmailId) eventRow.scheduledEmailId = metadata.scheduledEmailId;
  if (metadata?.templateId) eventRow.templateId = metadata.templateId;
  if (metadata?.sequenceId) eventRow.sequenceId = metadata.sequenceId;
  if (metadata?.campaignId) eventRow.campaignId = metadata.campaignId;
  if (metadata?.providerEventId) eventRow.providerEventId = metadata.providerEventId;
  if (metadata?.extra) eventRow.metadata = metadata.extra;
  await db.insert(leadEngagementEventsTable).values(eventRow);

  const rule = DEFAULT_RULES.find(r => r.eventType === eventType);
  if (!rule) return { actionsApplied: ["event_logged"] };

  const leads = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!leads.length) return { actionsApplied: ["lead_not_found"] };
  const lead = leads[0];

  for (const action of rule.actions) {
    switch (action.type) {
      case "pause_sequence": {
        const scheduled = await db.select().from(scheduledEmailsTable)
          .where(and(eq(scheduledEmailsTable.leadId, leadId), inArray(scheduledEmailsTable.status, ["scheduled"])));
        if (scheduled.length > 0) {
          const ids = scheduled.map(s => s.id);
          await db.update(scheduledEmailsTable).set({ status: "paused", pausedAt: new Date(), pauseReason: "auto_reply", updatedAt: new Date() }).where(inArray(scheduledEmailsTable.id, ids));
          actionsApplied.push(`paused_${ids.length}_emails`);
        }
        break;
      }
      case "cancel_sequence": {
        const scheduled = await db.select().from(scheduledEmailsTable)
          .where(and(eq(scheduledEmailsTable.leadId, leadId), inArray(scheduledEmailsTable.status, ["scheduled", "paused"])));
        if (scheduled.length > 0) {
          const ids = scheduled.map(s => s.id);
          await db.update(scheduledEmailsTable).set({ status: "canceled", canceledAt: new Date(), canceledReason: `auto_${eventType}`, updatedAt: new Date() }).where(inArray(scheduledEmailsTable.id, ids));
          actionsApplied.push(`canceled_${ids.length}_emails`);
        }
        break;
      }
      case "suppress": {
        const updates: any = { updatedAt: new Date() };
        if (action.params?.reason === "unsubscribed") { updates.isUnsubscribed = true; updates.suppressionReason = "unsubscribed"; }
        if (action.params?.reason === "bounced") { updates.isBounced = true; updates.suppressionReason = "bounced"; }
        await db.update(leadsTable).set(updates).where(eq(leadsTable.id, leadId));
        actionsApplied.push("suppressed");
        break;
      }
      case "update_engagement": {
        const updates: any = { updatedAt: new Date() };
        if (action.params?.status) updates.engagementStatus = action.params.status;
        const newScore = Math.max(0, (lead.engagementScore || 0) + (action.params?.scoreChange || 0));
        updates.engagementScore = newScore;
        updates.lastEngagementType = eventType;
        updates.lastEngagementAt = new Date();
        if (eventType === "opened") updates.lastOpenedAt = new Date();
        if (eventType === "clicked") updates.lastClickedAt = new Date();
        if (eventType === "replied") updates.lastRepliedAt = new Date();
        await db.update(leadsTable).set(updates).where(eq(leadsTable.id, leadId));
        actionsApplied.push("engagement_updated");
        break;
      }
      case "update_next_action": {
        await db.update(leadsTable).set({ smartNextAction: action.params?.action, updatedAt: new Date() }).where(eq(leadsTable.id, leadId));
        actionsApplied.push("next_action_set");
        break;
      }
      case "notify": {
        await db.insert(notificationsTable).values({
          type: eventType,
          title: action.params?.title || eventType,
          description: `${lead.companyName} — ${lead.contactName}`,
          leadId,
          priority: action.params?.priority || "normal",
          metadata: { eventType, scheduledEmailId: metadata?.scheduledEmailId, sequenceId: metadata?.sequenceId },
        });
        actionsApplied.push("notification_created");
        break;
      }
      case "create_activity": {
        const actRow: any = {
          type: action.params?.type || eventType,
          description: action.params?.description || `Event: ${eventType}`,
          leadId,
          createdBy: "system",
        };
        if (metadata?.templateId) actRow.relatedTemplateId = metadata.templateId;
        if (metadata?.sequenceId) actRow.relatedSequenceId = metadata.sequenceId;
        if (metadata?.scheduledEmailId) actRow.relatedScheduledEmailId = metadata.scheduledEmailId;
        await db.insert(activityTable).values(actRow);
        actionsApplied.push("activity_logged");
        break;
      }
      case "update_status": {
        if (action.params?.status) {
          await db.update(leadsTable).set({ status: action.params.status, updatedAt: new Date() }).where(eq(leadsTable.id, leadId));
          actionsApplied.push("status_updated");
        }
        break;
      }
    }
  }

  return { actionsApplied };
}

export function getSmartRules(): SmartRule[] {
  return DEFAULT_RULES;
}
