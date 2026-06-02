import { db } from "@workspace/db";
import { contactsTable, routingLogsTable, emailEventsTable, settingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export type RoutingState =
  | "standard_nurture"
  | "reactivation_pool"
  | "warm_followup"
  | "hot_priority"
  | "awaiting_manual_outreach"
  | "meeting_candidate"
  | "qualified_opportunity"
  | "closed_won"
  | "closed_lost"
  | "disqualified";

export interface RoutingDecision {
  routingState: RoutingState;
  recommendedNextAction: string;
  reason: string;
}

const SEGMENT_NEXT_ACTIONS: Record<string, Record<string, string>> = {
  hotel: {
    warm: "send_capabilities_overview",
    hot: "manual_followup",
  },
  agency: {
    warm: "send_case_study",
    hot: "book_call",
  },
  developer: {
    warm: "send_capabilities_overview",
    hot: "book_call",
  },
  venue: {
    warm: "send_case_study",
    hot: "manual_followup",
  },
  general: {
    warm: "send_capabilities_overview",
    hot: "manual_followup",
  },
};

function getSegmentAction(segment: string | null | undefined, tier: string): string {
  const s = segment || "general";
  const actions = SEGMENT_NEXT_ACTIONS[s] || SEGMENT_NEXT_ACTIONS.general;
  return actions[tier] || "continue_sequence";
}

export async function getTierThresholds(workspaceId: number): Promise<{ warmMin: number; hotMin: number }> {
  const rows = await db.select().from(settingsTable)
    .where(eq(settingsTable.workspaceId, workspaceId));
  const get = (key: string, def: string) => rows.find(r => r.key === key)?.value || def;
  return {
    warmMin: parseInt(get("tier_warm_min", "3")),
    hotMin: parseInt(get("tier_hot_min", "8")),
  };
}

export function evaluateRouting(contact: {
  engagementScore: number | null;
  engagementTier: string | null;
  sequenceStatus: string;
  bounced: boolean | null;
  unsubscribed: boolean | null;
  doNotContact: boolean | null;
  segmentType: string | null;
  lastReplyAt: Date | null;
}, events: { eventType: string }[]): RoutingDecision {
  if (contact.bounced || contact.unsubscribed || contact.doNotContact) {
    return {
      routingState: "disqualified",
      recommendedNextAction: "archive",
      reason: contact.bounced ? "Bounce detected" : contact.unsubscribed ? "Unsubscribe detected" : "Do not contact flag set",
    };
  }

  const hasReply = events.some(e => e.eventType === "reply") || !!contact.lastReplyAt;
  if (hasReply) {
    return {
      routingState: "awaiting_manual_outreach",
      recommendedNextAction: "manual_followup",
      reason: "Reply detected — automation paused, manual follow-up recommended",
    };
  }

  const tier = contact.engagementTier || "cold";
  const score = contact.engagementScore || 0;
  const clickCount = events.filter(e => e.eventType === "click").length;

  if (tier === "hot" || score >= 8) {
    const action = clickCount >= 3 ? "book_call" : getSegmentAction(contact.segmentType, "hot");
    return {
      routingState: "hot_priority",
      recommendedNextAction: action,
      reason: clickCount >= 3
        ? `Reached hot tier with ${clickCount} clicks — direct outreach recommended`
        : `Reached hot tier (score: ${score}) — high priority follow-up`,
    };
  }

  if (tier === "warm" || score >= 3) {
    return {
      routingState: "warm_followup",
      recommendedNextAction: getSegmentAction(contact.segmentType, "warm"),
      reason: `Reached warm tier (score: ${score}) — stronger CTA recommended`,
    };
  }

  if (contact.sequenceStatus === "completed" && score <= 2) {
    return {
      routingState: "reactivation_pool",
      recommendedNextAction: "reactivation_later",
      reason: "Sequence completed without meaningful engagement — moved to reactivation",
    };
  }

  return {
    routingState: "standard_nurture",
    recommendedNextAction: "continue_sequence",
    reason: "Standard nurture — continuing automated sequence",
  };
}

export async function evaluateAndUpdateContact(contactId: number, workspaceId: number): Promise<RoutingDecision | null> {
  const [contact] = await db.select().from(contactsTable).where(and(
    eq(contactsTable.id, contactId),
    eq(contactsTable.workspaceId, workspaceId),
  ));
  if (!contact) return null;

  if (contact.routingLocked) return null;

  const events = await db.select().from(emailEventsTable).where(and(
    eq(emailEventsTable.contactId, contactId),
    eq(emailEventsTable.workspaceId, contact.workspaceId),
  ));

  const decision = evaluateRouting(contact, events);

  if (decision.routingState !== contact.routingState || decision.recommendedNextAction !== contact.recommendedNextAction) {
    await db.update(contactsTable).set({
      routingState: decision.routingState,
      recommendedNextAction: decision.recommendedNextAction,
      updatedAt: new Date(),
    }).where(and(
      eq(contactsTable.id, contactId),
      eq(contactsTable.workspaceId, workspaceId),
    ));

    await db.insert(routingLogsTable).values({
      workspaceId: contact.workspaceId,
      contactId,
      previousRoutingState: contact.routingState,
      newRoutingState: decision.routingState,
      reason: decision.reason,
      recommendedNextAction: decision.recommendedNextAction,
    });
  }

  return decision;
}

export function getRecommendationExplanation(decision: RoutingDecision): string {
  return decision.reason;
}
