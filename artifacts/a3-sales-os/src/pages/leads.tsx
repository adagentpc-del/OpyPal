import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useGetLeads, useCreateLead, useUpdateLead, useDeleteLead, useDuplicateLead, useUpdateLeadStatus, useGetSyncStatus, useGetTemplates, useGetAssets, useGetLeadHistory, useCreateLeadHistory, getGetLeadsQueryKey, getGetDashboardQueryKey, getGetLeadHistoryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit2, Building2, Copy, X, Filter, Mail, Check, Clock, Send, FileText, Paperclip, History, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["New Lead", "Contacted", "Replied", "Qualified", "Meeting Booked", "Meeting Completed", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost", "Nurture"];
const PIPELINE_TYPES = ["Event", "Agency"];
const PROJECT_TYPES = ["Event Activation", "Conference", "Hotel Event", "Brand Activation", "Experiential Install", "Fabrication", "Large Format Printing", "Projection Mapping", "Ongoing Partnership"];
const SOURCES = ["ZoomInfo", "LinkedIn", "Referral", "Website", "Cold Call", "Email", "Existing Relationship", "Other"];

const emptyLead = {
  pipelineType: "Event", companyName: "", contactName: "", title: "", email: "", phone: "",
  linkedin: "", location: "", industry: "", venueProperty: "", projectType: "",
  estimatedBudget: undefined as number | undefined, status: "New Lead", lastContactDate: "",
  nextStep: "", nextFollowUpDate: "", notes: "", dealValueEstimate: undefined as number | undefined,
  proposalValue: undefined as number | undefined, closeProbability: undefined as number | undefined, source: "",
};

function addBusinessDays(days: number): string {
  const d = new Date();
  let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().split("T")[0];
}

function replacePlaceholders(text: string, lead: any): string {
  const firstName = (lead.contactName || "").split(" ")[0] || lead.contactName || "";
  return text
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Contact Name\]/gi, lead.contactName || "")
    .replace(/\[Company Name\]/gi, lead.companyName || "")
    .replace(/\[Name\]/gi, lead.contactName || "")
    .replace(/\[venue \/ agency\]/gi, lead.companyName || "")
    .replace(/\[Location\]/gi, lead.location || "")
    .replace(/\[Title\]/gi, lead.title || "");
}

function SyncBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = { connected: "bg-emerald-100 text-emerald-700", syncing: "bg-blue-100 text-blue-700", error: "bg-red-100 text-red-700", disconnected: "bg-gray-100 text-gray-500" };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] || colors.disconnected}`}>{status === "connected" ? "Synced" : status}</span>;
}

export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [drawerLead, setDrawerLead] = useState<any>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState({ ...emptyLead });
  const [showNewModal, setShowNewModal] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: syncStatus } = useGetSyncStatus({ query: { refetchInterval: 10000 } });
  const { data: leads, isLoading } = useGetLeads({
    search: search || undefined, pipelineType: filterType || undefined,
    status: filterStatus || undefined, source: filterSource || undefined,
    overdue: filterOverdue || undefined, followUpDueToday: filterDueToday || undefined,
  });

  const createMutation = useCreateLead();
  const updateMutation = useUpdateLead();
  const deleteMutation = useDeleteLead();
  const duplicateMutation = useDuplicateLead();
  const statusMutation = useUpdateLeadStatus();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const openNew = () => {
    setForm({ ...emptyLead });
    setShowNewModal(true);
  };

  const openDrawer = (lead: any) => {
    setDrawerLead(lead);
    setDrawerMode("view");
    setForm({
      pipelineType: lead.pipelineType, companyName: lead.companyName, contactName: lead.contactName,
      title: lead.title || "", email: lead.email || "", phone: lead.phone || "",
      linkedin: lead.linkedin || "", location: lead.location || "", industry: lead.industry || "",
      venueProperty: lead.venueProperty || "", projectType: lead.projectType || "",
      estimatedBudget: lead.estimatedBudget ? Number(lead.estimatedBudget) : undefined,
      status: lead.status, lastContactDate: lead.lastContactDate || "",
      nextStep: lead.nextStep || "", nextFollowUpDate: lead.nextFollowUpDate || "",
      notes: lead.notes || "", dealValueEstimate: lead.dealValueEstimate ? Number(lead.dealValueEstimate) : undefined,
      proposalValue: lead.proposalValue ? Number(lead.proposalValue) : undefined,
      closeProbability: lead.closeProbability ? Number(lead.closeProbability) : undefined,
      source: lead.source || "",
    });
  };

  const handleSave = () => {
    const payload: any = { ...form };
    if (!payload.companyName || !payload.contactName) {
      toast({ title: "Required fields", description: "Company and Contact name are required.", variant: "destructive" });
      return;
    }
    if (drawerLead && drawerMode === "edit") {
      updateMutation.mutate({ id: drawerLead.id, data: payload }, {
        onSuccess: (updated) => { invalidate(); setDrawerLead(updated); setDrawerMode("view"); toast({ title: "Lead updated" }); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { invalidate(); setShowNewModal(false); toast({ title: "Lead created" }); },
        onError: () => toast({ title: "Failed to create", variant: "destructive" }),
      });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); setDrawerLead(null); toast({ title: "Lead deleted" }); } });
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Lead duplicated" }); } });
  };

  const handleQuickStatus = (id: number, status: string) => {
    statusMutation.mutate({ id, data: { status } }, { onSuccess: invalidate });
  };

  const today = new Date().toISOString().split("T")[0];
  const activeFilters = [filterType, filterStatus, filterSource, filterOverdue, filterDueToday].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-full pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold">Leads & CRM</h1>
              <SyncBadge status={syncStatus?.status} />
            </div>
            <p className="text-muted-foreground text-sm mt-1">Manage your pipeline and client database.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Lead
          </Button>
        </div>

        <Card className="p-3 sm:p-4 bg-card border-border/50 rounded-2xl flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search company, contact, email..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
            </div>
            <Button variant="outline" className={`rounded-xl ${activeFilters > 0 ? "border-primary text-primary" : ""}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 mr-2" /> Filters {activeFilters > 0 && `(${activeFilters})`}
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 mb-3 p-3 bg-muted/50 rounded-xl">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Pipelines</option>
                {PIPELINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-background cursor-pointer">
                <input type="checkbox" checked={filterDueToday} onChange={(e) => setFilterDueToday(e.target.checked)} className="rounded" /> Due Today
              </label>
              <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-background cursor-pointer">
                <input type="checkbox" checked={filterOverdue} onChange={(e) => setFilterOverdue(e.target.checked)} className="rounded" /> Overdue
              </label>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setFilterType(""); setFilterStatus(""); setFilterSource(""); setFilterOverdue(false); setFilterDueToday(false); }}>
                  Clear All
                </Button>
              )}
            </div>
          )}

          <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Contact</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Email</th>
                    <th className="px-4 py-3 font-semibold hidden xl:table-cell">Location</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Pipeline</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Next Step</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Follow-Up</th>
                    <th className="px-4 py-3 font-semibold hidden xl:table-cell">Source</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                  ) : leads?.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-10 w-10 text-border mx-auto mb-2" />
                      <p>No leads found.</p>
                    </td></tr>
                  ) : (
                    leads?.map((lead) => {
                      const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < today && lead.status !== "Closed Won" && lead.status !== "Closed Lost";
                      return (
                        <tr key={lead.id} className={`hover:bg-muted/30 transition-colors cursor-pointer ${isOverdue ? "bg-destructive/5" : ""}`}
                          onClick={() => openDrawer(lead)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lead.pipelineType === "Event" ? "bg-primary" : "bg-accent"}`} />
                              <span className="font-medium text-foreground">{lead.companyName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{lead.contactName}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.phone || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{lead.email || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{lead.location || "-"}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lead.pipelineType === "Event" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                              {lead.pipelineType}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <select value={lead.status} onChange={(e) => handleQuickStatus(lead.id, e.target.value)}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer
                                ${lead.status === "Closed Won" ? "bg-emerald-100 text-emerald-700" :
                                  lead.status === "Closed Lost" ? "bg-red-100 text-red-700" :
                                  lead.status === "Nurture" ? "bg-amber-100 text-amber-700" :
                                  "bg-primary/10 text-primary"}`}>
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-[140px] truncate">{lead.nextStep || "-"}</td>
                          <td className={`px-4 py-3 hidden lg:table-cell ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {lead.nextFollowUpDate ? format(new Date(lead.nextFollowUpDate + "T12:00:00"), "MMM d") : "-"}
                            {isOverdue && " !"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">{lead.source || "-"}</td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {lead.email && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDrawer(lead)} title="Open">
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(lead.id)} title="Duplicate">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(lead.id, lead.companyName)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{leads?.length || 0} lead{(leads?.length || 0) !== 1 ? "s" : ""}</div>
        </Card>
      </div>

      {showNewModal && (
        <NewLeadModal form={form} setForm={setForm} onSave={handleSave} onClose={() => setShowNewModal(false)}
          saving={createMutation.isPending} />
      )}

      {drawerLead && (
        <LeadDrawer
          lead={drawerLead} form={form} setForm={setForm} mode={drawerMode}
          onSetMode={setDrawerMode} onSave={handleSave} saving={updateMutation.isPending}
          onClose={() => setDrawerLead(null)} onDelete={() => handleDelete(drawerLead.id, drawerLead.companyName)}
          invalidate={invalidate} onLeadUpdate={setDrawerLead}
        />
      )}
    </AppLayout>
  );
}

function NewLeadModal({ form, setForm, onSave, onClose, saving }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border z-10">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">New Lead</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name *" value={form.companyName} onChange={(v: string) => setForm({ ...form, companyName: v })} />
            <Field label="Contact Name *" value={form.contactName} onChange={(v: string) => setForm({ ...form, contactName: v })} />
            <Field label="Phone" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} />
            <Field label="Email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} type="email" />
            <div className="sm:col-span-2">
              <Field label="Location" value={form.location} onChange={(v: string) => setForm({ ...form, location: v })} />
            </div>
            <SelectField label="Pipeline" value={form.pipelineType} options={PIPELINE_TYPES} onChange={(v: string) => setForm({ ...form, pipelineType: v })} />
            <SelectField label="Source" value={form.source} options={SOURCES} onChange={(v: string) => setForm({ ...form, source: v })} allowEmpty />
          </div>
        </div>
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={onSave} className="bg-primary text-white rounded-xl" disabled={saving}>Create Lead</Button>
        </div>
      </div>
    </div>
  );
}

function LeadDrawer({ lead, form, setForm, mode, onSetMode, onSave, saving, onClose, onDelete, invalidate, onLeadUpdate }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allTemplates } = useGetTemplates();
  const { data: allAssets } = useGetAssets();
  const { data: history } = useGetLeadHistory(lead.id);
  const createHistoryMutation = useCreateLeadHistory();
  const updateMutation = useUpdateLead();

  const emailTemplates = useMemo(() =>
    (allTemplates || []).filter((t: any) => ["Cold Email", "Follow-Up Email"].includes(t.category)),
    [allTemplates]
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sentSubject, setSentSubject] = useState("");
  const [sentBody, setSentBody] = useState("");
  const [sentTemplateName, setSentTemplateName] = useState("");
  const [sentAssetNames, setSentAssetNames] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    setSelectedTemplateId(null);
    setEmailSubject("");
    setEmailBody("");
    setSelectedAssetIds([]);
    setConfirmOpen(false);
  }, [lead.id]);

  const currentTemplateLinkedIds = useMemo(() => {
    if (!selectedTemplateId) return [] as number[];
    const tpl = (allTemplates || []).find((t: any) => t.id === selectedTemplateId);
    if (!tpl?.linkedAssetIds) return [] as number[];
    return tpl.linkedAssetIds.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
  }, [selectedTemplateId, allTemplates]);

  const resolveAssetPlaceholders = (body: string, assets: any[]) => {
    let result = body;
    assets.forEach((asset: any) => {
      if (result.includes("[A3_CAPABILITIES_DECK_LINK]")) {
        if (asset.url) {
          result = result.replace("[A3_CAPABILITIES_DECK_LINK]", `View our capabilities deck: ${asset.url}`);
        } else {
          result = result.replace("[A3_CAPABILITIES_DECK_LINK]", "I'd be happy to send over our A3 capabilities deck.");
        }
      }
    });
    return result.replace(/\[A3_CAPABILITIES_DECK_LINK\]/g, "I'd be happy to send over our A3 capabilities deck.");
  };

  const handleTemplateSelect = (id: number) => {
    setSelectedTemplateId(id);
    const tpl = (allTemplates || []).find((t: any) => t.id === id);
    if (tpl) {
      setEmailSubject(replacePlaceholders(tpl.subject || "", lead));
      let body = replacePlaceholders(tpl.body || "", lead);

      const linkedIds = (tpl.linkedAssetIds || "").split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
      if (linkedIds.length > 0) {
        setSelectedAssetIds(linkedIds);
        const linkedAssets = (allAssets || []).filter((a: any) => linkedIds.includes(a.id));
        body = resolveAssetPlaceholders(body, linkedAssets);
      } else {
        setSelectedAssetIds([]);
        body = resolveAssetPlaceholders(body, []);
      }

      setEmailBody(body);
    }
  };

  const handleCopyEmail = () => {
    const text = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(text).then(() => toast({ title: "Email copied to clipboard" }));
  };

  const handleSendOutlook = () => {
    if (!lead.email) {
      toast({ title: "This lead has no email address", variant: "destructive" });
      return;
    }
    let bodyWithAssets = emailBody;
    const selectedAssets = (allAssets || []).filter((a: any) => selectedAssetIds.includes(a.id));
    const assetsWithUrls = selectedAssets.filter((a: any) => a.url);
    if (assetsWithUrls.length > 0) {
      bodyWithAssets += "\n\n---\nAttached Materials:\n" + assetsWithUrls.map((a: any) => `- ${a.title}: ${a.url}`).join("\n");
    }

    const subject = encodeURIComponent(emailSubject);
    const bodyEncoded = encodeURIComponent(bodyWithAssets.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    const mailto = `mailto:${encodeURIComponent(lead.email)}?subject=${subject}&body=${bodyEncoded}`;
    window.open(mailto, "_blank");

    setSentSubject(emailSubject);
    setSentBody(bodyWithAssets);
    const tpl = (allTemplates || []).find((t: any) => t.id === selectedTemplateId);
    setSentTemplateName(tpl?.name || "Custom");
    setSentAssetNames(selectedAssets.map((a: any) => a.title).join(", ") || "");
    setTimeout(() => setConfirmOpen(true), 800);
  };

  const handleMarkContacted = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const followUpDate = addBusinessDays(2);
    const payload = buildLeadUpdate(lead, { status: "Contacted", lastContactDate: todayStr, nextStep: "Awaiting reply", nextFollowUpDate: followUpDate });
    updateMutation.mutate({ id: lead.id, data: payload }, {
      onSuccess: (updated) => { invalidate(); queryClient.invalidateQueries({ queryKey: getGetLeadHistoryQueryKey(lead.id) }); toast({ title: `${lead.companyName} marked as Contacted` }); },
      onError: () => toast({ title: "Failed to update", variant: "destructive" }),
    });
  };

  const handleConfirmSent = (didSend: boolean) => {
    if (didSend) {
      const todayStr = new Date().toISOString().split("T")[0];
      const followUpDate = addBusinessDays(2);
      const payload = buildLeadUpdate(lead, { status: "Contacted", lastContactDate: todayStr, nextStep: "Awaiting reply", nextFollowUpDate: followUpDate });
      updateMutation.mutate({ id: lead.id, data: payload }, {
        onSuccess: (updated) => { invalidate(); if (onLeadUpdate) onLeadUpdate(updated); toast({ title: "Lead updated to Contacted", description: `Follow-up set for ${followUpDate}` }); },
        onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
      });

      createHistoryMutation.mutate({
        id: lead.id,
        data: {
          actionType: "Email Sent",
          templateName: sentTemplateName,
          subject: sentSubject,
          body: sentBody,
          assets: sentAssetNames || undefined,
          sender: "Alyssa",
        },
      }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetLeadHistoryQueryKey(lead.id) }); },
      });
    }
    setConfirmOpen(false);
  };

  const forecast = ((form.proposalValue || form.dealValueEstimate || 0) * (form.closeProbability || 0)) / 100;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-card w-full max-w-2xl h-full overflow-y-auto border-l border-border z-10 shadow-2xl">
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-bold">{lead.companyName}</h2>
              <p className="text-sm text-muted-foreground">{lead.contactName}{lead.title ? ` — ${lead.title}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {mode === "view" ? (
                <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => onSetMode("edit")}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
              ) : (
                <Button size="sm" className="rounded-xl bg-primary text-white" onClick={onSave} disabled={saving}>Save</Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {mode === "view" ? (
              <>
                <DrawerSection title="Contact Info" icon={<Building2 className="h-4 w-4" />}>
                  <InfoGrid items={[
                    { label: "Company", value: lead.companyName },
                    { label: "Contact", value: lead.contactName },
                    { label: "Phone", value: lead.phone, type: "tel" },
                    { label: "Email", value: lead.email, type: "email" },
                    { label: "Location", value: lead.location },
                  ]} />
                </DrawerSection>

                <DrawerSection title="CRM Status" icon={<Clock className="h-4 w-4" />}>
                  <InfoGrid items={[
                    { label: "Pipeline", value: lead.pipelineType, badge: true, badgeColor: lead.pipelineType === "Event" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700" },
                    { label: "Status", value: lead.status, badge: true, badgeColor: lead.status === "Closed Won" ? "bg-emerald-100 text-emerald-700" : lead.status === "Closed Lost" ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary" },
                    { label: "Last Contact", value: lead.lastContactDate ? format(new Date(lead.lastContactDate + "T12:00:00"), "MMM d, yyyy") : "-" },
                    { label: "Next Step", value: lead.nextStep || "-" },
                    { label: "Follow-Up", value: lead.nextFollowUpDate ? format(new Date(lead.nextFollowUpDate + "T12:00:00"), "MMM d, yyyy") : "-" },
                    { label: "Source", value: lead.source || "-" },
                  ]} />
                </DrawerSection>

                <DrawerSection title="Outreach" icon={<Send className="h-4 w-4" />}>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Select Template</label>
                      {emailTemplates.length > 0 ? (
                        <select value={selectedTemplateId !== null ? String(selectedTemplateId) : ""} onChange={(e) => { const v = e.target.value; if (v) handleTemplateSelect(Number(v)); else { setSelectedTemplateId(null); } }}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                          <option value="">Choose a template...</option>
                          {emailTemplates.map((t: any) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                        </select>
                      ) : (
                        <p className="text-xs text-muted-foreground">No email templates available. You can still write a custom email below.</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
                      <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Enter subject or select a template above..."
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Email Body</label>
                      <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Write your email or select a template above to auto-fill..."
                        className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[140px] resize-y whitespace-pre-wrap" />
                    </div>

                    {allAssets && allAssets.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          <Paperclip className="h-3 w-3 inline mr-1" /> Attach Assets
                        </label>
                        <div className="space-y-1 max-h-[120px] overflow-y-auto border border-border rounded-xl p-2">
                          {allAssets.map((a: any) => (
                            <label key={a.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-lg px-2 py-1 ${currentTemplateLinkedIds.includes(a.id) ? "bg-primary/5" : ""}`}>
                              <input type="checkbox" checked={selectedAssetIds.includes(a.id)}
                                onChange={(e) => setSelectedAssetIds(e.target.checked ? [...selectedAssetIds, a.id] : selectedAssetIds.filter((id: number) => id !== a.id))}
                                className="rounded" />
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate">{a.title}</span>
                              {currentTemplateLinkedIds.includes(a.id) && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-auto shrink-0">Linked</span>}
                              {a.category === "Capabilities Deck" && !currentTemplateLinkedIds.includes(a.id) && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full ml-auto shrink-0">Deck</span>}
                              {a.url ? <span className="text-xs text-green-600 shrink-0" title="Has URL">🔗</span> : <span className="text-xs text-muted-foreground shrink-0" title="No URL">📎</span>}
                            </label>
                          ))}
                        </div>
                        {selectedAssetIds.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {(allAssets || []).filter((a: any) => selectedAssetIds.includes(a.id)).map((a: any) => (
                              <div key={a.id} className="flex items-center gap-2 text-xs">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">{a.title}</span>
                                {a.url ? (
                                  <span className="text-green-600">URL included in email</span>
                                ) : (
                                  <span className="text-amber-600">Logged only (no URL)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleCopyEmail} disabled={!emailSubject && !emailBody}>
                        <Copy className="h-3.5 w-3.5" /> Copy Email
                      </Button>
                      <Button size="sm" className="rounded-xl bg-primary text-white gap-1.5" onClick={handleSendOutlook} disabled={!emailSubject || !emailBody}>
                        <Mail className="h-3.5 w-3.5" /> Send via Outlook
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleMarkContacted}>
                        <Check className="h-3.5 w-3.5" /> Mark as Contacted
                      </Button>
                    </div>
                  </div>
                </DrawerSection>

                <DrawerSection title="Outreach History" icon={<History className="h-4 w-4" />}
                  collapsible expanded={showHistory} onToggle={() => setShowHistory(!showHistory)}>
                  {!history || history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No outreach history yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((h: any) => (
                        <div key={h.id} className="border border-border/50 rounded-xl p-3 bg-muted/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-primary">{h.actionType}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(h.sentAt), "MMM d, yyyy h:mm a")}</span>
                          </div>
                          {h.templateName && <p className="text-xs text-muted-foreground">Template: {h.templateName}</p>}
                          {h.subject && <p className="text-sm font-medium mt-1">{h.subject}</p>}
                          {h.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">{h.body}</p>}
                          {h.assets && <p className="text-xs mt-1"><Paperclip className="h-3 w-3 inline mr-1" />{h.assets}</p>}
                          {h.sender && <p className="text-xs text-muted-foreground mt-1">Sent by: {h.sender}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </DrawerSection>

                <DrawerSection title="Additional Details" icon={<ChevronDown className="h-4 w-4" />}
                  collapsible expanded={showAdditional} onToggle={() => setShowAdditional(!showAdditional)}>
                  <InfoGrid items={[
                    { label: "Title / Role", value: lead.title || "-" },
                    { label: "Industry", value: lead.industry || "-" },
                    { label: "Venue / Property", value: lead.venueProperty || "-" },
                    { label: "Project Type", value: lead.projectType || "-" },
                    { label: "Estimated Budget", value: lead.estimatedBudget ? `$${Number(lead.estimatedBudget).toLocaleString()}` : "-" },
                    { label: "LinkedIn", value: lead.linkedin || "-", type: "url" },
                    { label: "Deal Value", value: lead.dealValueEstimate ? `$${Number(lead.dealValueEstimate).toLocaleString()}` : "-" },
                    { label: "Proposal Value", value: lead.proposalValue ? `$${Number(lead.proposalValue).toLocaleString()}` : "-" },
                    { label: "Close Probability", value: lead.closeProbability ? `${Number(lead.closeProbability)}%` : "-" },
                    { label: "Forecast", value: lead.forecastValue ? `$${Number(lead.forecastValue).toLocaleString()}` : "-" },
                  ]} />
                  {lead.notes && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-muted-foreground">Notes</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{lead.notes}</p>
                    </div>
                  )}
                </DrawerSection>

                <div className="pt-2">
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={onDelete}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Lead
                  </Button>
                </div>
              </>
            ) : (
              <>
                <DrawerSection title="Contact Info" icon={<Building2 className="h-4 w-4" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Company Name *" value={form.companyName} onChange={(v: string) => setForm({ ...form, companyName: v })} />
                    <Field label="Contact Name *" value={form.contactName} onChange={(v: string) => setForm({ ...form, contactName: v })} />
                    <Field label="Phone" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} />
                    <Field label="Email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} type="email" />
                    <div className="sm:col-span-2">
                      <Field label="Location" value={form.location} onChange={(v: string) => setForm({ ...form, location: v })} />
                    </div>
                  </div>
                </DrawerSection>

                <DrawerSection title="CRM Status" icon={<Clock className="h-4 w-4" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SelectField label="Pipeline" value={form.pipelineType} options={PIPELINE_TYPES} onChange={(v: string) => setForm({ ...form, pipelineType: v })} />
                    <SelectField label="Status" value={form.status} options={STATUSES} onChange={(v: string) => setForm({ ...form, status: v })} />
                    <Field label="Last Contact Date" value={form.lastContactDate} onChange={(v: string) => setForm({ ...form, lastContactDate: v })} type="date" />
                    <Field label="Next Follow-Up" value={form.nextFollowUpDate} onChange={(v: string) => setForm({ ...form, nextFollowUpDate: v })} type="date" />
                    <div className="sm:col-span-2">
                      <Field label="Next Step" value={form.nextStep} onChange={(v: string) => setForm({ ...form, nextStep: v })} />
                    </div>
                    <SelectField label="Source" value={form.source} options={SOURCES} onChange={(v: string) => setForm({ ...form, source: v })} allowEmpty />
                  </div>
                </DrawerSection>

                <DrawerSection title="Additional Details" icon={<ChevronDown className="h-4 w-4" />}
                  collapsible expanded={showAdditional} onToggle={() => setShowAdditional(!showAdditional)}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Title / Role" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} />
                    <Field label="Industry" value={form.industry} onChange={(v: string) => setForm({ ...form, industry: v })} />
                    <Field label="Venue / Property" value={form.venueProperty} onChange={(v: string) => setForm({ ...form, venueProperty: v })} />
                    <SelectField label="Project Type" value={form.projectType} options={PROJECT_TYPES} onChange={(v: string) => setForm({ ...form, projectType: v })} allowEmpty />
                    <Field label="LinkedIn" value={form.linkedin} onChange={(v: string) => setForm({ ...form, linkedin: v })} />
                    <Field label="Estimated Budget" value={form.estimatedBudget?.toString() || ""} onChange={(v: string) => setForm({ ...form, estimatedBudget: v ? Number(v) : undefined })} type="number" />
                    <Field label="Deal Value Estimate" value={form.dealValueEstimate?.toString() || ""} onChange={(v: string) => setForm({ ...form, dealValueEstimate: v ? Number(v) : undefined })} type="number" />
                    <Field label="Proposal Value" value={form.proposalValue?.toString() || ""} onChange={(v: string) => setForm({ ...form, proposalValue: v ? Number(v) : undefined })} type="number" />
                    <Field label="Close Probability (%)" value={form.closeProbability?.toString() || ""} onChange={(v: string) => setForm({ ...form, closeProbability: v ? Number(v) : undefined })} type="number" />
                    {forecast > 0 && <p className="text-sm text-primary font-semibold sm:col-span-2">Forecast: ${forecast.toLocaleString()}</p>}
                  </div>
                  <div className="mt-3">
                    <label className="text-sm font-medium text-foreground block mb-1.5">Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-y" />
                  </div>
                </DrawerSection>

                <div className="flex gap-3 justify-end pt-2">
                  <Button variant="outline" onClick={() => onSetMode("view")} className="rounded-xl">Cancel</Button>
                  <Button onClick={onSave} className="bg-primary text-white rounded-xl" disabled={saving}>Save Changes</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border z-10">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Did you send this email?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  To <span className="font-medium text-foreground">{lead.companyName}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days. The email will be logged in outreach history.
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleConfirmSent(false)}>No</Button>
                <Button className="flex-1 rounded-xl bg-primary text-white gap-2" onClick={() => handleConfirmSent(true)}>
                  <Check className="h-4 w-4" /> Yes, I sent it
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DrawerSection({ title, icon, children, collapsible, expanded, onToggle }: any) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <div className={`px-4 py-3 bg-muted/30 flex items-center justify-between ${collapsible ? "cursor-pointer" : ""}`}
        onClick={collapsible ? onToggle : undefined}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon} {title}
        </div>
        {collapsible && (expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
      </div>
      {(!collapsible || expanded) && <div className="p-4">{children}</div>}
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value: string; badge?: boolean; badgeColor?: string; type?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
      {items.map((item, i) => (
        <div key={i}>
          <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
          {item.badge ? (
            <p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.value || "-"}</span></p>
          ) : item.type === "email" && item.value && item.value !== "-" ? (
            <p className="text-sm"><a href={`mailto:${item.value}`} className="text-primary hover:underline">{item.value}</a></p>
          ) : item.type === "tel" && item.value && item.value !== "-" ? (
            <p className="text-sm"><a href={`tel:${item.value}`} className="text-primary hover:underline">{item.value}</a></p>
          ) : item.type === "url" && item.value && item.value !== "-" ? (
            <p className="text-sm">{/^https?:\/\//i.test(item.value) ? <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{item.value}</a> : <a href={`https://${item.value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{item.value}</a>}</p>
          ) : (
            <p className="text-sm">{item.value || "-"}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function buildLeadUpdate(lead: any, changes: Record<string, any>) {
  return {
    pipelineType: lead.pipelineType || "Event",
    companyName: lead.companyName,
    contactName: lead.contactName,
    status: lead.status,
    title: lead.title || undefined,
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    linkedin: lead.linkedin || undefined,
    location: lead.location || undefined,
    industry: lead.industry || undefined,
    venueProperty: lead.venueProperty || undefined,
    projectType: lead.projectType || undefined,
    estimatedBudget: lead.estimatedBudget ? Number(lead.estimatedBudget) : undefined,
    lastContactDate: lead.lastContactDate || undefined,
    nextStep: lead.nextStep || undefined,
    nextFollowUpDate: lead.nextFollowUpDate || undefined,
    notes: lead.notes || undefined,
    dealValueEstimate: lead.dealValueEstimate ? Number(lead.dealValueEstimate) : undefined,
    proposalValue: lead.proposalValue ? Number(lead.proposalValue) : undefined,
    closeProbability: lead.closeProbability ? Number(lead.closeProbability) : undefined,
    source: lead.source || undefined,
    ...changes,
  };
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
    </div>
  );
}

function SelectField({ label, value, options, onChange, allowEmpty }: { label: string; value: string; options: string[]; onChange: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none">
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
