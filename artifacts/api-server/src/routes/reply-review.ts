import { Router, type IRouter } from "express";
import { db, replyReviewQueueTable, inboundEmailsTable, leadsTable, scheduledEmailsTable, activityTable, notificationsTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getConversationThread } from "../lib/reply-processor";
import { requireRole } from "../middleware/clerk-auth";

const router: IRouter = Router();

router.get("/reply-review", async (req, res) => {
  try {
    const status = req.query.status as string || "pending";
    const limit = Number(req.query.limit) || 50;

    const items = await db.select({
      review: replyReviewQueueTable,
      leadName: leadsTable.contactName,
      companyName: leadsTable.companyName,
      leadEmail: leadsTable.email,
      leadStatus: leadsTable.status,
    })
      .from(replyReviewQueueTable)
      .leftJoin(leadsTable, eq(replyReviewQueueTable.leadId, leadsTable.id))
      .where(and(eq(replyReviewQueueTable.status, status), eq(replyReviewQueueTable.workspaceId, req.workspaceId!)))
      .orderBy(desc(replyReviewQueueTable.createdAt))
      .limit(limit);

    const result = items.map(item => ({
      ...item.review,
      leadName: item.leadName,
      companyName: item.companyName,
      leadEmail: item.leadEmail,
      leadStatus: item.leadStatus,
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/reply-review/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select({
      review: replyReviewQueueTable,
      leadName: leadsTable.contactName,
      companyName: leadsTable.companyName,
      leadEmail: leadsTable.email,
    })
      .from(replyReviewQueueTable)
      .leftJoin(leadsTable, eq(replyReviewQueueTable.leadId, leadsTable.id))
      .where(and(eq(replyReviewQueueTable.id, id), eq(replyReviewQueueTable.workspaceId, req.workspaceId!)));

    if (!item) return res.status(404).json({ message: "Not found" });

    let inboundEmail = null;
    if (item.review.inboundEmailId) {
      const [email] = await db.select().from(inboundEmailsTable).where(and(eq(inboundEmailsTable.id, item.review.inboundEmailId), eq(inboundEmailsTable.workspaceId, req.workspaceId!)));
      inboundEmail = email;
    }

    let thread: any[] = [];
    if (item.review.leadId) {
      thread = await getConversationThread(item.review.leadId);
    }

    res.json({
      ...item.review,
      leadName: item.leadName,
      companyName: item.companyName,
      leadEmail: item.leadEmail,
      inboundEmail,
      thread,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/reply-review/:id/decide", requireRole("operator"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { decision } = req.body;

    if (!["human_reply", "auto_reply", "pause"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be: human_reply, auto_reply, or pause" });
    }

    const [item] = await db.select().from(replyReviewQueueTable).where(and(eq(replyReviewQueueTable.id, id), eq(replyReviewQueueTable.workspaceId, req.workspaceId!)));
    if (!item) return res.status(404).json({ message: "Not found" });

    await db.update(replyReviewQueueTable).set({
      reviewDecision: decision,
      reviewedBy: "admin",
      reviewedAt: new Date(),
      status: "reviewed",
    }).where(and(eq(replyReviewQueueTable.id, id), eq(replyReviewQueueTable.workspaceId, req.workspaceId!)));

    if (item.inboundEmailId) {
      await db.update(inboundEmailsTable).set({
        classification: decision === "pause" ? "uncertain" : decision,
        reviewStatus: "reviewed",
        isAutoReply: decision === "auto_reply",
      }).where(and(eq(inboundEmailsTable.id, item.inboundEmailId), eq(inboundEmailsTable.workspaceId, req.workspaceId!)));
    }

    if (decision === "human_reply" && item.leadId) {
      await db.update(leadsTable).set({
        lastRepliedAt: new Date(),
        engagementStatus: "engaged",
        lastEngagementType: "reply",
        lastEngagementAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(leadsTable.id, item.leadId), eq(leadsTable.workspaceId, req.workspaceId!)));

      const futureEmails = await db.select({ id: scheduledEmailsTable.id })
        .from(scheduledEmailsTable)
        .where(and(
          eq(scheduledEmailsTable.leadId, item.leadId),
          inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
          eq(scheduledEmailsTable.workspaceId, req.workspaceId!),
        ));

      if (futureEmails.length > 0) {
        await db.update(scheduledEmailsTable).set({
          status: "paused",
          pauseReason: "reply_confirmed",
          pausedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(inArray(scheduledEmailsTable.id, futureEmails.map(e => e.id)), eq(scheduledEmailsTable.workspaceId, req.workspaceId!)));
      }

      await db.insert(activityTable).values({
        type: "reply_confirmed",
        description: `Reply confirmed as human — ${futureEmails.length} future emails paused`,
        leadId: item.leadId,
        metadata: { reviewId: id, pausedCount: futureEmails.length },
        createdBy: "admin",
        workspaceId: req.workspaceId!,
      });
    }

    if (decision === "auto_reply" && item.leadId) {
      const pausedEmails = await db.select({ id: scheduledEmailsTable.id })
        .from(scheduledEmailsTable)
        .where(and(
          eq(scheduledEmailsTable.leadId, item.leadId),
          eq(scheduledEmailsTable.status, "paused"),
          eq(scheduledEmailsTable.pauseReason, "reply_received"),
          eq(scheduledEmailsTable.workspaceId, req.workspaceId!),
        ));

      if (pausedEmails.length > 0) {
        await db.update(scheduledEmailsTable).set({
          status: "scheduled",
          pauseReason: null,
          pausedAt: null,
          updatedAt: new Date(),
        }).where(and(inArray(scheduledEmailsTable.id, pausedEmails.map(e => e.id)), eq(scheduledEmailsTable.workspaceId, req.workspaceId!)));
      }

      await db.insert(activityTable).values({
        type: "auto_reply_confirmed",
        description: `Reply confirmed as auto-reply — ${pausedEmails.length} emails resumed`,
        leadId: item.leadId,
        metadata: { reviewId: id, resumedCount: pausedEmails.length },
        createdBy: "admin",
        workspaceId: req.workspaceId!,
      });
    }

    if (decision === "pause" && item.leadId) {
      const futureEmails = await db.select({ id: scheduledEmailsTable.id })
        .from(scheduledEmailsTable)
        .where(and(
          eq(scheduledEmailsTable.leadId, item.leadId),
          inArray(scheduledEmailsTable.status, ["scheduled", "queued"]),
          eq(scheduledEmailsTable.workspaceId, req.workspaceId!),
        ));

      if (futureEmails.length > 0) {
        await db.update(scheduledEmailsTable).set({
          status: "paused",
          pauseReason: "manual_review_pause",
          pausedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(inArray(scheduledEmailsTable.id, futureEmails.map(e => e.id)), eq(scheduledEmailsTable.workspaceId, req.workspaceId!)));
      }

      await db.insert(activityTable).values({
        type: "contact_paused",
        description: `Contact paused pending further review — ${futureEmails.length} emails paused`,
        leadId: item.leadId,
        metadata: { reviewId: id, pausedCount: futureEmails.length },
        createdBy: "admin",
        workspaceId: req.workspaceId!,
      });
    }

    res.json({ success: true, decision });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
