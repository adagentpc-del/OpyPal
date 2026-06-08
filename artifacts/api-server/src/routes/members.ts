import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db, workspaceMembersTable } from "@workspace/db";
import { requireRole } from "../middleware/clerk-auth";
import { ALL_WORKSPACE_ROLES, MEMBER_STATUSES } from "../lib/platform";
import { writeAudit } from "../lib/audit";

// Workspace-scoped member management. Mounted behind [requireAuth,
// resolveWorkspace] in routes/index.ts, so req.workspaceId is always a
// workspace the caller may access. requireRole("workspace_admin") restricts
// every action here to workspace admins (and super admins, who bypass roles).
// All reads/writes are filtered by req.workspaceId — a workspace admin can only
// ever manage members of their own workspace.
const router: IRouter = Router();

// Gate the member-management routes to workspace admins. This MUST be scoped to
// the "/members" path: every scoped router is mounted at the same root "/" in
// routes/index.ts, so a path-less router.use() here would run on ALL API traffic
// passing through (e.g. /campaigns/*) and 403 every non-admin caller before the
// request ever reached its real router.
router.use("/members", requireRole("workspace_admin"));

const roleEnum = z.enum(
  ALL_WORKSPACE_ROLES as [string, ...string[]],
);
const statusEnum = z.enum(MEMBER_STATUSES as unknown as [string, ...string[]]);

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: roleEnum.optional(),
});

const updateSchema = z
  .object({
    role: roleEnum.optional(),
    status: statusEnum.optional(),
  })
  .refine((d) => d.role !== undefined || d.status !== undefined, {
    message: "Provide a role and/or status to update",
  });

// List members of the current workspace.
router.get("/members", async (req, res) => {
  const ws = req.workspaceId!;
  const members = await db
    .select()
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.workspaceId, ws))
    .orderBy(asc(workspaceMembersTable.id));
  res.json(members);
});

// Invite / create a member in the current workspace.
router.post("/members", async (req, res) => {
  const ws = req.workspaceId!;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { email } = parsed.data;
  const role = parsed.data.role ?? "viewer";

  const existing = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.workspaceId, ws),
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
      workspaceId: ws,
      email,
      role,
      status: "active",
      createdBy: req.authContext?.email ?? null,
    })
    .returning();

  await writeAudit({
    workspaceId: ws,
    type: "member_invited",
    description: `Invited ${email} as ${role}`,
    createdBy: req.authContext?.email,
    metadata: { email, role },
  });

  res.status(201).json(member);
});

// Update a member's role and/or status (scoped to the current workspace).
router.patch("/members/:id", async (req, res) => {
  const ws = req.workspaceId!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "Invalid member id" });
    return;
  }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [current] = await db
    .select()
    .from(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, ws),
      ),
    );
  if (!current) {
    res.status(404).json({ message: "Member not found" });
    return;
  }

  const { role, status } = parsed.data;
  const [updated] = await db
    .update(workspaceMembersTable)
    .set({
      ...(role !== undefined ? { role } : {}),
      ...(status !== undefined ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, ws),
      ),
    )
    .returning();

  if (role !== undefined && role !== current.role) {
    await writeAudit({
      workspaceId: ws,
      type: "member_role_changed",
      description: `Changed ${current.email} from ${current.role} to ${role}`,
      createdBy: req.authContext?.email,
      metadata: { email: current.email, from: current.role, to: role },
    });
  }
  if (status !== undefined && status !== current.status) {
    await writeAudit({
      workspaceId: ws,
      type: status === "suspended" ? "member_suspended" : "member_reactivated",
      description: `${status === "suspended" ? "Suspended" : "Reactivated"} ${current.email}`,
      createdBy: req.authContext?.email,
      metadata: { email: current.email, status },
    });
  }

  res.json(updated);
});

// Remove a member from the current workspace.
router.delete("/members/:id", async (req, res) => {
  const ws = req.workspaceId!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "Invalid member id" });
    return;
  }

  const [deleted] = await db
    .delete(workspaceMembersTable)
    .where(
      and(
        eq(workspaceMembersTable.id, id),
        eq(workspaceMembersTable.workspaceId, ws),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ message: "Member not found" });
    return;
  }

  await writeAudit({
    workspaceId: ws,
    type: "member_removed",
    description: `Removed ${deleted.email} from the workspace`,
    createdBy: req.authContext?.email,
    metadata: { email: deleted.email, role: deleted.role },
  });

  res.json({ message: "Member removed" });
});

const replyEmailSchema = z.object({
  replyToEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("A valid email is required")
    .nullable(),
});

// Register / update the address replies should route to for this rep.
router.patch("/members/:id/reply-email", async (req, res) => {
  const ws = req.workspaceId!;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "Invalid member id" });
    return;
  }
  const parsed = replyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(workspaceMembersTable)
    .set({ replyToEmail: parsed.data.replyToEmail, updatedAt: new Date() })
    .where(and(eq(workspaceMembersTable.id, id), eq(workspaceMembersTable.workspaceId, ws)))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Member not found" });
    return;
  }
  res.json(updated);
});

export default router;
