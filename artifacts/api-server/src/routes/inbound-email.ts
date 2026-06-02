import { Router, type IRouter } from "express";
import { db, inboundEmailsTable, leadsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { processInboundEmail, getConversationThread } from "../lib/reply-processor";
import { requireAuth, resolveWorkspace, isPublicMixedRoutePath } from "../middleware/clerk-auth";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET || "";

router.use((req, res, next) => {
  if (isPublicMixedRoutePath(req.path)) return next();
  requireAuth(req, res, (authErr?: any) => {
    if (authErr) return next(authErr);
    resolveWorkspace(req, res, next);
  });
});

router.post("/inbound-email", async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const providedSecret = req.headers["x-webhook-secret"] || req.query.secret;
      if (providedSecret !== WEBHOOK_SECRET) {
        return res.status(401).json({ message: "unauthorized" });
      }
    }

    const {
      from, sender, sender_email, senderEmail,
      to, recipient, recipient_email, recipientEmail,
      subject,
      text: bodyText, body_text, bodyText: bodyTextAlt, plain: plainText,
      html: bodyHtml, body_html, bodyHtml: bodyHtmlAlt,
      headers, raw_headers, rawHeaders,
      in_reply_to, inReplyTo,
      references, message_references,
      message_id, messageId,
    } = req.body;

    const resolvedSender = senderEmail || sender_email || sender || from || "";
    const resolvedRecipient = recipientEmail || recipient_email || recipient || to || "";
    const resolvedBodyText = bodyTextAlt || bodyText || body_text || plainText || "";
    const resolvedBodyHtml = bodyHtmlAlt || bodyHtml || body_html || "";
    const resolvedHeaders = rawHeaders || raw_headers || (typeof headers === "string" ? headers : JSON.stringify(headers || ""));
    const resolvedInReplyTo = inReplyTo || in_reply_to || "";
    const resolvedReferences = references || message_references || "";

    if (!resolvedSender) {
      return res.status(400).json({ message: "sender email is required" });
    }

    const result = await processInboundEmail({
      senderEmail: resolvedSender,
      recipientEmail: resolvedRecipient,
      subject: subject || "",
      bodyText: resolvedBodyText,
      bodyHtml: resolvedBodyHtml,
      rawHeaders: resolvedHeaders,
      inReplyTo: resolvedInReplyTo,
      references: resolvedReferences,
      messageId: messageId || message_id,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("[InboundEmail] Error processing:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/inbound-emails", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const matchedOnly = req.query.matched === "true";
    const unmatchedOnly = req.query.unmatched === "true";

    const ws = req.workspaceId!;
    let query = db.select().from(inboundEmailsTable)
      .where(eq(inboundEmailsTable.workspaceId, ws))
      .orderBy(desc(inboundEmailsTable.createdAt)).limit(limit);

    if (matchedOnly) {
      query = db.select().from(inboundEmailsTable)
        .where(and(eq(inboundEmailsTable.workspaceId, ws), eq(inboundEmailsTable.matched, true)))
        .orderBy(desc(inboundEmailsTable.createdAt)).limit(limit);
    } else if (unmatchedOnly) {
      query = db.select().from(inboundEmailsTable)
        .where(and(eq(inboundEmailsTable.workspaceId, ws), eq(inboundEmailsTable.matched, false)))
        .orderBy(desc(inboundEmailsTable.createdAt)).limit(limit);
    }

    const emails = await query;
    res.json(emails);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/leads/:leadId/conversation", async (req, res) => {
  try {
    const leadId = Number(req.params.leadId);
    const [lead] = await db.select({ id: leadsTable.id }).from(leadsTable)
      .where(and(eq(leadsTable.id, leadId), eq(leadsTable.workspaceId, req.workspaceId!)));
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    const thread = await getConversationThread(leadId);
    res.json(thread);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
