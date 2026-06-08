import { useState, useEffect, useCallback } from "react";
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
import { Users2, UserPlus, Loader2, Trash2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface Member {
  id: number;
  workspaceId: number;
  email: string;
  role: string;
  status: string;
  clerkUserId: string | null;
  createdBy: string | null;
  replyToEmail: string | null;
  createdAt: string;
}

function RoleBadge({ role }: { role: string }) {
  return <Badge variant="secondary">{roleLabel(role)}</Badge>;
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

function ReplyEmailCell({ member, busy, onSave }: { member: Member; busy: boolean; onSave: (v: string | null) => void }) {
  const [val, setVal] = useState(member.replyToEmail ?? "");
  useEffect(() => { setVal(member.replyToEmail ?? ""); }, [member.replyToEmail]);
  const dirty = (val.trim() || null) !== (member.replyToEmail ?? null);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="email"
        value={val}
        placeholder={member.email}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 w-[220px]"
        disabled={busy}
      />
      {dirty && (
        <Button size="sm" variant="outline" className="h-8" disabled={busy}
          onClick={() => onSave(val.trim() ? val.trim() : null)}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
      )}
    </div>
  );
}

export default function MembersPage() {
  const { currentWorkspace, me } = useWorkspace();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      setMembers(await res.json());
    } catch {
      toast({ title: "Could not load members", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Reload when the active workspace changes.
  useEffect(() => {
    void load();
  }, [load, currentWorkspace?.id]);

  const invite = async () => {
    setInviting(true);
    try {
      const res = await fetch(`${API_BASE}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to invite");
      toast({ title: `Invited ${data.email}` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
      void load();
    } catch (err) {
      toast({
        title: "Could not invite member",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const patch = async (m: Member, body: { role?: string; status?: string }) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to update");
      setMembers((prev) => prev.map((x) => (x.id === m.id ? data : x)));
      toast({ title: "Member updated" });
    } catch (err) {
      toast({
        title: "Could not update member",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const saveReplyEmail = async (m: Member, replyToEmail: string | null) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}/reply-email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ replyToEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to update");
      setMembers((prev) => prev.map((x) => (x.id === m.id ? data : x)));
      toast({ title: "Reply-to updated" });
    } catch (err) {
      toast({ title: "Could not update reply-to", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: Member) => {
    setBusyId(m.id);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to remove");
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      toast({ title: `Removed ${m.email}` });
    } catch (err) {
      toast({
        title: "Could not remove member",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setRemoveTarget(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Workspace Members</h1>
              <p className="text-sm text-muted-foreground">
                Manage who can access {currentWorkspace?.name ?? "this workspace"} and what they can do.
              </p>
            </div>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite member
          </Button>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No members yet. Invite someone to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Reply-to (replies route here)</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const isSelf = m.email === me?.email;
                  const busy = busyId === m.id;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ReplyEmailCell member={m} busy={busy} onSave={(v) => saveReplyEmail(m, v)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RoleBadge role={m.role} />
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
                        </div>
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
                            aria-label="Remove member"
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
          )}
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>
              Add someone to {currentWorkspace?.name ?? "this workspace"}. They'll get access
              the next time they sign in with this email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
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
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invite
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
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.email} will lose access to this workspace. This cannot be undone,
              but you can re-invite them later.
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
