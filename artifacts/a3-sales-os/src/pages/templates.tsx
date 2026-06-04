import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useGetTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, getGetTemplatesQueryKey, useGetLeads, useUpdateLead, getGetLeadsQueryKey, getGetDashboardQueryKey, useGetAssets, useGetTemplateSets } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Edit2, Trash2, X, Mail, Check, Paperclip, FileText, Link2, Search, Filter, Eye, EyeOff, Archive, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["Cold Email", "Follow-Up Email", "LinkedIn Message", "SMS", "Referral / Partner Outreach", "Hotels and Hospitality", "Venues and Convention Centers", "Agencies and Brand Activations", "Developers and Commercial Real Estate", "Sports and Entertainment", "Event Producers and Festivals", "Printing and Production Partners", "General Intro", "Reactivation"];
const TYPES = ["one_off", "intro", "follow_up", "reactivation", "event", "custom"];
const TYPE_LABELS: Record<string, string> = { one_off: "One-Off", intro: "Intro", follow_up: "Follow-Up", reactivation: "Reactivation", event: "Event", custom: "Custom" };
const TYPE_COLORS: Record<string, string> = { one_off: "bg-gray-100 text-gray-700", intro: "bg-blue-100 text-blue-700", follow_up: "bg-amber-100 text-amber-700", reactivation: "bg-purple-100 text-purple-700", event: "bg-emerald-100 text-emerald-700", custom: "bg-gray-100 text-gray-600" };

function getNextBusinessDay(fromDate: Date, daysAhead: number): string {
  const d = new Date(fromDate);
  let added = 0;
  while (added < daysAhead) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().split("T")[0];
}

export default function Templates() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  const { data: templates, isLoading } = useGetTemplates({ category: categoryFilter || undefined });
  const { data: templateSets } = useGetTemplateSets();
  const { data: allAssets } = useGetAssets();
  const { data: leads } = useGetLeads();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const updateLeadMutation = useUpdateLead();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "Cold Email", type: "custom", subject: "", body: "", description: "", linkedAssetIds: "", linkedSequenceId: null as number | null, isActive: true, audienceTags: "" });

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTemplate, setSendTemplate] = useState<any>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const [sendLeadId, setSendLeadId] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmLeadId, setConfirmLeadId] = useState<number | null>(null);
  const [confirmLeadName, setConfirmLeadName] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });

  const filtered = useMemo(() => {
    let list = templates || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t: any) => t.name.toLowerCase().includes(q) || (t.subject || "").toLowerCase().includes(q) || (t.body || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter((t: any) => t.type === typeFilter);
    if (activeFilter === "active") list = list.filter((t: any) => t.isActive !== false);
    if (activeFilter === "inactive") list = list.filter((t: any) => t.isActive === false);
    return list;
  }, [templates, search, typeFilter, activeFilter]);

  const sequenceMap = useMemo(() => {
    const m: Record<number, string> = {};
    (templateSets || []).forEach((s: any) => { m[s.id] = s.name; });
    return m;
  }, [templateSets]);

  const leadEmails = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l: any) => l.email).map((l: any) => ({ id: l.id, email: l.email, company: l.companyName, contact: l.contactName }));
  }, [leads]);

  const filteredLeadEmails = useMemo(() => {
    if (!sendSearch) return leadEmails;
    const q = sendSearch.toLowerCase();
    return leadEmails.filter((l) => l.email.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) || l.contact?.toLowerCase().includes(q));
  }, [leadEmails, sendSearch]);

  const formLinkedIds = useMemo(() => {
    return form.linkedAssetIds ? form.linkedAssetIds.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
  }, [form.linkedAssetIds]);

  const toggleFormAsset = (assetId: number) => {
    const ids = formLinkedIds.includes(assetId) ? formLinkedIds.filter(id => id !== assetId) : [...formLinkedIds, assetId];
    setForm({ ...form, linkedAssetIds: ids.join(",") });
  };

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: "", category: "Cold Email", type: "custom", subject: "", body: "", description: "", linkedAssetIds: "", linkedSequenceId: null, isActive: true, audienceTags: "" });
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingTemplate(t);
    setForm({
      name: t.name, category: t.category, type: t.type || "custom", subject: t.subject || "", body: t.body,
      description: t.description || "", linkedAssetIds: t.linkedAssetIds || "",
      linkedSequenceId: t.linkedSequenceId || t.linkedTemplateSetId || null,
      isActive: t.isActive !== false, audienceTags: t.audienceTags || "",
    });
    setModalOpen(true);
  };

  const handleDuplicate = (t: any) => {
    const payload: any = {
      name: `${t.name} (Copy)`, category: t.category, type: t.type || "custom", subject: t.subject || undefined, body: t.body,
      description: t.description || undefined, linkedAssetIds: t.linkedAssetIds || undefined,
      linkedSequenceId: t.linkedSequenceId || t.linkedTemplateSetId || undefined,
      isActive: true, audienceTags: t.audienceTags || undefined,
    };
    createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); toast({ title: "Template duplicated" }); } });
  };

  const handleToggleActive = (t: any) => {
    const newActive = !t.isActive;
    updateMutation.mutate({ id: t.id, data: { isActive: newActive } as any }, {
      onSuccess: () => { invalidate(); toast({ title: newActive ? "Template activated" : "Template archived" }); },
    });
  };

  const handleSave = () => {
    if (!form.name || !form.body) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...form,
      subject: form.subject || undefined,
      linkedAssetIds: form.linkedAssetIds || undefined,
      description: form.description || undefined,
      linkedSequenceId: form.linkedSequenceId || undefined,
      linkedTemplateSetId: form.linkedSequenceId || undefined,
      audienceTags: form.audienceTags || undefined,
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template updated" }); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template created" }); } });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Template deleted" }); } });
  };

  const openSendModal = (template: any) => { setSendTemplate(template); setSendEmail(""); setSendSearch(""); setSendLeadId(null); setSendModalOpen(true); };

  const handleSendViaOutlook = () => {
    if (!sendEmail) { toast({ title: "Please enter or select a recipient email", variant: "destructive" }); return; }
    const subject = encodeURIComponent(sendTemplate?.subject || "");
    const body = encodeURIComponent((sendTemplate?.body || "").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    window.location.href = `mailto:${encodeURIComponent(sendEmail)}?subject=${subject}&body=${body}`;
    setSendModalOpen(false);
    const matchedLead = sendLeadId ? leads?.find((l: any) => l.id === sendLeadId) : leads?.find((l: any) => l.email === sendEmail);
    if (matchedLead) { setConfirmLeadId(matchedLead.id); setConfirmLeadName(matchedLead.companyName || matchedLead.contactName || sendEmail); setTimeout(() => setConfirmModalOpen(true), 800); }
    else toast({ title: "Email client opened" });
  };

  const handleConfirmSent = (didSend: boolean) => {
    if (didSend && confirmLeadId) {
      const today = new Date();
      updateLeadMutation.mutate({ id: confirmLeadId, data: { status: "Contacted", lastContactDate: today.toISOString().split("T")[0], nextStep: "Awaiting reply", nextFollowUpDate: getNextBusinessDay(today, 2) } as any }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); toast({ title: "Lead updated to Contacted" }); },
      });
    }
    setConfirmModalOpen(false);
  };

  const handleCopy = (t: any) => {
    const parts: string[] = [];
    if (t.subject) parts.push(`Subject: ${t.subject}`);
    parts.push("", t.body);
    navigator.clipboard.writeText(parts.join("\n"));
    toast({ title: "Email copied to clipboard" });
  };

  const activeFilters = [categoryFilter, typeFilter, activeFilter !== "all"].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-full pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Email Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage outreach and follow-up templates.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </div>

        <Card className="p-3 sm:p-4 bg-card border-border/50 rounded-2xl flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className={`rounded-xl ${activeFilters > 0 ? "border-primary text-primary" : ""}`} onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-2" /> Filters {activeFilters > 0 && `(${activeFilters})`}
              </Button>
              <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setViewMode(viewMode === "table" ? "cards" : "table")} title={viewMode === "table" ? "Card view" : "Table view"}>
                {viewMode === "table" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/50 rounded-xl">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Types</option>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
              <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Archived</option>
              </select>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setCategoryFilter(""); setTypeFilter(""); setActiveFilter("all"); }}>
                  Clear
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 text-border mx-auto mb-2" />
              <p>No templates found.</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Create Template</Button>
            </div>
          ) : viewMode === "table" ? (
            <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold hidden sm:table-cell">Category</th>
                      <th className="px-4 py-3 font-semibold hidden md:table-cell">Type</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell">Subject</th>
                      <th className="px-4 py-3 font-semibold hidden xl:table-cell">Linked Sequence</th>
                      <th className="px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtered.map((t: any) => {
                      const seqName = (t.linkedSequenceId && sequenceMap[t.linkedSequenceId]) || (t.linkedTemplateSetId && sequenceMap[t.linkedTemplateSetId]) || null;
                      return (
                        <tr key={t.id} className={`hover:bg-muted/30 transition-colors cursor-pointer ${t.isActive === false ? "opacity-50" : ""}`} onClick={() => setPreviewTemplate(t)}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">{t.name}</div>
                            {t.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description}</p>}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.category}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type || "custom"]}`}>{TYPE_LABELS[t.type || "custom"]}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{t.subject || "-"}</td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {seqName ? <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">⚡ {seqName}</span> : <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {t.isActive !== false
                              ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                              : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Archived</span>}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewTemplate(t)} title="Preview"><Eye className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSendModal(t)} title="Send"><Mail className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(t)} title="Copy"><Copy className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(t)} title="Duplicate"><Plus className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)} title="Edit"><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(t)} title={t.isActive !== false ? "Archive" : "Activate"}>
                                {t.isActive !== false ? <Archive className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id, t.name)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-auto flex-1">
              {filtered.map((t: any) => {
                const seqName = (t.linkedSequenceId && sequenceMap[t.linkedSequenceId]) || (t.linkedTemplateSetId && sequenceMap[t.linkedTemplateSetId]) || null;
                return (
                  <Card key={t.id} className={`bg-card border-border/50 rounded-2xl flex flex-col hover:shadow-md transition-shadow ${t.isActive === false ? "opacity-50" : ""}`}>
                    <div className="p-4 border-b border-border/50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{t.category}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${TYPE_COLORS[t.type || "custom"]}`}>{TYPE_LABELS[t.type || "custom"]}</span>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id, t.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <h3 className="font-bold text-base leading-tight">{t.name}</h3>
                      {t.subject && <p className="text-sm mt-1 text-muted-foreground"><span className="font-medium text-foreground">Subj:</span> {t.subject}</p>}
                      {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      {seqName && <p className="text-xs text-blue-700 mt-1">⚡ {seqName}</p>}
                    </div>
                    <div className="p-4 flex-1 bg-muted/20">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{t.body}</p>
                    </div>
                    <div className="px-4 py-3 border-t border-border/50 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5 flex-1" onClick={() => openSendModal(t)}><Mail className="h-3 w-3" /> Send</Button>
                      <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5 flex-1" onClick={() => handleCopy(t)}><Copy className="h-3 w-3" /> Copy</Button>
                      <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5" onClick={() => handleDuplicate(t)}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? "s" : ""}</div>
        </Card>
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewTemplate(null)} />
          <div className="relative bg-card w-full max-w-lg h-full overflow-y-auto border-l border-border z-10 shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold">Template Preview</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => { openEdit(previewTemplate); setPreviewTemplate(null); }}><Edit2 className="h-3.5 w-3.5" /> Edit</Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewTemplate(null)}><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">{previewTemplate.category}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${TYPE_COLORS[previewTemplate.type || "custom"]}`}>{TYPE_LABELS[previewTemplate.type || "custom"]}</span>
                {previewTemplate.isActive !== false ? <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700">Active</span> : <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-500">Archived</span>}
              </div>
              <h3 className="text-xl font-bold">{previewTemplate.name}</h3>
              {previewTemplate.description && <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>}
              {previewTemplate.audienceTags && <p className="text-xs text-muted-foreground">Tags: {previewTemplate.audienceTags}</p>}
              {(() => {
                const seqName = (previewTemplate.linkedSequenceId && sequenceMap[previewTemplate.linkedSequenceId]) || (previewTemplate.linkedTemplateSetId && sequenceMap[previewTemplate.linkedTemplateSetId]) || null;
                return seqName ? <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">⚡ Linked Sequence: {seqName}</p> : null;
              })()}
              {previewTemplate.subject && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <span className="text-xs font-medium text-muted-foreground">Subject</span>
                  <p className="text-sm font-medium mt-0.5">{previewTemplate.subject}</p>
                </div>
              )}
              <div className="bg-muted/30 rounded-xl p-4">
                <span className="text-xs font-medium text-muted-foreground">Body</span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{previewTemplate.body}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" className="rounded-xl bg-primary text-white gap-1.5" onClick={() => openSendModal(previewTemplate)}><Mail className="h-3.5 w-3.5" /> Send via Outlook</Button>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => handleCopy(previewTemplate)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => handleDuplicate(previewTemplate)}><Plus className="h-3.5 w-3.5" /> Duplicate</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{editingTemplate ? "Edit Template" : "New Template"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium block mb-1.5">Name *</label>
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
                  <label className="text-sm font-medium block mb-1.5">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                    {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Subject</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Body *</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[140px] resize-y" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Description / Internal Notes</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[60px] resize-y"
                  placeholder="Internal notes about when to use this template..." />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Linked Sequence</label>
                <select value={form.linkedSequenceId || ""} onChange={(e) => setForm({ ...form, linkedSequenceId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  <option value="">None</option>
                  {(templateSets || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Audience Tags</label>
                <input type="text" value={form.audienceTags} onChange={(e) => setForm({ ...form, audienceTags: e.target.value })}
                  placeholder="e.g. hospitality, events, agencies"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              {allAssets && allAssets.length > 0 && (
                <div>
                  <label className="text-sm font-medium block mb-1.5"><Paperclip className="h-3.5 w-3.5 inline mr-1" /> Linked Assets</label>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto border border-border rounded-xl p-2">
                    {allAssets.map((a: any) => (
                      <label key={a.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 ${formLinkedIds.includes(a.id) ? "bg-primary/5" : ""}`}>
                        <input type="checkbox" checked={formLinkedIds.includes(a.id)} onChange={() => toggleFormAsset(a.id)} className="rounded" />
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{a.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card rounded-b-2xl">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl">{editingTemplate ? "Save" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSendModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Send via Outlook</h2>
              <Button variant="ghost" size="icon" onClick={() => setSendModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Template</p>
                <p className="text-sm font-semibold">{sendTemplate?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Recipient Email</label>
                <input type="email" value={sendEmail} onChange={(e) => { setSendEmail(e.target.value); setSendSearch(e.target.value); setSendLeadId(null); }}
                  placeholder="Enter email or search leads..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              {sendSearch && filteredLeadEmails.length > 0 && (
                <div className="border border-border rounded-xl max-h-40 overflow-y-auto">
                  {filteredLeadEmails.map((lead, i) => (
                    <button key={i} type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex justify-between items-center border-b border-border/30 last:border-0"
                      onClick={() => { setSendEmail(lead.email); setSendSearch(""); setSendLeadId(lead.id); }}>
                      <span className="font-medium truncate">{lead.email}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{lead.contact || lead.company || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSendModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSendViaOutlook} className="bg-primary text-white rounded-xl gap-2"><Mail className="h-4 w-4" /> Send</Button>
            </div>
          </div>
        </div>
      )}

      {confirmModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border z-10">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"><Mail className="h-6 w-6 text-primary" /></div>
              <h2 className="text-lg font-bold">Did you send this email?</h2>
              <p className="text-sm text-muted-foreground">To <span className="font-medium text-foreground">{confirmLeadName}</span></p>
              <p className="text-xs text-muted-foreground">If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days.</p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleConfirmSent(false)}>No</Button>
                <Button className="flex-1 rounded-xl bg-primary text-white gap-2" onClick={() => handleConfirmSent(true)}><Check className="h-4 w-4" /> Yes, I sent it</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
