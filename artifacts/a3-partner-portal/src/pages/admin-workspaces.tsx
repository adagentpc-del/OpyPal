import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout";
import { useWorkspace } from "@/hooks/use-workspace";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, UserPlus, Trash2 } from "lucide-react";

interface Workspace {
  id: number;
  name: string;
  slug: string;
  shortCode?: string | null;
  roleLabel?: string | null;
}

interface Member {
  id: number;
  email: string;
  role: string;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      message = JSON.parse(text).message ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export default function AdminWorkspaces() {
  const { me, refresh } = useWorkspace();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [memberEmail, setMemberEmail] = useState("");

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => apiFetch<Workspace[]>("/workspaces"),
    enabled: !!me?.isSuperAdmin,
  });

  const membersQuery = useQuery({
    queryKey: ["workspace-members", selectedId],
    queryFn: () => apiFetch<Member[]>(`/workspaces/${selectedId}/members`),
    enabled: !!selectedId && !!me?.isSuperAdmin,
  });

  const createWorkspace = useMutation({
    mutationFn: (body: { name: string; shortCode?: string }) =>
      apiFetch<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      setName("");
      setShortCode("");
      toast({ title: "Workspace created" });
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await refresh();
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Could not create", description: err.message }),
  });

  const assignMember = useMutation({
    mutationFn: (body: { email: string }) =>
      apiFetch<Member>(`/workspaces/${selectedId}/members`, {
        method: "POST",
        body: JSON.stringify({ ...body, role: "workspace_admin" }),
      }),
    onSuccess: async () => {
      setMemberEmail("");
      toast({ title: "Admin assigned" });
      await qc.invalidateQueries({ queryKey: ["workspace-members", selectedId] });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Could not assign", description: err.message }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) =>
      apiFetch<void>(`/workspaces/${selectedId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      toast({ title: "Member removed" });
      await qc.invalidateQueries({ queryKey: ["workspace-members", selectedId] });
    },
    onError: (err: Error) =>
      toast({ variant: "destructive", title: "Could not remove", description: err.message }),
  });

  if (!me) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading…</p>
      </AdminLayout>
    );
  }

  if (!me.isSuperAdmin) {
    return (
      <AdminLayout>
        <Card className="max-w-lg">
          <CardHeader>
            <h2 className="text-lg font-semibold">Not authorized</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Workspace management is available to platform super admins only.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const workspaces = workspacesQuery.data ?? [];
  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-2">
        <Building2 className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Workspaces</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Create a workspace</h3>
            <p className="text-sm text-muted-foreground">
              Add a new tenant. A slug and initials are derived automatically.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                createWorkspace.mutate({
                  name: name.trim(),
                  shortCode: shortCode.trim() || undefined,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="ws-name">Workspace name</Label>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Move Mi"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ws-short">Short code (optional)</Label>
                <Input
                  id="ws-short"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value)}
                  placeholder="e.g. MM"
                  maxLength={6}
                />
              </div>
              <Button type="submit" disabled={createWorkspace.isPending}>
                {createWorkspace.isPending ? "Creating…" : "Create workspace"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">All workspaces</h3>
            <p className="text-sm text-muted-foreground">
              Select a workspace to manage its admins.
            </p>
          </CardHeader>
          <CardContent>
            {workspacesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspaces yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {workspaces.map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={() => setSelectedId(w.id)}
                      className={`flex w-full items-center justify-between px-2 py-3 text-left transition-colors hover:bg-gray-50 ${
                        selectedId === w.id ? "bg-gray-50" : ""
                      }`}
                    >
                      <span className="font-medium">{w.name}</span>
                      <span className="text-xs text-muted-foreground">/{w.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader>
            <h3 className="font-semibold">Admins — {selected.name}</h3>
            <p className="text-sm text-muted-foreground">
              Assign an admin by email. They gain access when they sign in with
              that email.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!memberEmail.trim()) return;
                assignMember.mutate({ email: memberEmail.trim() });
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="member-email">Admin email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="admin@company.com"
                  required
                />
              </div>
              <Button type="submit" disabled={assignMember.isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                {assignMember.isPending ? "Assigning…" : "Assign admin"}
              </Button>
            </form>

            {membersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            ) : (membersQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No admins assigned yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(membersQuery.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="font-medium">{m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember.mutate(m.id)}
                      disabled={removeMember.isPending}
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}
