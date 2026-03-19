import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, getGetTemplatesQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Edit2, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["Cold Email", "Follow-Up Email", "LinkedIn Message", "SMS", "Referral / Partner Outreach"];

export default function Templates() {
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: templates, isLoading } = useGetTemplates({ category: categoryFilter || undefined });
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "Cold Email", subject: "", body: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: "", category: "Cold Email", subject: "", body: "" });
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingTemplate(t);
    setForm({ name: t.name, category: t.category, subject: t.subject || "", body: t.body });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.body) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    const payload = { ...form, subject: form.subject || undefined };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template updated" }); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template created" }); } });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Template deleted" }); } });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">Standardized outreach and follow-up copy.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant={categoryFilter === "" ? "default" : "outline"} className="rounded-full text-sm" onClick={() => setCategoryFilter("")}>All</Button>
          {CATEGORIES.map((c) => (
            <Button key={c} variant={categoryFilter === c ? "default" : "outline"} className="rounded-full text-sm" onClick={() => setCategoryFilter(c)}>
              {c}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : templates?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No templates found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {templates?.map((template) => (
              <Card key={template.id} className="bg-card border-border/50 rounded-2xl flex flex-col hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-border/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">{template.category}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(template.body)} title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(template)} title="Edit"><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(template.id, template.name)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <h3 className="font-bold text-base leading-tight mt-1">{template.name}</h3>
                  {template.subject && (
                    <p className="text-sm mt-1.5 text-muted-foreground"><span className="font-medium text-foreground">Subj:</span> {template.subject}</p>
                  )}
                </div>
                <div className="p-5 flex-1 bg-muted/20 rounded-b-2xl">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{template.body}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{editingTemplate ? "Edit Template" : "New Template"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Subject (optional)</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Body</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[150px] resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl">{editingTemplate ? "Save" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
