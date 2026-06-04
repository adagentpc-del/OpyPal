import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { Building2, Plus, Loader2, ArrowRight, Pencil } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface Workspace {
  id: number;
  name: string;
  slug: string;
  shortCode: string | null;
  initials: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  name: string;
  slug: string;
  shortCode: string;
  initials: string;
  primaryColor: string;
  logoUrl: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  shortCode: "",
  initials: "",
  primaryColor: "",
  logoUrl: "",
};

export default function WorkspacesPage() {
  const { enterWorkspace, refresh } = useWorkspace();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rows, setRows] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/workspaces`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load workspaces");
      setRows(await res.json());
    } catch {
      toast({ title: "Could not load workspaces", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (w: Workspace) => {
    setEditId(w.id);
    setForm({
      name: w.name,
      slug: w.slug,
      shortCode: w.shortCode ?? "",
      initials: w.initials ?? "",
      primaryColor: w.primaryColor ?? "",
      logoUrl: w.logoUrl ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        shortCode: form.shortCode.trim() || undefined,
        initials: form.initials.trim() || undefined,
        primaryColor: form.primaryColor.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
      };
      const res = await fetch(
        editId ? `${API_BASE}/workspaces/${editId}` : `${API_BASE}/workspaces`,
        {
          method: editId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const resp = await res.json();
      if (!res.ok) throw new Error(resp.message ?? "Failed to save workspace");
      toast({ title: editId ? "Workspace updated" : `Created ${resp.name}` });
      setOpen(false);
      await load();
      await refresh();
    } catch (err) {
      toast({
        title: "Could not save workspace",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const enter = (w: Workspace) => {
    enterWorkspace(w.id);
    setLocation("/");
  };

  const setField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
              <p className="text-sm text-muted-foreground">
                Create, brand, and enter the workspaces on your platform.
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New workspace
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="py-16 text-center text-sm text-muted-foreground">
            No workspaces yet.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {w.logoUrl ? (
                          <img src={w.logoUrl} alt={w.name} className="h-8 w-8 rounded-lg object-contain" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                            {w.shortCode ?? w.initials ?? w.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{w.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">/{w.slug}</TableCell>
                    <TableCell>
                      {w.primaryColor ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="h-4 w-4 rounded-full border"
                            style={{ backgroundColor: w.primaryColor }}
                          />
                          <span className="text-xs text-muted-foreground">{w.primaryColor}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Default</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {w.isActive ? (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => enter(w)}>
                          Enter <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit workspace" : "New workspace"}</DialogTitle>
            <DialogDescription>
              {editId
                ? "Update this workspace's name and white-label branding."
                : "Create a workspace and set its white-label branding."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input id="ws-name" value={form.name} onChange={setField("name")} placeholder="Acme Co" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-slug">Slug</Label>
              <Input id="ws-slug" value={form.slug} onChange={setField("slug")} placeholder="acme" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-short">Short code</Label>
              <Input id="ws-short" value={form.shortCode} onChange={setField("shortCode")} placeholder="ACM" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-initials">Initials</Label>
              <Input id="ws-initials" value={form.initials} onChange={setField("initials")} placeholder="AC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-color">Primary color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ws-color"
                  type="color"
                  value={form.primaryColor || "#1b4f9c"}
                  onChange={setField("primaryColor")}
                  className="h-9 w-14 p-1"
                />
                <Input
                  value={form.primaryColor}
                  onChange={setField("primaryColor")}
                  placeholder="#1b4f9c"
                />
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ws-logo">Logo URL</Label>
              <Input id="ws-logo" value={form.logoUrl} onChange={setField("logoUrl")} placeholder="https://…/logo.png" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "Save changes" : "Create workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
