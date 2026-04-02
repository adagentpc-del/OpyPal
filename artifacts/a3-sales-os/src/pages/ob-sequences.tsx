import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetTemplateSets,
  useCreateTemplateSet,
  useUpdateTemplateSet,
  useDeleteTemplateSet,
  useGetTemplateSetDetail,
  useCreateSequenceTemplate,
  useUpdateSequenceTemplate,
  useDeleteSequenceTemplate,
  getGetTemplateSetsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const SEGMENT_TYPES = ["general", "hotel", "agency", "developer", "venue"];

export default function ObSequences() {
  const { data: sets } = useGetTemplateSets();
  const createMut = useCreateTemplateSet();
  const updateMut = useUpdateTemplateSet();
  const deleteMut = useDeleteTemplateSet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", segmentType: "", isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplateSetsQueryKey() });

  const openNew = () => {
    setForm({ name: "", description: "", segmentType: "", isActive: true });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, description: s.description || "", segmentType: s.segmentType || "", isActive: s.isActive !== false });
    setEditId(s.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    const data: any = {
      name: form.name,
      description: form.description || undefined,
      segmentType: form.segmentType || undefined,
      isActive: form.isActive,
    };
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
            <p className="text-muted-foreground mt-1">Define reusable outbound email sequences with template steps.</p>
          </div>
          <Button onClick={openNew} className="rounded-xl gap-2 bg-primary text-white"><Plus className="h-4 w-4" /> New Sequence</Button>
        </div>

        <div className="space-y-4">
          {(sets || []).map((s: any) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="p-5 flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{s.name}</h3>
                    {s.segmentType && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{s.segmentType}</span>
                    )}
                    {s.isActive === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {s.stepCount || 0} steps | Created {format(new Date(s.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
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
              {expandedId === s.id && (
                <div className="border-t border-border">
                  <SequenceTemplates setId={s.id} />
                </div>
              )}
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
                  placeholder="e.g., Hotel Outreach Sequence"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Segment Type</label>
                <select value={form.segmentType} onChange={(e) => setForm({ ...form, segmentType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                  <option value="">None</option>
                  {SEGMENT_TYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe this sequence..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[80px]" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
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

function SequenceTemplates({ setId }: { setId: number }) {
  const { data: detail, refetch } = useGetTemplateSetDetail(setId);
  const createMut = useCreateSequenceTemplate();
  const updateMut = useUpdateSequenceTemplate();
  const deleteMut = useDeleteSequenceTemplate();
  const { toast } = useToast();

  const [editingStep, setEditingStep] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [previewStep, setPreviewStep] = useState<any>(null);

  const templates = detail?.templates || [];

  const [stepForm, setStepForm] = useState({
    stepNumber: 1,
    name: "",
    subject: "",
    body: "",
    delayDays: 0,
    isActive: true,
  });

  const openAdd = () => {
    const nextStep = templates.length + 1;
    const delays = [0, 3, 7, 14, 30, 120, 180];
    setStepForm({
      stepNumber: nextStep,
      name: `Step ${nextStep}`,
      subject: "",
      body: "",
      delayDays: delays[nextStep - 1] || 0,
      isActive: true,
    });
    setEditingStep(null);
    setShowAdd(true);
  };

  const openEditStep = (t: any) => {
    setStepForm({
      stepNumber: t.stepNumber,
      name: t.name || "",
      subject: t.subject || "",
      body: t.body || "",
      delayDays: t.delayDays,
      isActive: t.isActive !== false,
    });
    setEditingStep(t);
    setShowAdd(true);
  };

  const handleSaveStep = () => {
    if (!stepForm.body.trim()) return toast({ title: "Body is required", variant: "destructive" });
    const data: any = {
      stepNumber: stepForm.stepNumber,
      name: stepForm.name || undefined,
      subject: stepForm.subject || undefined,
      body: stepForm.body,
      delayDays: stepForm.delayDays,
      isActive: stepForm.isActive,
    };

    if (editingStep) {
      updateMut.mutate({ id: editingStep.id, data }, {
        onSuccess: () => { refetch(); setShowAdd(false); toast({ title: "Template updated" }); },
        onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      });
    } else {
      createMut.mutate({ id: setId, data }, {
        onSuccess: () => { refetch(); setShowAdd(false); toast({ title: "Template added" }); },
        onError: (err: any) => toast({ title: "Create failed", description: err.message, variant: "destructive" }),
      });
    }
  };

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Sequence Templates ({templates.length} steps)</h4>
        <Button variant="outline" size="sm" onClick={openAdd} className="rounded-lg gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Step
        </Button>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                {t.stepNumber}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name || `Step ${t.stepNumber}`}</span>
                  {t.isActive === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Off</span>}
                </div>
                {t.subject && <p className="text-xs text-muted-foreground truncate">{t.subject}</p>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">Day +{t.delayDays}</span>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewStep(previewStep?.id === t.id ? null : t)}>
                  <Eye className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditStep(t)}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                  deleteMut.mutate({ id: t.id }, {
                    onSuccess: () => { refetch(); toast({ title: "Deleted" }); },
                  });
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No templates yet. Add steps to build the sequence.</p>
      )}

      {previewStep && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-sm">Preview: {previewStep.name || `Step ${previewStep.stepNumber}`}</h5>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewStep(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          {previewStep.subject && (
            <div className="text-sm"><span className="text-muted-foreground">Subject:</span> {previewStep.subject}</div>
          )}
          <div className="text-sm whitespace-pre-wrap bg-background rounded-lg p-3 border border-border max-h-[200px] overflow-y-auto">
            {previewStep.body}
          </div>
          <p className="text-[10px] text-muted-foreground">Variables: {"{{first_name}}, {{company}}, {{title}}, {{intent_signal}}, {{greeting}}, {{intent_line}}, {{company_line}}"}</p>
        </div>
      )}

      {showAdd && (
        <div className="p-4 rounded-xl border border-border bg-background space-y-3">
          <h5 className="font-semibold text-sm">{editingStep ? "Edit Template" : "Add Template Step"}</h5>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Step #</label>
              <input type="number" value={stepForm.stepNumber} min={1}
                onChange={(e) => setStepForm({ ...stepForm, stepNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Delay (days)</label>
              <input type="number" value={stepForm.delayDays} min={0}
                onChange={(e) => setStepForm({ ...stepForm, delayDays: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Name</label>
              <input type="text" value={stepForm.name}
                onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Subject</label>
            <input type="text" value={stepForm.subject} placeholder="Email subject with {{first_name}} variables"
              onChange={(e) => setStepForm({ ...stepForm, subject: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Body *</label>
            <textarea value={stepForm.body} placeholder="Email body with {{variable}} placeholders..."
              onChange={(e) => setStepForm({ ...stepForm, body: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[120px] font-mono text-xs" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={stepForm.isActive}
                onChange={(e) => setStepForm({ ...stepForm, isActive: e.target.checked })} className="rounded" />
              Active
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="rounded-lg">Cancel</Button>
              <Button size="sm" onClick={handleSaveStep} className="rounded-lg bg-primary text-white">
                {editingStep ? "Update" : "Add Step"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
