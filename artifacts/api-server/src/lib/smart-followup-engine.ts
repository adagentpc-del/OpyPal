import { db, leadsTable, scheduledEmailsTable, activityTable, notificationsTable, leadEngagementEventsTable, tasksTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";

interface SmartRule {
  name: string;
  eventType: string;
  actions: SmartAction[];
}

interface SmartAction {
  type: "pause_sequence" | "cancel_sequence" | "suppress" | "update_engagement" | "update_score" | "notify" | "update_status" | "update_next_action" | "create_activity" | "create_task" | "update_priority_flag";
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
      { type: "update_priority_flag", params: { flag: "urgent" } },
      { type: "notify", params: { title: "Reply received", priority: "high", severity: "urgent" } },
      { type: "create_task", params: { title: "Review reply and respond", taskType: "review_reply", priority: "high", dueSameDay: true } },
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
      { type: "notify", params: { title: "Lead unsubscribed", priority: "normal", severity: "warning" } },
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
      { type: "update_priority_flag", params: { flag: "review" } },
      { type: "notify", params: { title: "Email bounced", priority: "normal", severity: "warning" } },
      { type: "create_task", params: { title: "Verify email and contact data", taskType: "verify_bounced_email", priority: "medium" } },
      { type: "create_activity", params: { type: "email_bounced", description: "Email bounced — address may be invalid" } },
    ],
  },
  {
    name: "Clicked no reply",
    eventType: "clicked",
    actions: [
      { type: "update_engagement", params: { status: "interested", scoreChange: 10 } },
      { type: "update_next_action", params: { action: "High intent — manual follow-up recommended" } },
      { type: "update_priority_flag", params: { flag: "high" } },
      { type: "notify", params: { title: "Lead clicked link", priority: "high", severity: "important" } },
      { type: "create_task", params: { title: "High intent lead — follow up", taskType: "check_high_intent", priority: "high" } },
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
      { type: "notify", params: { title: "Email delivery failed", priority: "normal", severity: "warning" } },
      { type: "create_activity", params: { type: "email_failed", description: "Email delivery failed" } },
    ],
  },
  {
    name: "Sequence paused due to reply",
    eventType: "sequence_paused_reply",
    actions: [
      { type: "update_priority_flag", params: { flag: "high" } },
      { type: "notify", params: { title: "Sequence paused — reply received", priority: "high", severity: "important" } },
      { type: "create_task", params: { title: "Continue conversation manually", taskType: "follow_up_call", priority: "high" } },
      { type: "create_activity", params: { type: "sequence_paused", description: "Sequence paused — reply received, manual follow-up needed" } },
    ],
  },
];

let ruleOverrides: Record<string, boolean> = {
  create_task_on_reply: true,
  create_task_on_click: true,
  create_task_on_bounce: true,
  notify_on_reply: true,
  notify_on_bounce: true,
  notify_on_click: true,
  notify_on_unsubscribe: true,
  high_intent_score_threshold: true,
};

export function getAutoTaskSettings(): Record<string, boolean> {
  return { ...ruleOverrides };
}

export function updateAutoTaskSettings(settings: Record<string, boolean>) {
  ruleOverrides = { ...ruleOverrides, ...settings };
}

function shouldCreateTask(eventType: string): boolean {
  if (eventType === "replied") return ruleOverrides.create_task_on_reply !== false;
  if (eventType === "clicked") return ruleOverrides.create_task_on_click !== false;
  if (eventType === "bounced") return ruleOverrides.create_task_on_bounce !== false;
  return true;
}

function shouldNotify(eventType: string): boolean {
  if (eventType === "replied") return ruleOverrides.notify_on_reply !== false;
  if (eventType === "bounced") return ruleOverrides.notify_on_bounce !== false;
  if (eventType === "clicked") return ruleOverrides.notify_on_click !== false;
  if (eventType === "unsubscribed") return ruleOverrides.notify_on_unsubscribe !== false;
  return true;
}

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

  // Resolve the lead first and derive the workspace server-side from it. Unknown
  // leads are rejected before ANY write so an arbitrary leadId can never inject
  // rows (and never falls back to workspace 1).
  const leads = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
  if (!leads.length) return { actionsApplied: ["lead_not_found"] };
  const lead = leads[0];
  const ws = lead.workspaceId;

  const eventRow: any = {
    workspaceId: ws,
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

  if (eventType === "opened") {
    const openCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(leadEngagementEventsTable)
      .where(and(eq(leadEngagementEventsTable.leadId, leadId), eq(leadEngagementEventsTable.eventType, "opened")));
    const totalOpens = openCount[0]?.count || 0;
    if (totalOpens >= 3 && !lead.lastRepliedAt) {
      const existingWarmTask = await db.select({ id: tasksTable.id }).from(tasksTable)
        .where(and(
          eq(tasksTable.leadId, leadId),
          eq(tasksTable.taskType, "follow_up_call"),
          eq(tasksTable.source, "system"),
          inArray(tasksTable.status, ["open", "in_progress"])
        )).limit(1);
      if (existingWarmTask.length === 0) {
        await db.insert(tasksTable).values({
          workspaceId: ws,
          title: "Warm lead — multiple opens, no reply",
          taskType: "follow_up_call",
          leadId,
          priority: "medium",
          status: "open",
          source: "system",
          createdBy: "smart_engine",
          dueDate: new Date().toISOString().split("T")[0],
          campaignId: metadata?.campaignId || null,
          sequenceId: metadata?.sequenceId || null,
        });
        await db.insert(notificationsTable).values({
          workspaceId: ws,
          type: "multiple_opens",
          title: "Multiple opens detected",
          description: `${lead.companyName} — ${lead.contactName} opened ${totalOpens} times without replying`,
          severity: "info",
          priority: "normal",
          leadId,
          campaignId: metadata?.campaignId || null,
        });
        actionsApplied.push("warm_lead_task_created");
      }
    }
  }

  const newScore = Math.max(0, (lead.engagementScore || 0) + (rule.actions.find(a => a.type === "update_engagement")?.params?.scoreChange || 0));
  if (newScore >= 30 && (lead.engagementScore || 0) < 30 && ruleOverrides.high_intent_score_threshold !== false) {
    await db.insert(tasksTable).values({
      workspaceId: ws,
      title: "High intent lead — personal outreach recommended",
      taskType: "check_high_intent",
      leadId,
      priority: "high",
      status: "open",
      source: "system",
      createdBy: "smart_engine",
      dueDate: new Date().toISOString().split("T")[0],
    });
    await db.insert(notificationsTable).values({
      workspaceId: ws,
      type: "score_threshold",
      title: "Lead score threshold crossed",
      description: `${lead.companyName} reached engagement score ${newScore}`,
      severity: "important",
      priority: "high",
      leadId,
    });
    actionsApplied.push("high_intent_task_created");
  }

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
        const score = Math.max(0, (lead.engagementScore || 0) + (action.params?.scoreChange || 0));
        updates.engagementScore = score;
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
      case "update_priority_flag": {
        await db.update(leadsTable).set({ priorityFlag: action.params?.flag, updatedAt: new Date() }).where(eq(leadsTable.id, leadId));
        actionsApplied.push("priority_flag_set");
        break;
      }
      case "notify": {
        if (!shouldNotify(eventType)) break;
        await db.insert(notificationsTable).values({
          workspaceId: ws,
          type: eventType,
          title: action.params?.title || eventType,
          description: `${lead.companyName} — ${lead.contactName}`,
          severity: action.params?.severity || "info",
          leadId,
          priority: action.params?.priority || "normal",
          campaignId: metadata?.campaignId || null,
          metadata: { eventType, scheduledEmailId: metadata?.scheduledEmailId, sequenceId: metadata?.sequenceId },
        });
        actionsApplied.push("notification_created");
        break;
      }
      case "create_task": {
        if (!shouldCreateTask(eventType)) break;
        const today = new Date().toISOString().split("T")[0];
        await db.insert(tasksTable).values({
          workspaceId: ws,
          title: action.params?.title || `Follow up: ${eventType}`,
          taskType: action.params?.taskType || "custom",
          leadId,
          priority: action.params?.priority || "medium",
          status: "open",
          dueDate: action.params?.dueSameDay ? today : undefined,
          source: "system",
          createdBy: "smart_engine",
          campaignId: metadata?.campaignId || null,
          sequenceId: metadata?.sequenceId || null,
        });
        actionsApplied.push("task_created");
        break;
      }
      case "create_activity": {
        const actRow: any = {
          workspaceId: ws,
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
