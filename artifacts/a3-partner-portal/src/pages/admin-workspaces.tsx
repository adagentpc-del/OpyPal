import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace, type WorkspaceSummary } from "@/hooks/use-workspace";
import { Building2, Plus, Trash2, UserPlus } from "lucide-react";

interface Member {
  id: number;
  workspaceId: number;
  email: string;
  role: string;
  clerkUserId?: string | null;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function MembersPanel({ workspace }: { workspace: WorkspaceSummary }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["workspace-members", workspace.id],
    queryFn: () => api<Member[]>(`/api/workspaces/${workspace.id}/members`),
  });

  const addMember = useMutation({
    mutationFn: () =>
      api<Member>(`/api/workspaces/${workspace.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role: "workspace_admin" }),
      }),
    onSuccess: () => {
      toast({ title: "Admin assigned", description: `${email} can now access ${workspace.name}.` });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["workspace-members", workspace.id] });
    },
    onError: (e: Error) => toast({ title: "Could not assign admin", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) =>
      api<{ message: string }>(`/api/workspaces/${workspace.id}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["workspace-members", workspace.id] });
    },
    onError: (e: Error) => toast({ title: "Could not remove member", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`email-${workspace.id}`} className="text-xs">
            Assign admin by email
          </Label>
          <Input
            id={`email-${workspace.id}`}
            type="email"
            placeholder="admin@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button
          onClick={() => addMember.mutate()}
          disabled={!email || addMember.isPending}
          size="sm"
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Assign
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admins assigned yet.</p>
      ) : (
        <div className="space-y-1">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{m.email}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {m.role}
                </Badge>
                {m.clerkUserId && (
                  <Badge variant="outline" className="text-[10px] text-green-600">
                    active
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeMember.mutate(m.id)}
                disabled={removeMember.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateWorkspaceDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { refresh } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1b4f9c");

  const create = useMutation({
    mutationFn: () =>
      api<WorkspaceSummary>(`/api/workspaces`, {
        method: "POST",
        body: JSON.stringify({
          name,
          shortCode: shortCode || undefined,
          primaryColor: primaryColor || undefined,
        }),
      }),
    onSuccess: async () => {
      toast({ title: "Workspace created", description: `${name} is ready.` });
      setName("");
      setShortCode("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      await refresh();
    },
    onError: (e: Error) =>
      toast({ title: "Could not create workspace", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" />
          New workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              placeholder="Acme Studios"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ws-code">Short code (optional)</Label>
            <Input
              id="ws-code"
              placeholder="ACM"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ws-color">Primary color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ws-color"
                type="color"
                className="w-16 p-1 h-9"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">{primaryColor}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminWorkspaces() {
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<WorkspaceSummary[]>(`/api/workspaces`),
  });

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Workspaces
            </h2>
            <p className="text-muted-foreground">
              Create tenant workspaces and assign an admin to each.
            </p>
          </div>
          <CreateWorkspaceDialog />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading workspaces…</p>
        ) : (
          <div className="space-y-4">
            {workspaces.map((w) => (
              <Card key={w.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ backgroundColor: w.primaryColor || "#1b4f9c" }}
                    >
                      {w.initials || w.shortCode || w.name.slice(0, 2).toUpperCase()}
                    </span>
                    {w.name}
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {w.slug}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MembersPanel workspace={w} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
