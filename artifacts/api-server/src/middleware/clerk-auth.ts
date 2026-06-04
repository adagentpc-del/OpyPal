import type { Request, Response, NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { eq, and, isNull } from "drizzle-orm";
import { db, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { isSuperAdminEmail, roleAtLeast } from "../lib/platform";
import type { WorkspaceRole } from "../lib/platform";

export interface Membership {
  workspaceId: number;
  role: string;
}

// Public (unauthenticated) endpoints exposed by the "mixed" routers
// (outbound, engagement-events, inbound-email, outlook). These routers are all
// mounted at the same parent root via router.use(), so each one's catch-all auth
// gate sees pass-through traffic destined for its siblings. To avoid the
// first-mounted router 401ing a sibling's public webhook, every mixed router's
// gate must exempt ALL of these paths, not just its own. The handlers for these
// paths derive the workspace server-side from the referenced record.
export function isPublicMixedRoutePath(path: string): boolean {
  return (
    path.startsWith("/track") ||
    path === "/inbound-email" ||
    path === "/engagement-events/webhook" ||
    path === "/outlook/callback" ||
    path === "/gmail/callback"
  );
}

export interface AuthContext {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  memberships: Membership[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authContext?: AuthContext;
      // The workspace this request is scoped to (set by resolveWorkspace).
      workspaceId?: number;
      // The caller's role within that workspace ("super_admin" for the
      // platform super admin acting on any workspace).
      workspaceRole?: string;
    }
  }
}

// Cache of Clerk userId -> primary email. The verified session token already
// gives us the userId without a network call, but resolving the email requires
// a Clerk API call. Calling clerkClient.users.getUser on EVERY request means a
// single page load (which fires many parallel API requests) produces a burst of
// concurrent Clerk lookups; under that burst Clerk can rate-limit / transiently
// fail, surfacing as spurious 401s. We cache the email per user and coalesce
// concurrent misses into a single in-flight call so each user costs at most one
// Clerk lookup per TTL window.
const EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string; expiresAt: number }>();
const emailInflight = new Map<string, Promise<string>>();

// Resolves a Clerk userId to a lowercased primary email. Returns a cached value
// when fresh, coalesces concurrent misses, and falls back to a stale cached
// value if a fresh Clerk lookup transiently fails. Throws only when there is no
// usable value at all (no cache and the lookup failed).
async function resolveUserEmail(userId: string): Promise<string> {
  const cached = emailCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;

  const existing = emailInflight.get(userId);
  if (existing) return existing;

  const lookup = (async () => {
    try {
      const user = await clerkClient.users.getUser(userId);
      const email = (
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress ||
        ""
      ).toLowerCase();
      emailCache.set(userId, { email, expiresAt: Date.now() + EMAIL_CACHE_TTL_MS });
      return email;
    } catch (err) {
      // Transient Clerk failure (e.g. rate limit): prefer a stale cached value
      // over forcing a 401 on an otherwise-valid session.
      if (cached) return cached.email;
      throw err;
    } finally {
      emailInflight.delete(userId);
    }
  })();

  emailInflight.set(userId, lookup);
  return lookup;
}

// Resolves the signed-in Clerk user, their email, super-admin status, and
// workspace memberships, attaching them to req.authContext. Responds 401 when
// there is no valid session. Use as the base guard on protected routes.
export async function loadAuthContext(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  let email = "";
  try {
    email = await resolveUserEmail(userId);
  } catch {
    res.status(401).json({ message: "Could not resolve authenticated user" });
    return;
  }

  const isSuperAdmin = isSuperAdminEmail(email);

  let memberships: Membership[] = [];
  if (email) {
    const rows = await db
      .select()
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.email, email));

    // Suspended memberships grant no access: the row is retained for history
    // but excluded from the caller's effective workspace memberships.
    memberships = rows
      .filter((r) => r.status !== "suspended")
      .map((r) => ({ workspaceId: r.workspaceId, role: r.role }));

    // Backfill the Clerk user id on memberships the first time this person
    // signs in, so we can later reference them by id.
    const needsBackfill = rows.some((r) => !r.clerkUserId);
    if (needsBackfill) {
      await db
        .update(workspaceMembersTable)
        .set({ clerkUserId: userId, updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembersTable.email, email),
            isNull(workspaceMembersTable.clerkUserId),
          ),
        );
    }
  }

  req.authContext = { userId, email, isSuperAdmin, memberships };
  next();
}

// Requires a signed-in user (any authenticated person).
export const requireAuth = loadAuthContext;

// Requires the Opypal super admin.
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authContext) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (!req.authContext.isSuperAdmin) {
    res.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
}

// Requires the user to be able to administer the given workspace: either the
// super admin, or a member of that workspace. Reads :id or :workspaceId param.
export function requireWorkspaceAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ctx = req.authContext;
  if (!ctx) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (ctx.isSuperAdmin) {
    next();
    return;
  }
  const raw = req.params.workspaceId ?? req.params.id;
  const workspaceId = Number(raw);
  if (
    Number.isFinite(workspaceId) &&
    ctx.memberships.some((m) => m.workspaceId === workspaceId)
  ) {
    next();
    return;
  }
  res.status(403).json({ message: "You do not have access to this workspace" });
}

// Determines which workspace this request operates on and enforces that the
// caller may access it. The desired workspace is read from the `x-workspace-id`
// header, the `workspaceId` query param, or the request body (in that order).
//
// - Super admin: may target any existing workspace. The id must be provided
//   and must reference a real workspace.
// - Workspace member: the target must be one of their memberships. If no target
//   is provided and they belong to exactly one workspace, it is used.
//
// On success it sets req.workspaceId and req.workspaceRole. Must run after
// requireAuth. This is the single choke point that scopes every data query, so
// record-id manipulation cannot cross workspace boundaries.
export async function resolveWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const ctx = req.authContext;
  if (!ctx) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const headerVal = req.header("x-workspace-id");
  const queryVal =
    typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const bodyVal =
    req.body && typeof req.body === "object" && req.body.workspaceId != null
      ? String(req.body.workspaceId)
      : undefined;
  const rawDesired = headerVal ?? queryVal ?? bodyVal;
  const desired = rawDesired != null ? Number(rawDesired) : NaN;

  if (ctx.isSuperAdmin) {
    if (!Number.isFinite(desired)) {
      res
        .status(400)
        .json({ message: "Workspace context required (x-workspace-id)" });
      return;
    }
    const rows = await db
      .select({ id: workspacesTable.id })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, desired))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ message: "Workspace not found" });
      return;
    }
    req.workspaceId = desired;
    req.workspaceRole = "super_admin";
    next();
    return;
  }

  // Regular member resolution.
  if (Number.isFinite(desired)) {
    const membership = ctx.memberships.find((m) => m.workspaceId === desired);
    if (!membership) {
      res
        .status(403)
        .json({ message: "You do not have access to this workspace" });
      return;
    }
    req.workspaceId = desired;
    req.workspaceRole = membership.role;
    next();
    return;
  }

  if (ctx.memberships.length === 1) {
    req.workspaceId = ctx.memberships[0].workspaceId;
    req.workspaceRole = ctx.memberships[0].role;
    next();
    return;
  }

  res
    .status(400)
    .json({ message: "Workspace context required (x-workspace-id)" });
}

// Gate a route on a minimum workspace role. The super admin always passes.
// Must run after resolveWorkspace.
export function requireRole(min: WorkspaceRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.workspaceRole;
    if (!role) {
      res.status(401).json({ message: "Workspace context required" });
      return;
    }
    if (role === "super_admin" || roleAtLeast(role, min)) {
      next();
      return;
    }
    res.status(403).json({ message: "Insufficient permissions" });
  };
}
