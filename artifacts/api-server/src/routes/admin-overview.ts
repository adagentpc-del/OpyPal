import { Router, type IRouter } from "express";
import { sql, eq, desc, inArray, count } from "drizzle-orm";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  contactsTable,
  campaignsTable,
  leadsTable,
  scheduledEmailsTable,
  replyReviewQueueTable,
  mailboxConnectionsTable,
  activityTable,
} from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middleware/clerk-auth";

// Platform-wide aggregate overview. Super-admin only. Returns one row per
// workspace with headline counts + provider connection health, plus a
// platform-wide recent-activity feed. This is the data source for the platform
// dashboard, cross-workspace provider/analytics/audit pages.
//
// NOTE: per the api-spec constraint, this endpoint is NOT defined in
// lib/api-spec or lib/api-zod. It validates inline (no body input here) and is
// consumed via a raw-fetch client on the frontend.
const router: IRouter = Router();

// Reduce grouped `{ workspaceId, value }` rows into a lookup map.
function toMap(rows: { workspaceId: number | null; value: number }[]) {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r.workspaceId == null) continue;
    m.set(r.workspaceId, Number(r.value) || 0);
  }
  return m;
}

router.get(
  "/admin/overview",
  requireAuth,
  requireSuperAdmin,
  async (_req, res) => {
    const workspaces = await db
      .select()
      .from(workspacesTable)
      .orderBy(workspacesTable.id);

    const ids = workspaces.map((w) => w.id);

    // Empty platform — short-circuit with no per-table queries.
    if (ids.length === 0) {
      res.json({ workspaces: [], recentActivity: [] });
      return;
    }

    const [
      memberRows,
      contactRows,
      campaignRows,
      leadRows,
      queuedRows,
      repliesRows,
      providerActiveRows,
      providerErrorRows,
    ] = await Promise.all([
      db
        .select({ workspaceId: workspaceMembersTable.workspaceId, value: count() })
        .from(workspaceMembersTable)
        .where(inArray(workspaceMembersTable.workspaceId, ids))
        .groupBy(workspaceMembersTable.workspaceId),
      db
        .select({ workspaceId: contactsTable.workspaceId, value: count() })
        .from(contactsTable)
        .where(inArray(contactsTable.workspaceId, ids))
        .groupBy(contactsTable.workspaceId),
      db
        .select({ workspaceId: campaignsTable.workspaceId, value: count() })
        .from(campaignsTable)
        .where(inArray(campaignsTable.workspaceId, ids))
        .groupBy(campaignsTable.workspaceId),
      db
        .select({ workspaceId: leadsTable.workspaceId, value: count() })
        .from(leadsTable)
        .where(inArray(leadsTable.workspaceId, ids))
        .groupBy(leadsTable.workspaceId),
      db
        .select({ workspaceId: scheduledEmailsTable.workspaceId, value: count() })
        .from(scheduledEmailsTable)
        .where(
          sql`${scheduledEmailsTable.workspaceId} IN ${ids} AND ${scheduledEmailsTable.status} IN ('scheduled','queued')`,
        )
        .groupBy(scheduledEmailsTable.workspaceId),
      db
        .select({ workspaceId: replyReviewQueueTable.workspaceId, value: count() })
        .from(replyReviewQueueTable)
        .where(
          sql`${replyReviewQueueTable.workspaceId} IN ${ids} AND ${replyReviewQueueTable.status} = 'pending'`,
        )
        .groupBy(replyReviewQueueTable.workspaceId),
      db
        .select({ workspaceId: mailboxConnectionsTable.workspaceId, value: count() })
        .from(mailboxConnectionsTable)
        .where(
          sql`${mailboxConnectionsTable.workspaceId} IN ${ids} AND ${mailboxConnectionsTable.isActive} = true`,
        )
        .groupBy(mailboxConnectionsTable.workspaceId),
      db
        .select({ workspaceId: mailboxConnectionsTable.workspaceId, value: count() })
        .from(mailboxConnectionsTable)
        .where(
          sql`${mailboxConnectionsTable.workspaceId} IN ${ids} AND ${mailboxConnectionsTable.syncError} IS NOT NULL`,
        )
        .groupBy(mailboxConnectionsTable.workspaceId),
    ]);

    const members = toMap(memberRows);
    const contacts = toMap(contactRows);
    const campaigns = toMap(campaignRows);
    const leads = toMap(leadRows);
    const queued = toMap(queuedRows);
    const replies = toMap(repliesRows);
    const providersActive = toMap(providerActiveRows);
    const providersErrored = toMap(providerErrorRows);

    const result = workspaces.map((w) => {
      const connected = providersActive.get(w.id) ?? 0;
      const errored = providersErrored.get(w.id) ?? 0;
      const providerStatus =
        errored > 0 ? "error" : connected > 0 ? "connected" : "none";
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        shortCode: w.shortCode,
        initials: w.initials,
        logoUrl: w.logoUrl,
        primaryColor: w.primaryColor,
        isActive: w.isActive,
        createdAt: w.createdAt,
        metrics: {
          users: members.get(w.id) ?? 0,
          contacts: contacts.get(w.id) ?? 0,
          campaigns: campaigns.get(w.id) ?? 0,
          leads: leads.get(w.id) ?? 0,
          queued: queued.get(w.id) ?? 0,
          replies: replies.get(w.id) ?? 0,
        },
        providers: {
          connected,
          errored,
          status: providerStatus,
        },
      };
    });

    // Platform-wide recent activity (latest 30 across all workspaces).
    const recentActivity = await db
      .select({
        id: activityTable.id,
        workspaceId: activityTable.workspaceId,
        workspaceName: workspacesTable.name,
        type: activityTable.type,
        description: activityTable.description,
        createdBy: activityTable.createdBy,
        createdAt: activityTable.createdAt,
      })
      .from(activityTable)
      .innerJoin(workspacesTable, eq(activityTable.workspaceId, workspacesTable.id))
      .orderBy(desc(activityTable.createdAt))
      .limit(30);

    res.json({ workspaces: result, recentActivity });
  },
);

export default router;
