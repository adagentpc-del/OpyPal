import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetTemplateSets, useCreateTemplateSet, useUpdateTemplateSet, useDeleteTemplateSet,
  useGetTemplateSetDetail, useCreateSequenceTemplate, useUpdateSequenceTemplate,
  useDeleteSequenceTemplate, getGetTemplateSetsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, Eye, Search, Filter, Clock, ArrowDown, ArrowUp, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const SEGMENT_TYPES = ["general", "hotel", "agency", "developer", "venue"];
const CATEGORIES = ["outreach", "hospitality", "events", "reactivation", "nurture", "custom"];
const DELAY_UNITS = ["days", "weeks", "months"];
const DELAY_PRESETS = [
  { label: "Same day", value: 0, unit: "days" },
  { label: "+3 days", value: 3, unit: "days" },
  { label: "+1 week", value: 1, unit: "weeks" },
  { label: "+2 weeks", value: 2, unit: "weeks" },
  { label: "+1 month", value: 1, unit: "months" },
  { label: "+3 months", value: 3, unit: "months" },
  { label: "+6 months", value: 6, unit: "months" },
];

function formatDelay(delayValue: number | null, delayUnit: string | null, delayDays: number): string {
  if (delayValue !== null && delayValue !== undefined && delayUnit) {
    if (delayValue === 0) return "Today";
    const unit = delayUnit === "months" ? (delayValue === 1 ? "month" : "months") :
                 delayUnit === "weeks" ? (delayValue === 1 ? "week" : "weeks") :
                 delayValue === 1 ? "day" : "days";
    return `+${delayValue} ${unit}`;
  }
  if (delayDays === 0) return "Today";
  return `+${delayDays} day${delayDays !== 1 ? "s" : ""}`;
}

function delayToDays(value: number, unit: string): number {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value;
}

export default function ObSequences() {
  const { data: sets } = useGetTemplateSets();
  const createMut = useCreateTemplateSet();
  const updateMut = useUpdateTemplateSet();
  const deleteMut = useDeleteTemplateSet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", segmentType: "", category: "", defaultUseCase: "", isActive: true });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplateSetsQueryKey() });

  const filtered = useMemo(() => {
    if (!search || !sets) return sets || [];
    const q = search.toLowerCase();
    return sets.filter((s: any) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q) || (s.segmentType || "").toLowerCase().includes(q));
  }, [sets, search]);

  const openNew = () => {
    setForm({ name: "", description: "", segmentType: "", category: "", defaultUseCase: "", isActive: true });
    setEditId(null);
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setForm({ name: s.name, description: s.description || "", segmentType: s.segmentType || "", category: s.category || "", defaultUseCase: s.defaultUseCase || "", isActive: s.isActive !== false });
    setEditId(s.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    const data: any = { name: form.name, description: form.description || undefined, segmentType: form.segmentType || undefined, category: form.category || undefined, defaultUseCase: form.defaultUseCase || undefined, isActive: form.isActive };
    if (editId) {
      updateMut.mutate({ id: editId, data }, { onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Sequence updated" }); } });
    } else {
      createMut.mutate({ data }, { onSuccess: () => { invalidate(); setShowModal(false); toast({ title: "Sequence created" }); } });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete sequence "${name}"? All steps will be removed.`)) return;
    deleteMut.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Sequence deleted" }); } });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-full pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Sequence Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">Define reusable outbound email sequences with timed follow-up steps.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Sequence
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input type="text" placeholder="Search sequences..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
        </div>

        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground rounded-2xl">
            <Clock className="h-10 w-10 text-border mx-auto mb-2" />
            <p>No sequences found. Create one to define your outbound cadence.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Create Sequence</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((s: any) => (
              <Card key={s.id} className={`overflow-hidden rounded-2xl border-border/50 ${s.isActive === false ? "opacity-60" : ""}`}>
                <div className="p-4 sm:p-5 flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base sm:text-lg">{s.name}</h3>
                      {s.segmentType && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{s.segmentType}</span>}
                      {s.category && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{s.category}</span>}
                      {s.isActive === false && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>}
                    </div>
                    {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}
                    {s.defaultUseCase && <p className="text-xs text-muted-foreground mt-0.5">Use case: {s.defaultUseCase}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{s.stepCount || 0} steps | Created {format(new Date(s.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                      {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id, s.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {expandedId === s.id && (
                  <div className="border-t border-border">
                    <SequenceSteps setId={s.id} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{editId ? "Edit Sequence" : "New Sequence"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Hospitality Intro Sequence"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Segment</label>
                  <select value={form.segmentType} onChange={(e) => setForm({ ...form, segmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                    <option value="">None</option>
                    {SEGMENT_TYPES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                    <option value="">None</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe this sequence..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[60px]" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Default Use Case</label>
                <input type="text" value={form.defaultUseCase} onChange={(e) => setForm({ ...form, defaultUseCase: e.target.value })} placeholder="e.g., Initial outreach to hotel contacts"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" /> Active
              </label>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card rounded-b-2xl">
              <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="rounded-xl bg-primary text-white">{editId ? "Update" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function SequenceSteps({ setId }: { setId: number }) {
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
    stepNumber: 1, name: "", subject: "", body: "", stepLabel: "",
    delayValue: 0, delayUnit: "days", channel: "email", isActive: true,
  });

  const openAdd = () => {
    const nextStep = templates.length + 1;
    setStepForm({ stepNumber: nextStep, name: `Step ${nextStep}`, subject: "", body: "", stepLabel: "", delayValue: 0, delayUnit: "days", channel: "email", isActive: true });
    setEditingStep(null);
    setShowAdd(true);
  };

  const openEditStep = (t: any) => {
    setStepForm({
      stepNumber: t.stepNumber, name: t.name || "", subject: t.subject || "", body: t.body || "", stepLabel: t.stepLabel || "",
      delayValue: t.delayValue ?? t.delayDays ?? 0, delayUnit: t.delayUnit || "days", channel: t.channel || "email", isActive: t.isActive !== false,
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
      delayDays: delayToDays(stepForm.delayValue, stepForm.delayUnit),
      delayValue: stepForm.delayValue,
      delayUnit: stepForm.delayUnit,
      stepLabel: stepForm.stepLabel || undefined,
      channel: stepForm.channel,
      isActive: stepForm.isActive,
    };

    if (editingStep) {
      updateMut.mutate({ id: editingStep.id, data }, { onSuccess: () => { refetch(); setShowAdd(false); toast({ title: "Step updated" }); } });
    } else {
      createMut.mutate({ id: setId, data }, { onSuccess: () => { refetch(); setShowAdd(false); toast({ title: "Step added" }); } });
    }
  };

  const handleMoveStep = (stepId: number, direction: "up" | "down") => {
    const sorted = [...templates].sort((a: any, b: any) => a.stepNumber - b.stepNumber);
    const idx = sorted.findIndex((t: any) => t.id === stepId);
    if (direction === "up" && idx > 0) {
      const swapWith = sorted[idx - 1];
      const current = sorted[idx];
      updateMut.mutate({ id: current.id, data: { stepNumber: swapWith.stepNumber } as any }, { onSuccess: () => {
        updateMut.mutate({ id: swapWith.id, data: { stepNumber: current.stepNumber } as any }, { onSuccess: () => refetch() });
      }});
    } else if (direction === "down" && idx < sorted.length - 1) {
      const swapWith = sorted[idx + 1];
      const current = sorted[idx];
      updateMut.mutate({ id: current.id, data: { stepNumber: swapWith.stepNumber } as any }, { onSuccess: () => {
        updateMut.mutate({ id: swapWith.id, data: { stepNumber: current.stepNumber } as any }, { onSuccess: () => refetch() });
      }});
    }
  };

  const applyPreset = (preset: typeof DELAY_PRESETS[0]) => {
    setStepForm({ ...stepForm, delayValue: preset.value, delayUnit: preset.unit });
  };

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Sequence Steps ({templates.length})</h4>
        <Button variant="outline" size="sm" onClick={openAdd} className="rounded-lg gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add Step
        </Button>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-2">
          {[...templates].sort((a: any, b: any) => a.stepNumber - b.stepNumber).map((t: any, i: number) => (
            <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50 ${t.isActive === false ? "opacity-50 bg-muted/10" : "bg-muted/30"}`}>
              <div className="flex flex-col gap-0.5">
                <button className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => handleMoveStep(t.id, "up")}><ArrowUp className="h-3 w-3" /></button>
                <button className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === templates.length - 1} onClick={() => handleMoveStep(t.id, "down")}><ArrowDown className="h-3 w-3" /></button>
              </div>
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{t.stepNumber}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name || `Step ${t.stepNumber}`}</span>
                  {t.stepLabel && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{t.stepLabel}</span>}
                  {t.isActive === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Off</span>}
                </div>
                {t.subject && <p className="text-xs text-muted-foreground truncate">{t.subject}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                {(t.delayUnit === "months" || (t.delayValue && t.delayUnit === "months")) ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    <Calendar className="h-3 w-3 inline mr-0.5" />{formatDelay(t.delayValue, t.delayUnit, t.delayDays)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDelay(t.delayValue, t.delayUnit, t.delayDays)}</span>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewStep(previewStep?.id === t.id ? null : t)}><Eye className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditStep(t)}><Edit2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { deleteMut.mutate({ id: t.id }, { onSuccess: () => { refetch(); toast({ title: "Step deleted" }); } }); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No steps yet. Add steps to build the sequence.</p>
      )}

      {previewStep && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-sm">Preview: {previewStep.name || `Step ${previewStep.stepNumber}`}</h5>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewStep(null)}><X className="h-3 w-3" /></Button>
          </div>
          {previewStep.subject && <div className="text-sm"><span className="text-muted-foreground">Subject:</span> {previewStep.subject}</div>}
          <div className="text-sm whitespace-pre-wrap bg-background rounded-lg p-3 border border-border max-h-[200px] overflow-y-auto">{previewStep.body}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Delay: {formatDelay(previewStep.delayValue, previewStep.delayUnit, previewStep.delayDays)}</span>
            <span>Channel: {previewStep.channel || "email"}</span>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="p-4 rounded-xl border border-border bg-background space-y-3">
          <h5 className="font-semibold text-sm">{editingStep ? "Edit Step" : "Add Step"}</h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Step #</label>
              <input type="number" value={stepForm.stepNumber} min={1} onChange={(e) => setStepForm({ ...stepForm, stepNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Delay Amount</label>
              <input type="number" value={stepForm.delayValue} min={0} onChange={(e) => setStepForm({ ...stepForm, delayValue: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Delay Unit</label>
              <select value={stepForm.delayUnit} onChange={(e) => setStepForm({ ...stepForm, delayUnit: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                {DELAY_UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Channel</label>
              <select value={stepForm.channel} onChange={(e) => setStepForm({ ...stepForm, channel: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
                <option value="call">Call</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground mr-1 self-center">Presets:</span>
            {DELAY_PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => applyPreset(p)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${stepForm.delayValue === p.value && stepForm.delayUnit === p.unit ? "bg-primary text-white border-primary" : "border-border hover:bg-muted/50"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Step Name</label>
              <input type="text" value={stepForm.name} onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Step Label</label>
              <input type="text" value={stepForm.stepLabel} onChange={(e) => setStepForm({ ...stepForm, stepLabel: e.target.value })} placeholder="e.g., 1 month check in"
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Subject</label>
            <input type="text" value={stepForm.subject} placeholder="Email subject with {{company}} variables" onChange={(e) => setStepForm({ ...stepForm, subject: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Body *</label>
            <textarea value={stepForm.body} placeholder="Email body with {{variable}} placeholders..." onChange={(e) => setStepForm({ ...stepForm, body: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background min-h-[120px] resize-y" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={stepForm.isActive} onChange={(e) => setStepForm({ ...stepForm, isActive: e.target.checked })} className="rounded" /> Active
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="rounded-lg">Cancel</Button>
              <Button size="sm" onClick={handleSaveStep} className="rounded-lg bg-primary text-white">{editingStep ? "Update" : "Add Step"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
