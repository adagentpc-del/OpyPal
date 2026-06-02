import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";
import { requireAuth } from "../middleware/clerk-auth";
import { PLATFORM } from "../lib/platform";

const router: IRouter = Router();

// Returns the signed-in user's identity, platform role, and the workspaces they
// can access. Super admins get every workspace; everyone else gets only the
// workspaces they are a member of.
router.get("/me", requireAuth, async (req, res) => {
  const ctx = req.authContext!;

  let workspaces;
  if (ctx.isSuperAdmin) {
    workspaces = await db.select().from(workspacesTable);
  } else {
    const ids = ctx.memberships.map((m) => m.workspaceId);
    workspaces = ids.length
      ? await db
          .select()
          .from(workspacesTable)
          .where(inArray(workspacesTable.id, ids))
      : [];
  }

  workspaces.sort((a, b) => a.id - b.id);

  // Map workspaceId → the caller's role in that workspace.
  const roleByWorkspace = new Map<number, string>();
  for (const m of ctx.memberships) roleByWorkspace.set(m.workspaceId, m.role);

  const role = ctx.isSuperAdmin
    ? "super_admin"
    : workspaces.length > 0
      ? roleByWorkspace.get(workspaces[0]!.id) ?? "workspace_admin"
      : "none";

  res.json({
    email: ctx.email,
    isSuperAdmin: ctx.isSuperAdmin,
    role,
    platform: PLATFORM,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      shortCode: w.shortCode,
      initials: w.initials,
      roleLabel: w.roleLabel,
      logoUrl: w.logoUrl,
      primaryColor: w.primaryColor,
      isActive: w.isActive,
      // The caller's role within this workspace. Super admins act as
      // "super_admin" everywhere; members get their stored role.
      role: ctx.isSuperAdmin
        ? "super_admin"
        : roleByWorkspace.get(w.id) ?? "workspace_admin",
    })),
  });
});

export default router;
