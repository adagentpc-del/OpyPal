import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useGetTemplateSets,
  getGetCampaignsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function ObCampaigns() {
  const { data: campaigns } = useGetCampaigns();
  const { data: templateSets } = useGetTemplateSets();
  const createMut = useCreateCampaign();
  const updateMut = useUpdateCampaign();
  const deleteMut = useDeleteCampaign();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", templateSetId: "", isActive: true });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });

  const openNew = () => { setForm({ name: "", description: "", templateSetId: "", isActive: true }); setEditId(null); setShowModal(true); };
  const openEdit = (c: any) => { setForm({ name: c.name, description: c.description || "", templateSetId: c.templateSetId || "", isActive: c.isActive ?? true }); setEditId(c.id); setShowModal(true); };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    const data = { name: form.name, description: form.description || undefined, templateSetId: form.templateSetId || undefined, isActive: form.isActive };
    if (editId) {
      updateMut.mutate({ id: editId, data }, {
        onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Campaign updated" }); },
        onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data }, {
        onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Campaign created" }); },
        onError: (err: any) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteMut.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: "Campaign deleted" }); },
      onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground mt-1">Organize contacts into campaigns.</p>
          </div>
          <Button onClick={openNew} className="rounded-xl gap-2 bg-primary text-white"><Plus className="h-4 w-4" /> New Campaign</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(campaigns || []).map((c: any) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{c.name}</h3>
                  {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-bold text-primary">{c.contactCount || 0}</span>
                  <span className="text-muted-foreground">contacts</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {c.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Created {format(new Date(c.createdAt), "MMM d, yyyy")}</p>
            </Card>
          ))}
        </div>

        {(!campaigns || campaigns.length === 0) && (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No campaigns yet. Create one to start organizing your outreach.</p>
          </Card>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{editId ? "Edit Campaign" : "New Campaign"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[80px]" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Default Sequence</label>
                <select value={form.templateSetId} onChange={(e) => setForm({ ...form, templateSetId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                  <option value="">None</option>
                  {(templateSets || []).map((s: any) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                Active
              </label>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="rounded-xl bg-primary text-white">{editId ? "Update" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
