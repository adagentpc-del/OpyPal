import { db, contactsTable, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

/**
 * Resolve the Reply-To address for an outbound email to a contact.
 *
 * Priority:
 *   1. The contact's assigned rep's registered reply address (reply_to_email)
 *   2. That rep's login email (workspace_members.email)
 *   3. The workspace-level default rep inbox (senderIdentity.defaultRepReplyTo)
 *   4. undefined  ->  caller blocks the send (never falls back to hello@/admin)
 */
export async function resolveContactReplyTo(
  workspaceId: number,
  contactId: number,
): Promise<string | undefined> {
  const [contact] = await db
    .select({ assignedMemberId: contactsTable.assignedMemberId })
    .from(contactsTable)
    .where(and(eq(contactsTable.id, contactId), eq(contactsTable.workspaceId, workspaceId)));

  if (contact?.assignedMemberId) {
    const [rep] = await db
      .select({
        email: workspaceMembersTable.email,
        replyToEmail: workspaceMembersTable.replyToEmail,
        status: workspaceMembersTable.status,
      })
      .from(workspaceMembersTable)
      .where(and(
        eq(workspaceMembersTable.id, contact.assignedMemberId),
        eq(workspaceMembersTable.workspaceId, workspaceId),
      ));
    if (rep && rep.status === "active") return rep.replyToEmail || rep.email;
  }

  const [ws] = await db
    .select({ senderIdentity: workspacesTable.senderIdentity })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  return ws?.senderIdentity?.defaultRepReplyTo || undefined;
}
