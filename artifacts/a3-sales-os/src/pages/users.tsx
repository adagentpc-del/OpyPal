import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/permissions";
import { UserCog, UserPlus, Loader2, Trash2, Crown } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface AdminMember {
  id: number;
  workspaceId: number;
  workspaceName: string;
  email: string;
  role: string;
  status: string;
  clerkUserId: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface AdminUsersResponse {
  superAdmins: string[];
  members: AdminMember[];
}

// Per-workspace member mutations require the x-workspace-id header to match the
// target row's workspace. The fetch interceptor only injects the active
// workspace when the header is absent, so we pass it explicitly here to act on
// any workspace as the super admin.
function wsHeaders(workspaceId: number, extra?: Record<string, string>) {
  return { "x-workspace-id": String(workspaceId), ...(extra ?? {}) };
}

function StatusBadge({ status }: { status: string }) {
  return status === "suspended" ? (
    <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
      Suspended
    </Badge>
  ) : (
    <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
      Active
    </Badge>
  );
}

export default function UsersPage() {
  const { me } = useWorkspace();
  const { toast } = useToast();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminMember | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("viewer");
  const [addWorkspaceId, setAddWorkspaceId] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const workspaces = me?.workspaces ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      setData(await res.json());
    } catch {
      toast({ title: "Could not load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminMember[]>();
    for (const m of data?.members ?? []) {
      const key = m.workspaceName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [data]);

  const patch = async (m: AdminMember, body: { role?: string; status?: string }) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}`, {
        method: "PATCH",
        headers: wsHeaders(m.workspaceId, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.message ?? "Failed to update");
      setData((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.map((x) =>
                x.id === m.id ? { ...x, ...updated } : x,
              ),
            }
          : prev,
      );
      toast({ title: "User updated" });
    } catch (err) {
      toast({
        title: "Could not update user",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: AdminMember) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}`, {
        method: "DELETE",
        headers: wsHeaders(m.workspaceId),
        credentials: "include",
      });
      const resp = await res.json();
      if (!res.ok) throw new Error(resp.message ?? "Failed to remove");
      setData((prev) =>
        prev ? { ...prev, members: prev.members.filter((x) => x.id !== m.id) } : prev,
      );
      toast({ title: `Removed ${m.email}` });
    } catch (err) {
      toast({
        title: "Could not remove user",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setRemoveTarget(null);
    }
  };

  const add = async () => {
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: addEmail.trim(),
          role: addRole,
          workspaceId: Number(addWorkspaceId),
        }),
      });
      const resp = await res.json();
      if (!res.ok) throw new Error(resp.message ?? "Failed to add user");
      toast({ title: `Added ${resp.email}` });
      setAddOpen(false);
      setAddEmail("");
      setAddRole("viewer");
      setAddWorkspaceId("");
      void load();
    } catch (err) {
      toast({
        title: "Could not add user",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserCog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">All Users</h1>
              <p className="text-sm text-muted-foreground">
                Manage users across every workspace on the platform.
              </p>
            </div>
          </div>
          <Button onClick={() => setAddOpen(true)} disabled={workspaces.length === 0}>
            <UserPlus className="mr-2 h-4 w-4" /> Add user
          </Button>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Platform super admins</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.superAdmins ?? []).map((email) => (
              <Badge key={email} variant="secondary" className="gap-1">
                {email}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Super admins are configured at the platform level and have full access to every
            workspace. They cannot be edited here.
          </p>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <Card className="py-16 text-center text-sm text-muted-foreground">
            No workspace members yet.
          </Card>
        ) : (
          grouped.map(([workspaceName, rows]) => (
            <Card key={workspaceName} className="overflow-hidden">
              <div className="border-b bg-muted/40 px-4 py-2.5">
                <h3 className="text-sm font-semibold">{workspaceName}</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => {
                    const busy = busyId === m.id;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.email}</TableCell>
                        <TableCell>
                          <Select
                            value={m.role}
                            onValueChange={(v) => patch(m, { role: v })}
                            disabled={busy}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {roleLabel(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={m.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.createdBy ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                patch(m, {
                                  status: m.status === "suspended" ? "active" : "suspended",
                                })
                              }
                            >
                              {m.status === "suspended" ? "Reactivate" : "Suspend"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busy}
                              onClick={() => setRemoveTarget(m)}
                              aria-label="Remove user"
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          ))
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Add a user to any workspace and assign their role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                placeholder="name@company.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-workspace">Workspace</Label>
              <Select value={addWorkspaceId} onValueChange={setAddWorkspaceId}>
                <SelectTrigger id="add-workspace">
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-role">Role</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger id="add-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={add}
              disabled={adding || !addEmail.trim() || !addWorkspaceId}
            >
              {adding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.email} will lose access to {removeTarget?.workspaceName}. This
              cannot be undone, but you can re-add them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && remove(removeTarget)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
