import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db, workspaceMembersTable, workspacesTable } from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../middleware/clerk-auth";
import { ALL_WORKSPACE_ROLES, SUPER_ADMIN_EMAILS } from "../lib/platform";
import { writeAudit } from "../lib/audit";

// Platform administration. Every route here is super-admin only and operates
// across ALL workspaces. Per-workspace mutations (edit role / suspend / remove)
// are handled by the workspace-scoped /members router with an explicit
// x-workspace-id header, which super admins may target on any workspace.
const router: IRouter = Router();

const roleEnum = z.enum(ALL_WORKSPACE_ROLES as [string, ...string[]]);

const addUserSchema = z.object({
  workspaceId: z.number().int().positive(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: roleEnum.optional(),
});

// Global list of every membership across all workspaces, plus the platform
// super admins (from the allowlist) as virtual entries.
router.get("/admin/users", requireAuth, requireSuperAdmin, async (_req, res) => {
  const members = await db
    .select({
      id: workspaceMembersTable.id,
      workspaceId: workspaceMembersTable.workspaceId,
      email: workspaceMembersTable.email,
      role: workspaceMembersTable.role,
      status: workspaceMembersTable.status,
      clerkUserId: workspaceMembersTable.clerkUserId,
      createdBy: workspaceMembersTable.createdBy,
      createdAt: workspaceMembersTable.createdAt,
      workspaceName: workspacesTable.name,
    })
    .from(workspaceMembersTable)
    .innerJoin(
      workspacesTable,
      eq(workspaceMembersTable.workspaceId, workspacesTable.id),
    )
    .orderBy(asc(workspaceMembersTable.workspaceId), asc(workspaceMembersTable.id));

  res.json({
    superAdmins: SUPER_ADMIN_EMAILS,
    members,
  });
});

// Add a member to any workspace.
router.post("/admin/users", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = addUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { workspaceId, email } = parsed.data;
  const role = parsed.data.role ?? "viewer";

  const [ws] = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  if (!ws) {
    res.status(404).json({ message: "Workspace not found" });
    return;
  }

  const existing = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, workspaceId),
        eq(workspaceMembersTable.email, email),
      ),
    );
  if (existing.length) {
    res.status(409).json({ message: "This email is already a member of the workspace" });
    return;
  }

  const [member] = await db
    .insert(workspaceMembersTable)
    .values({
      workspaceId,
      email,
      role,
      status: "active",
      createdBy: req.authContext?.email ?? null,
    })
    .returning();

  await writeAudit({
    workspaceId,
    type: "member_invited",
    description: `Invited ${email} as ${role}`,
    createdBy: req.authContext?.email,
    metadata: { email, role, via: "admin" },
  });

  res.status(201).json(member);
});

export default router;
