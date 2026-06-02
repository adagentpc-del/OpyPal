import { Router, type IRouter } from "express";
import { db, inboundEmailsTable, leadsTable, workspacesTable } from "@workspace/db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { processInboundEmail, getConversationThread } from "../lib/reply-processor";
import { requireAuth, resolveWorkspace, isPublicMixedRoutePath } from "../middleware/clerk-auth";

const router: IRouter = Router();

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_WEBHOOK_SECRET || "";

function normalizeEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

// Looks up the workspace whose senderIdentity.forwardingInbox matches the
// recipient address. Returns the workspace id, or null if none is configured
// for that address.
async function resolveForwardingWorkspace(recipient: string): Promise<number | null> {
  const addr = normalizeEmail(recipient);
  if (!addr) return null;
  const [row] = await db.select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(sql`lower(${workspacesTable.senderIdentity}->>'forwardingInbox') = ${addr}`)
    .limit(1);
  return row?.id ?? null;
}

// Parses a manually-forwarded email body to recover the ORIGINAL sender,
// subject, and body. Supports common "---------- Forwarded message ----------"
// blocks emitted by Gmail/Outlook. Returns null when no forwarded header is
// detected so the caller keeps the original values.
function parseForwardedEmail(body: string): { sender?: string; subject?: string; body?: string } | null {
  if (!body) return null;
  const fwdIdx = body.search(/-{2,}\s*Forwarded message\s*-{2,}/i);
  const hasFrom = /^\s*From:\s*.+/im.test(body);
  if (fwdIdx === -1 && !hasFrom) return null;

  const region = fwdIdx >= 0 ? body.slice(fwdIdx) : body;
  const fromMatch = region.match(/^\s*From:\s*(.+)$/im);
  const subjectMatch = region.match(/^\s*Subject:\s*(.+)$/im);

  let sender: string | undefined;
  if (fromMatch) {
    const emailMatch = fromMatch[1].match(/<([^>]+)>/) || fromMatch[1].match(/([^\s<>]+@[^\s<>]+)/);
    if (emailMatch) sender = emailMatch[1].trim();
  }

  // The original body starts after the contiguous forwarded-header block. Locate
  // the first recognized header line, advance past the run of header lines
  // (From/Date/Subject/To/Cc/Reply-To/Sent), then skip the blank separator.
  let originalBody = region;
  const lines = region.split(/\r?\n/);
  const headerRe = /^\s*(From|Date|Sent|Subject|To|Cc|Bcc|Reply-To):\s*/i;
  let firstHeaderIdx = lines.findIndex(l => headerRe.test(l));
  // Skip the forwarded marker line itself if it was the first match region.
  if (firstHeaderIdx >= 0) {
    let i = firstHeaderIdx;
    // Walk forward while lines are headers or continuation/whitespace-only lines
    // that belong to the header block (but stop at the first blank line, which
    // separates headers from the body).
    while (i < lines.length && headerRe.test(lines[i])) i++;
    // Skip a single blank separator line if present.
    if (i < lines.length && lines[i].trim() === "") i++;
    originalBody = lines.slice(i).join("\n").trim();
  }

  return {
    sender,
    subject: subjectMatch ? subjectMatch[1].trim() : undefined,
    body: originalBody || undefined,
  };
}

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

    let resolvedSender = senderEmail || sender_email || sender || from || "";
    const resolvedRecipient = recipientEmail || recipient_email || recipient || to || "";
    let resolvedBodyText = bodyTextAlt || bodyText || body_text || plainText || "";
    const resolvedBodyHtml = bodyHtmlAlt || bodyHtml || body_html || "";
    const resolvedHeaders = rawHeaders || raw_headers || (typeof headers === "string" ? headers : JSON.stringify(headers || ""));
    const resolvedInReplyTo = inReplyTo || in_reply_to || "";
    const resolvedReferences = references || message_references || "";
    let resolvedSubject = subject || "";

    if (!resolvedSender) {
      return res.status(400).json({ message: "sender email is required" });
    }

    // Manual forwarding fallback: if the recipient matches a workspace's
    // configured forwarding inbox, attribute the mail to that workspace and
    // recover the ORIGINAL sender/subject/body from the forwarded payload so
    // lead matching works against the real correspondent rather than the
    // forwarder.
    const forwardingWorkspaceId = await resolveForwardingWorkspace(resolvedRecipient);
    if (forwardingWorkspaceId) {
      const parsed = parseForwardedEmail(resolvedBodyText);
      if (parsed) {
        if (parsed.sender) resolvedSender = parsed.sender;
        if (parsed.subject) resolvedSubject = parsed.subject;
        if (parsed.body) resolvedBodyText = parsed.body;
      }
    }

    const result = await processInboundEmail({
      senderEmail: resolvedSender,
      recipientEmail: resolvedRecipient,
      subject: resolvedSubject,
      bodyText: resolvedBodyText,
      bodyHtml: resolvedBodyHtml,
      rawHeaders: resolvedHeaders,
      inReplyTo: resolvedInReplyTo,
      references: resolvedReferences,
      messageId: messageId || message_id,
      workspaceHint: forwardingWorkspaceId,
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
