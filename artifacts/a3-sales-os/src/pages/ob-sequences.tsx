import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetTemplateSets,
  useCreateTemplateSet,
  useUpdateTemplateSet,
  useDeleteTemplateSet,
  getGetTemplateSetsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const STEP_LABELS = [
  { step: 1, day: 0, label: "Initial Email" },
  { step: 2, day: 3, label: "Follow-Up #1" },
  { step: 3, day: 7, label: "Follow-Up #2" },
  { step: 4, day: 14, label: "Follow-Up #3" },
  { step: 5, day: 30, label: "Follow-Up #4" },
  { step: 6, day: 120, label: "Reactivation #1" },
  { step: 7, day: 180, label: "Reactivation #2" },
];

export default function ObSequences() {
  const { data: sets } = useGetTemplateSets();
  const createMut = useCreateTemplateSet();
  const updateMut = useUpdateTemplateSet();
  const deleteMut = useDeleteTemplateSet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplateSetsQueryKey() });

  const openNew = () => { setForm({ name: "", description: "" }); setEditId(null); setShowModal(true); };
  const openEdit = (s: any) => { setForm({ name: s.name, description: s.description || "" }); setEditId(s.id); setShowModal(true); };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    const data = { name: form.name, description: form.description || undefined };
    if (editId) {
      updateMut.mutate({ id: editId, data }, {
        onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Sequence updated" }); },
        onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data }, {
        onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Sequence created" }); },
        onError: (err: any) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sequences</h1>
            <p className="text-muted-foreground mt-1">Define reusable outbound email sequences.</p>
          </div>
          <Button onClick={openNew} className="rounded-xl gap-2 bg-primary text-white"><Plus className="h-4 w-4" /> New Sequence</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(sets || []).map((s: any) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{s.name}</h3>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    deleteMut.mutate({ id: s.id }, { onSuccess: () => { invalidate(); toast({ title: "Deleted" }); } });
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                {STEP_LABELS.map(sl => (
                  <div key={sl.step} className="flex items-center gap-3 text-sm px-3 py-1.5 rounded-lg bg-muted/30">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{sl.step}</span>
                    <span className="font-medium">{sl.label}</span>
                    <span className="text-muted-foreground ml-auto">Day {sl.day}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Created {format(new Date(s.createdAt), "MMM d, yyyy")}</p>
            </Card>
          ))}
        </div>

        {(!sets || sets.length === 0) && (
          <Card className="p-8 text-center text-muted-foreground">
            <p>No sequences yet. Create one to define your outbound cadence.</p>
          </Card>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{editId ? "Edit Sequence" : "New Sequence"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., A3 Default Sequence"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe this sequence..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[80px]" />
              </div>
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
