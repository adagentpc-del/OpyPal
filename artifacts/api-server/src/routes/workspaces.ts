import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, asc, and } from "drizzle-orm";
import { db, workspacesTable, workspaceMembersTable } from "@workspace/db";
import {
  requireAuth,
  requireSuperAdmin,
  requireWorkspaceAccess,
  requireRole,
} from "../middleware/clerk-auth";
import { slugify, ALL_WORKSPACE_ROLES } from "../lib/platform";
import { writeAudit } from "../lib/audit";

const router: IRouter = Router();

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  slug: z.string().trim().optional(),
  shortCode: z.string().trim().optional(),
  initials: z.string().trim().optional(),
  roleLabel: z.string().trim().optional(),
  primaryColor: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
});

const updateWorkspaceSchema = createWorkspaceSchema.partial();

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: z.enum(ALL_WORKSPACE_ROLES as [string, ...string[]]).optional(),
});

// List workspaces visible to the caller (all for super admin, own otherwise).
router.get("/workspaces", requireAuth, async (req, res) => {
  const ctx = req.authContext!;
  const all = await db
    .select()
    .from(workspacesTable)
    .orderBy(asc(workspacesTable.id));
  const visible = ctx.isSuperAdmin
    ? all
    : all.filter((w) => ctx.memberships.some((m) => m.workspaceId === w.id));
  res.json(visible);
});

// Create a workspace (super admin only).
router.post("/workspaces", requireAuth, requireSuperAdmin, async (req, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) {
    res.status(400).json({ message: "Could not derive a slug from the name" });
    return;
  }

  const existing = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.slug, slug));
  if (existing.length) {
    res.status(409).json({ message: "A workspace with this slug already exists" });
    return;
  }

  const [created] = await db
    .insert(workspacesTable)
    .values({
      name: data.name,
      slug,
      shortCode: data.shortCode || data.name.slice(0, 3).toUpperCase(),
      initials: data.initials || initialsFrom(data.name),
      roleLabel: data.roleLabel || "Workspace Admin",
      primaryColor: data.primaryColor || null,
      logoUrl: data.logoUrl || null,
    })
    .returning();

  res.status(201).json(created);
});

// Update a workspace (super admin only).
router.patch("/workspaces/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "Invalid workspace id" });
    return;
  }
  const parsed = updateWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [updated] = await db
    .update(workspacesTable)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: slugify(data.slug) } : {}),
      ...(data.shortCode !== undefined ? { shortCode: data.shortCode } : {}),
      ...(data.initials !== undefined ? { initials: data.initials } : {}),
      ...(data.roleLabel !== undefined ? { roleLabel: data.roleLabel } : {}),
      ...(data.primaryColor !== undefined ? { primaryColor: data.primaryColor } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(workspacesTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ message: "Workspace not found" });
    return;
  }
  res.json(updated);
});

// List members of a workspace (super admin or a workspace admin of that workspace).
router.get(
  "/workspaces/:id/members",
  requireAuth,
  requireWorkspaceAccess,
  requireRole("workspace_admin"),
  async (req, res) => {
    const id = Number(req.params.id);
    const members = await db
      .select()
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.workspaceId, id))
      .orderBy(asc(workspaceMembersTable.id));
    res.json(members);
  },
);

// Assign an admin/member to a workspace by email (super admin only). When that
// person signs up with this email they automatically gain access.
router.post(
  "/workspaces/:id/members",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Invalid workspace id" });
      return;
    }
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }
    const workspace = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, id));
    if (!workspace.length) {
      res.status(404).json({ message: "Workspace not found" });
      return;
    }

    const existing = await db
      .select()
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.workspaceId, id));
    if (existing.some((m) => m.email === parsed.data.email)) {
      res.status(409).json({ message: "This email is already assigned to the workspace" });
      return;
    }

    const role = parsed.data.role || "workspace_admin";
    const [member] = await db
      .insert(workspaceMembersTable)
      .values({
        workspaceId: id,
        email: parsed.data.email,
        role,
        status: "active",
        createdBy: req.authContext?.email ?? null,
      })
      .returning();

    await writeAudit({
      workspaceId: id,
      type: "member_invited",
      description: `Invited ${parsed.data.email} as ${role}`,
      createdBy: req.authContext?.email,
      metadata: { email: parsed.data.email, role, via: "workspaces" },
    });

    res.status(201).json(member);
  },
);

// Remove a member from a workspace (super admin only).
router.delete(
  "/workspaces/:id/members/:memberId",
  requireAuth,
  requireSuperAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    if (!Number.isFinite(memberId) || !Number.isFinite(id)) {
      res.status(400).json({ message: "Invalid member id" });
      return;
    }
    const [deleted] = await db
      .delete(workspaceMembersTable)
      .where(
        and(
          eq(workspaceMembersTable.id, memberId),
          eq(workspaceMembersTable.workspaceId, id),
        ),
      )
      .returning();
    if (!deleted) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    await writeAudit({
      workspaceId: id,
      type: "member_removed",
      description: `Removed ${deleted.email} from the workspace`,
      createdBy: req.authContext?.email,
      metadata: { email: deleted.email, role: deleted.role, via: "workspaces" },
    });

    res.json({ message: "Member removed" });
  },
);

export default router;
