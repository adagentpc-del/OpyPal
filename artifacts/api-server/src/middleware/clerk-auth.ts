import type { Request, Response, NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { eq, and, isNull } from "drizzle-orm";
import { db, workspaceMembersTable } from "@workspace/db";
import { isSuperAdminEmail } from "../lib/platform";

export interface Membership {
  workspaceId: number;
  role: string;
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
    }
  }
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
    const user = await clerkClient.users.getUser(userId);
    email = (
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      ""
    ).toLowerCase();
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

    memberships = rows.map((r) => ({ workspaceId: r.workspaceId, role: r.role }));

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
