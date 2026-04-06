import { useState, useMemo, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { useGetLeads, useCreateLead, useUpdateLead, useDeleteLead, useDuplicateLead, useUpdateLeadStatus, useGetSyncStatus, useGetTemplates, useGetAssets, useGetLeadHistory, useCreateLeadHistory, useGetScheduledEmails, useCreateScheduledEmail, useUpdateScheduledEmail, useGetLeadActivities, useGetTemplateSets, getGetLeadsQueryKey, getGetDashboardQueryKey, getGetLeadHistoryQueryKey, getGetScheduledEmailsQueryKey, getGetLeadActivitiesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit2, Building2, Copy, X, Filter, Mail, Check, Clock, Send, FileText, Paperclip, History, ChevronDown, ChevronUp, Calendar, Save, ExternalLink, Loader2, AlertCircle, Link2, Play, Eye, XCircle, RefreshCw, Zap, TrendingUp, MousePointerClick, MessageSquare, PauseCircle, SkipForward, RotateCcw, Sparkles, StickyNote, CheckSquare, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BulkOutreachModal } from "@/components/bulk-outreach-modal";

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

function addBusinessDaysToDate(startDate: Date, days: number): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d;
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
    .replace(/\[Title\]/gi, lead.title || "")
    .replace(/\{\{greeting\}\}/gi, `Hi ${firstName},`)
    .replace(/\{\{company\}\}/gi, lead.companyName || "")
    .replace(/\{\{intent_line\}\}/gi, "")
    .replace(/\{\{company_line\}\}/gi, "");
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkOutreach, setShowBulkOutreach] = useState(false);

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

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!leads) return;
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l: any) => l.id)));
    }
  }, [leads, selectedIds.size]);

  const selectedLeads = useMemo(() =>
    (leads || []).filter((l: any) => selectedIds.has(l.id)),
    [leads, selectedIds]
  );

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

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" className="rounded-lg bg-primary text-white h-8 text-xs" onClick={() => setShowBulkOutreach(true)}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" /> Bulk Outreach
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1.5" /> Clear
                </Button>
              </div>
            </div>
          )}

          <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50">
                  <tr>
                    <th className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={!!leads?.length && selectedIds.size === leads.length} onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border text-primary cursor-pointer" />
                    </th>
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
                    <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                  ) : leads?.length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-10 w-10 text-border mx-auto mb-2" />
                      <p>No leads found.</p>
                    </td></tr>
                  ) : (
                    leads?.map((lead) => {
                      const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < today && lead.status !== "Closed Won" && lead.status !== "Closed Lost";
                      return (
                        <tr key={lead.id} className={`hover:bg-muted/30 transition-colors cursor-pointer ${isOverdue ? "bg-destructive/5" : ""} ${selectedIds.has(lead.id) ? "bg-primary/5" : ""}`}
                          onClick={() => openDrawer(lead)}>
                          <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                              className="h-4 w-4 rounded border-border text-primary cursor-pointer" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lead.pipelineType === "Event" ? "bg-primary" : "bg-accent"}`} />
                              <span className="font-medium text-foreground">{lead.companyName}</span>
                              {lead.lastRepliedAt && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0 flex items-center gap-0.5">
                                  <MessageSquare className="h-2.5 w-2.5" /> Replied
                                </span>
                              )}
                              {lead.engagementScore > 0 && !lead.lastRepliedAt && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  lead.engagementScore >= 20 ? "bg-emerald-100 text-emerald-700" :
                                  lead.engagementScore >= 10 ? "bg-blue-100 text-blue-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>{lead.engagementScore}</span>
                              )}
                              {lead.smartNextAction && <Sparkles className="h-3 w-3 text-primary shrink-0" />}
                              {lead.priorityFlag && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  lead.priorityFlag === "urgent" ? "bg-red-100 text-red-700" :
                                  lead.priorityFlag === "high" ? "bg-orange-100 text-orange-700" :
                                  lead.priorityFlag === "review" ? "bg-amber-100 text-amber-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>
                                  {lead.priorityFlag === "urgent" ? "⚡ Urgent" : lead.priorityFlag === "high" ? "🔥 High" : lead.priorityFlag === "review" ? "👀 Review" : lead.priorityFlag}
                                </span>
                              )}
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

      {showBulkOutreach && selectedLeads.length > 0 && (
        <BulkOutreachModal
          selectedLeads={selectedLeads}
          onClose={() => setShowBulkOutreach(false)}
          onComplete={() => { setSelectedIds(new Set()); invalidate(); toast({ title: "Bulk outreach complete" }); }}
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
  const { data: allTemplates, isLoading: templatesLoading, isError: templatesError, refetch: refetchTemplates } = useGetTemplates();
  const { data: allAssets } = useGetAssets();
  const { data: history } = useGetLeadHistory(lead.id);
  const { data: scheduledEmails } = useGetScheduledEmails({ leadId: lead.id });
  const { data: activities } = useGetLeadActivities(lead.id);
  const { data: templateSets } = useGetTemplateSets();
  const createHistoryMutation = useCreateLeadHistory();
  const createScheduledEmailMutation = useCreateScheduledEmail();
  const updateScheduledEmailMutation = useUpdateScheduledEmail();
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
  const [showActivities, setShowActivities] = useState(true);
  const [showScheduled, setShowScheduled] = useState(true);
  const [activityFilter, setActivityFilter] = useState("all");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<"note" | "reply" | "call">("note");
  const [showEngagement, setShowEngagement] = useState(true);
  const [showConversation, setShowConversation] = useState(true);
  const [conversationThread, setConversationThread] = useState<any[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [showTasks, setShowTasks] = useState(true);
  const [newTaskType, setNewTaskType] = useState("");

  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [activateSequence, setActivateSequence] = useState(true);
  const [showSequencePreview, setShowSequencePreview] = useState(false);

  const selectedTemplate = useMemo(() =>
    selectedTemplateId ? (allTemplates || []).find((t: any) => t.id === selectedTemplateId) : null,
    [selectedTemplateId, allTemplates]
  );

  const linkedSequence = useMemo(() => {
    if (!selectedTemplate?.linkedTemplateSetId || !templateSets) return null;
    return templateSets.find((s: any) => s.id === selectedTemplate.linkedTemplateSetId) || null;
  }, [selectedTemplate, templateSets]);

  const [sequenceSteps, setSequenceSteps] = useState<any[]>([]);

  useEffect(() => {
    if (linkedSequence) {
      fetch(`/api/template-sets/${linkedSequence.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.templates) {
            setSequenceSteps(data.templates.sort((a: any, b: any) => a.stepNumber - b.stepNumber));
          }
        })
        .catch(() => setSequenceSteps([]));
      setActivateSequence(true);
      setShowSequencePreview(true);
    } else {
      setSequenceSteps([]);
      setShowSequencePreview(false);
    }
  }, [linkedSequence]);

  useEffect(() => {
    setSelectedTemplateId(null);
    setEmailSubject("");
    setEmailBody("");
    setSelectedAssetIds([]);
    setConfirmOpen(false);
    setScheduleMode(false);
    setShowSequencePreview(false);
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

  const handleScheduleEmail = () => {
    if (!emailSubject || !emailBody) {
      toast({ title: "Subject and body are required", variant: "destructive" });
      return;
    }
    if (!scheduleDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }

    const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    createScheduledEmailMutation.mutate({
      data: {
        leadId: lead.id,
        templateId: selectedTemplateId || undefined,
        subject: emailSubject,
        body: emailBody,
        scheduledFor,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadActivitiesQueryKey(lead.id) });

        createHistoryMutation.mutate({
          id: lead.id,
          data: {
            actionType: "Email Scheduled",
            templateName: selectedTemplate?.name || "Custom",
            subject: emailSubject,
            body: emailBody,
            sender: "Alyssa",
          },
        }, {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLeadHistoryQueryKey(lead.id) }),
        });

        if (activateSequence && linkedSequence && sequenceSteps.length > 1) {
          const startDate = new Date(`${scheduleDate}T${scheduleTime}:00`);
          sequenceSteps.slice(1).forEach((step: any) => {
            const stepDate = addBusinessDaysToDate(startDate, step.delayDays);
            createScheduledEmailMutation.mutate({
              data: {
                leadId: lead.id,
                templateId: undefined,
                subject: replacePlaceholders(step.subject || `Follow-up Step ${step.stepNumber}`, lead),
                body: replacePlaceholders(step.body || "", lead),
                scheduledFor: stepDate.toISOString(),
                sequenceId: linkedSequence.id,
                sequenceStepNumber: step.stepNumber,
              },
            });
          });

          createHistoryMutation.mutate({
            id: lead.id,
            data: {
              actionType: "Sequence Activated",
              templateName: linkedSequence.name,
              subject: `${sequenceSteps.length} steps scheduled`,
              sender: "Alyssa",
            },
          });
        }

        toast({ title: "Email scheduled", description: `Scheduled for ${format(new Date(scheduledFor), "MMM d, yyyy h:mm a")}` });
        setScheduleMode(false);
        setScheduleDate("");
      },
      onError: () => toast({ title: "Failed to schedule email", variant: "destructive" }),
    });
  };

  const handleSaveDraft = () => {
    createHistoryMutation.mutate({
      id: lead.id,
      data: {
        actionType: "Draft Saved",
        templateName: selectedTemplate?.name || "Custom",
        subject: emailSubject,
        body: emailBody,
        sender: "Alyssa",
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLeadHistoryQueryKey(lead.id) });
        queryClient.invalidateQueries({ queryKey: getGetLeadActivitiesQueryKey(lead.id) });
        toast({ title: "Draft saved to outreach history" });
      },
    });
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

      if (activateSequence && linkedSequence && sequenceSteps.length > 1) {
        const startDate = new Date();
        sequenceSteps.slice(1).forEach((step: any) => {
          const stepDate = addBusinessDaysToDate(startDate, step.delayDays);
          createScheduledEmailMutation.mutate({
            data: {
              leadId: lead.id,
              subject: replacePlaceholders(step.subject || `Follow-up Step ${step.stepNumber}`, lead),
              body: replacePlaceholders(step.body || "", lead),
              scheduledFor: stepDate.toISOString(),
              sequenceId: linkedSequence.id,
              sequenceStepNumber: step.stepNumber,
            },
          });
        });

        createHistoryMutation.mutate({
          id: lead.id,
          data: {
            actionType: "Sequence Activated",
            templateName: linkedSequence.name,
            subject: `${sequenceSteps.length - 1} follow-up steps scheduled`,
            sender: "Alyssa",
          },
        });

        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        toast({ title: "Sequence activated", description: `${sequenceSteps.length - 1} follow-up emails scheduled` });
      }
    }
    setConfirmOpen(false);
  };

  const handleCancelScheduled = (emailId: number) => {
    updateScheduledEmailMutation.mutate({ id: emailId, data: { status: "canceled" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadActivitiesQueryKey(lead.id) });
        toast({ title: "Scheduled email canceled" });
      },
    });
  };

  const API_BASE = import.meta.env.BASE_URL + "api";

  const fetchConversation = useCallback(async () => {
    setConversationLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/conversation`);
      if (res.ok) setConversationThread(await res.json());
    } catch { /* ignore */ }
    setConversationLoading(false);
  }, [lead.id]);

  useEffect(() => { fetchConversation(); }, [fetchConversation]);

  const fetchLeadTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks?leadId=${lead.id}&limit=50`);
      if (res.ok) setLeadTasks(await res.json());
    } catch {}
  }, [lead.id]);
  useEffect(() => { fetchLeadTasks(); }, [fetchLeadTasks]);

  const handleQuickCompleteTask = async (taskId: number) => {
    await fetch(`${API_BASE}/tasks/${taskId}/complete`, { method: "PATCH" });
    fetchLeadTasks();
  };
  const handleQuickDismissTask = async (taskId: number) => {
    await fetch(`${API_BASE}/tasks/${taskId}/dismiss`, { method: "PATCH" });
    fetchLeadTasks();
  };
  const handleCreateQuickTask = async () => {
    if (!newTaskType) return;
    await fetch(`${API_BASE}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, taskType: newTaskType, title: newTaskType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()), priority: "medium", source: "user" }),
    });
    setNewTaskType("");
    fetchLeadTasks();
  };

  const handleLogNote = async () => {
    if (!noteText.trim()) return;
    const typeMap: Record<string, string> = { note: "note_added", reply: "reply_logged", call: "call_logged" };
    const descMap: Record<string, string> = { note: "Note", reply: "Reply received", call: "Call logged" };
    try {
      const res = await fetch(`${API_BASE}/leads/${lead.id}/activities`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeMap[noteType], description: `${descMap[noteType]}: ${noteText}`, createdBy: "user" }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetLeadActivitiesQueryKey(lead.id) });
      if (noteType === "reply") {
        const engRes = await fetch(`${API_BASE}/engagement-events`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, eventType: "replied" }),
        });
        if (engRes.ok) queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
      }
      setNoteText("");
      setShowNoteInput(false);
      toast({ title: `${descMap[noteType]} saved` });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const handleBulkSequenceAction = async (action: string, reason?: string) => {
    try {
      const res = await fetch(`${API_BASE}/scheduled-emails/bulk-action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, action, reason }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetLeadActivitiesQueryKey(lead.id) });
      toast({ title: `Sequence ${action}d` });
    } catch {
      toast({ title: `Failed to ${action}`, variant: "destructive" });
    }
  };

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (activityFilter === "all") return activities;
    const catMap: Record<string, string[]> = {
      outreach: ["email_sent", "email_delivered", "email_opened", "email_clicked", "email_bounced", "email_failed", "outreach_logged"],
      scheduling: ["email_scheduled", "email_rescheduled", "email_paused", "email_resumed", "email_canceled", "email_skipped", "sequence_activated", "sequence_paused", "sequence_resumed", "sequence_canceled"],
      engagement: ["reply_logged", "reply_received", "auto_reply_received", "email_opened", "email_clicked", "lead_unsubscribed"],
      notes: ["note_added", "call_logged", "reply_logged"],
      status: ["status_changed", "lead_updated"],
    };
    const types = catMap[activityFilter] || [];
    return activities.filter((a: any) => types.includes(a.type));
  }, [activities, activityFilter]);

  const forecast = ((form.proposalValue || form.dealValueEstimate || 0) * (form.closeProbability || 0)) / 100;

  const pendingScheduledEmails = useMemo(() =>
    (scheduledEmails || []).filter((e: any) => ["scheduled", "paused", "queued"].includes(e.status)),
    [scheduledEmails]
  );

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

                <DrawerSection title="Engagement Intelligence" icon={<Zap className="h-4 w-4" />}
                  collapsible expanded={showEngagement} onToggle={() => setShowEngagement(!showEngagement)}>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-primary">{lead.engagementScore || 0}</div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Score</div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full inline-block ${
                          lead.engagementStatus === "engaged" ? "bg-emerald-100 text-emerald-700" :
                          lead.engagementStatus === "interested" ? "bg-blue-100 text-blue-700" :
                          lead.engagementStatus === "aware" ? "bg-amber-100 text-amber-700" :
                          lead.engagementStatus === "suppressed" ? "bg-red-100 text-red-700" :
                          lead.engagementStatus === "bounced" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{lead.engagementStatus || "none"}</span>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-1">Status</div>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3 text-center">
                        <div className="text-xs font-medium text-foreground">{lead.lastEngagementType || "—"}</div>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Last Signal</div>
                      </div>
                    </div>

                    {lead.smartNextAction && (
                      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-primary">Smart Next Action</p>
                          <p className="text-sm mt-0.5">{lead.smartNextAction}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      {lead.lastOpenedAt && <div><span className="text-muted-foreground">Last opened:</span> <span className="font-medium">{format(new Date(lead.lastOpenedAt), "MMM d, h:mm a")}</span></div>}
                      {lead.lastClickedAt && <div><span className="text-muted-foreground">Last clicked:</span> <span className="font-medium">{format(new Date(lead.lastClickedAt), "MMM d, h:mm a")}</span></div>}
                      {lead.lastRepliedAt && <div><span className="text-muted-foreground">Last replied:</span> <span className="font-medium">{format(new Date(lead.lastRepliedAt), "MMM d, h:mm a")}</span></div>}
                      {lead.lastEngagementAt && <div><span className="text-muted-foreground">Last activity:</span> <span className="font-medium">{format(new Date(lead.lastEngagementAt), "MMM d, h:mm a")}</span></div>}
                    </div>

                    {(lead.isUnsubscribed || lead.isBounced) && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-2 flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        {lead.isUnsubscribed && <span>Unsubscribed</span>}
                        {lead.isBounced && <span>Email bounced</span>}
                        {lead.suppressionReason && <span className="text-red-500 ml-1">({lead.suppressionReason})</span>}
                      </div>
                    )}
                  </div>
                </DrawerSection>

                <DrawerSection title="Outreach" icon={<Send className="h-4 w-4" />}>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">Select Template</label>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => window.open("/templates", "_blank")}>
                            <ExternalLink className="h-3 w-3" /> View Templates
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => refetchTemplates()}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {templatesLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
                        </div>
                      ) : templatesError ? (
                        <div className="flex items-center gap-2 text-sm text-destructive py-2">
                          <AlertCircle className="h-4 w-4" /> Error loading templates
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => refetchTemplates()}>Retry</Button>
                        </div>
                      ) : emailTemplates.length > 0 ? (
                        <select value={selectedTemplateId !== null ? String(selectedTemplateId) : ""} onChange={(e) => { const v = e.target.value; if (v) handleTemplateSelect(Number(v)); else { setSelectedTemplateId(null); setEmailSubject(""); setEmailBody(""); setSelectedAssetIds([]); } }}
                          className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                          <option value="">Choose a template...</option>
                          {emailTemplates.map((t: any) => (
                            <option key={t.id} value={String(t.id)}>
                              {t.name} {t.linkedTemplateSetId ? "⚡" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="bg-muted/30 rounded-xl p-3 text-center space-y-2">
                          <p className="text-xs text-muted-foreground">No email templates available.</p>
                          <div className="flex gap-2 justify-center">
                            <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => window.open("/templates", "_blank")}>
                              <Plus className="h-3 w-3 mr-1" /> Create Template
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => refetchTemplates()}>
                              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {linkedSequence && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Linked Sequence: {linkedSequence.name}</span>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-blue-700" onClick={() => setShowSequencePreview(!showSequencePreview)}>
                            <Eye className="h-3 w-3 mr-1" /> {showSequencePreview ? "Hide" : "Preview"}
                          </Button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={activateSequence} onChange={(e) => setActivateSequence(e.target.checked)} className="rounded" />
                          <span className="text-xs text-blue-700">Activate linked follow-up sequence</span>
                        </label>

                        {showSequencePreview && sequenceSteps.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            <p className="text-xs font-medium text-blue-800 mb-1">Sequence Preview:</p>
                            {sequenceSteps.map((step: any, i: number) => (
                              <div key={step.id} className={`flex items-center gap-2 text-xs ${i === 0 ? "text-blue-800 font-medium" : "text-blue-600"}`}>
                                <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold shrink-0">{step.stepNumber}</span>
                                <span className="truncate">{step.name || `Step ${step.stepNumber}`}</span>
                                <span className="text-blue-400 ml-auto shrink-0">
                                  {step.delayDays === 0 ? "Today" : `+${step.delayDays}d`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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

                    {scheduleMode && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" /> Schedule Email
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-amber-600" onClick={() => setScheduleMode(false)}>
                            Cancel
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          <span className="text-xs text-amber-700 self-center mr-0.5">Quick:</span>
                          {[
                            { label: "Tomorrow", days: 1 },
                            { label: "+3 days", days: 3 },
                            { label: "+1 week", days: 7 },
                            { label: "+2 weeks", days: 14 },
                            { label: "+1 month", days: 30 },
                            { label: "+3 months", days: 90 },
                            { label: "+6 months", days: 180 },
                          ].map((preset) => {
                            const d = new Date();
                            d.setDate(d.getDate() + preset.days);
                            const val = d.toISOString().split("T")[0];
                            return (
                              <button key={preset.label} type="button"
                                className={`text-xs px-2 py-1 rounded-full border transition-colors ${scheduleDate === val ? "bg-amber-600 text-white border-amber-600" : "border-amber-300 text-amber-700 hover:bg-amber-100"}`}
                                onClick={() => setScheduleDate(val)}>
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="flex-1 px-3 py-1.5 border border-amber-300 rounded-lg text-sm bg-white focus:border-amber-500 outline-none" />
                          <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-28 px-3 py-1.5 border border-amber-300 rounded-lg text-sm bg-white focus:border-amber-500 outline-none" />
                        </div>
                        <Button size="sm" className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                          onClick={handleScheduleEmail} disabled={!scheduleDate || createScheduledEmailMutation.isPending}>
                          {createScheduledEmailMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
                          Confirm Schedule
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleCopyEmail} disabled={!emailSubject && !emailBody}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button size="sm" className="rounded-xl bg-primary text-white gap-1.5" onClick={handleSendOutlook} disabled={!emailSubject || !emailBody}>
                        <Mail className="h-3.5 w-3.5" /> Send via Outlook
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setScheduleMode(!scheduleMode)} disabled={!emailSubject || !emailBody}>
                        <Calendar className="h-3.5 w-3.5" /> Schedule
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleSaveDraft} disabled={!emailSubject && !emailBody}>
                        <Save className="h-3.5 w-3.5" /> Save Draft
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={handleMarkContacted}>
                        <Check className="h-3.5 w-3.5" /> Mark Contacted
                      </Button>
                    </div>
                  </div>
                </DrawerSection>

                {pendingScheduledEmails.length > 0 && (
                  <DrawerSection title={`Upcoming Emails (${pendingScheduledEmails.length})`} icon={<Calendar className="h-4 w-4" />}
                    collapsible expanded={showScheduled} onToggle={() => setShowScheduled(!showScheduled)}>
                    <div className="space-y-3">
                      {pendingScheduledEmails.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/30">
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => handleBulkSequenceAction("pause", "manual")}>
                            <PauseCircle className="h-3 w-3" /> Pause All
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleBulkSequenceAction("resume")}>
                            <RotateCcw className="h-3 w-3" /> Resume All
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 text-red-700 border-red-300 hover:bg-red-50" onClick={() => { if (confirm("Cancel all scheduled emails for this lead?")) handleBulkSequenceAction("cancel", "manual"); }}>
                            <XCircle className="h-3 w-3" /> Cancel All
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 text-blue-700 border-blue-300 hover:bg-blue-50" onClick={() => handleBulkSequenceAction("skip")}>
                            <SkipForward className="h-3 w-3" /> Skip Next
                          </Button>
                        </div>
                      )}
                      {pendingScheduledEmails.map((e: any) => (
                        <div key={e.id} className={`border rounded-xl p-3 ${e.status === "paused" ? "border-amber-300 bg-amber-50/80" : "border-border/50 bg-amber-50/50"}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {e.status === "paused" ? (
                                <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                              )}
                              <span className="text-xs font-semibold text-amber-700">
                                {format(new Date(e.scheduledFor), "MMM d, yyyy h:mm a")}
                              </span>
                              {e.sequenceStepNumber && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Step {e.sequenceStepNumber}</span>
                              )}
                              {e.status === "paused" && e.pauseReason === "reply_received" && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                  <MessageSquare className="h-2.5 w-2.5" /> Paused — Reply
                                </span>
                              )}
                              {e.status === "paused" && e.pauseReason !== "reply_received" && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Paused</span>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive" onClick={() => handleCancelScheduled(e.id)}>
                              <XCircle className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                          </div>
                          <p className="text-sm font-medium truncate">{e.subject}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{e.body}</p>
                        </div>
                      ))}
                    </div>
                  </DrawerSection>
                )}

                <DrawerSection title={`Tasks (${leadTasks.filter((t: any) => t.status !== "completed" && t.status !== "dismissed").length})`} icon={<CheckCircle2 className="h-4 w-4" />}
                  collapsible expanded={showTasks} onToggle={() => setShowTasks(!showTasks)}>
                  {(() => {
                    const openTasks = leadTasks.filter((t: any) => t.status === "open" || t.status === "in_progress");
                    const overdueTasks = openTasks.filter((t: any) => t.dueDate && t.dueDate < new Date().toISOString().split("T")[0]);
                    const completedTasks = leadTasks.filter((t: any) => t.status === "completed" || t.status === "dismissed");
                    const priorityBadge: Record<string, string> = { urgent: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-blue-100 text-blue-700", low: "bg-slate-100 text-slate-600" };
                    return (
                      <div className="space-y-2">
                        {openTasks.length === 0 && completedTasks.length === 0 && (
                          <p className="text-sm text-muted-foreground">No tasks for this lead.</p>
                        )}
                        {overdueTasks.length > 0 && (
                          <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3 w-3" /> {overdueTasks.length} overdue
                          </div>
                        )}
                        {openTasks.map((t: any) => (
                          <div key={t.id} className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${overdueTasks.includes(t) ? "border-destructive/30 bg-destructive/5" : "border-border/50"}`}>
                            <button onClick={() => handleQuickCompleteTask(t.id)} className="text-muted-foreground hover:text-emerald-500 flex-shrink-0">
                              <Circle className="h-4 w-4" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">{t.title || t.taskType}</span>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${priorityBadge[t.priority] || priorityBadge.medium}`}>
                              {(t.priority || "medium").toUpperCase()}
                            </span>
                            {t.source === "system" && <Zap className="h-3 w-3 text-violet-500" />}
                            <button onClick={() => handleQuickDismissTask(t.id)} className="text-muted-foreground hover:text-amber-500 flex-shrink-0">
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {completedTasks.length > 0 && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">{completedTasks.length} completed</summary>
                            <div className="mt-1 space-y-1">
                              {completedTasks.slice(0, 5).map((t: any) => (
                                <div key={t.id} className="flex items-center gap-2 p-1.5 text-xs text-muted-foreground opacity-60">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  <span className="line-through truncate">{t.title || t.taskType}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <div className="flex gap-2 pt-1">
                          <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-border rounded-lg text-xs bg-background">
                            <option value="">Add task...</option>
                            <option value="follow_up_call">Follow-Up Call</option>
                            <option value="send_manual_email">Send Manual Email</option>
                            <option value="review_reply">Review Reply</option>
                            <option value="check_high_intent">Check High Intent</option>
                            <option value="custom">Custom</option>
                          </select>
                          {newTaskType && (
                            <Button size="sm" className="h-7 text-xs rounded-lg bg-primary text-white" onClick={handleCreateQuickTask}>
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              h.actionType === "Email Sent" ? "bg-emerald-100 text-emerald-700" :
                              h.actionType === "Email Scheduled" ? "bg-amber-100 text-amber-700" :
                              h.actionType === "Sequence Activated" ? "bg-blue-100 text-blue-700" :
                              h.actionType === "Draft Saved" ? "bg-gray-100 text-gray-700" :
                              "bg-primary/10 text-primary"
                            }`}>{h.actionType}</span>
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

                <DrawerSection title={`Conversation (${conversationThread.length})`} icon={<MessageSquare className="h-4 w-4" />}
                  collapsible expanded={showConversation} onToggle={() => setShowConversation(!showConversation)}>
                  {conversationLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : conversationThread.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">No messages yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto">
                      {conversationThread.map((msg: any, idx: number) => {
                        const msgKey = `${msg.type}-${msg.id}`;
                        const isExpanded = expandedMessageId === msgKey;
                        const isInbound = msg.type === "inbound";
                        return (
                          <div key={msgKey}
                            className={`rounded-xl border p-3 cursor-pointer transition-colors ${
                              isInbound
                                ? "bg-emerald-50 border-emerald-200 ml-2"
                                : "bg-muted/30 border-border mr-2"
                            }`}
                            onClick={() => setExpandedMessageId(isExpanded ? null : msgKey)}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {isInbound ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                                    <MessageSquare className="h-2.5 w-2.5" /> Reply
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                                    <Send className="h-2.5 w-2.5" /> Sent
                                  </span>
                                )}
                                {isInbound && msg.isAutoReply && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Auto-reply</span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {msg.timestamp ? format(new Date(msg.timestamp), "MMM d, h:mm a") : "—"}
                              </span>
                            </div>
                            <p className="text-xs font-medium">{msg.subject || "(no subject)"}</p>
                            <p className="text-[10px] text-muted-foreground">From: {msg.from || "—"}</p>
                            {isExpanded && msg.body && (
                              <div className="mt-2 pt-2 border-t border-border/50">
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                              </div>
                            )}
                            {!isExpanded && msg.body && (
                              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{msg.body}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 mt-2 w-full" onClick={fetchConversation}>
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </DrawerSection>

                <DrawerSection title={`Activity Timeline (${activities?.length || 0})`} icon={<TrendingUp className="h-4 w-4" />}
                  collapsible expanded={showActivities} onToggle={() => setShowActivities(!showActivities)}>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: "all", label: "All" },
                        { key: "outreach", label: "Outreach" },
                        { key: "scheduling", label: "Scheduling" },
                        { key: "engagement", label: "Engagement" },
                        { key: "notes", label: "Notes" },
                        { key: "status", label: "Status" },
                      ].map((cat) => (
                        <button key={cat.key} onClick={() => setActivityFilter(cat.key)}
                          className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${activityFilter === cat.key ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 flex-1" onClick={() => { setShowNoteInput(!showNoteInput); setNoteType("note"); }}>
                        <StickyNote className="h-3 w-3" /> Add Note
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 flex-1" onClick={() => { setShowNoteInput(!showNoteInput); setNoteType("reply"); }}>
                        <MessageSquare className="h-3 w-3" /> Log Reply
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg gap-1 flex-1" onClick={() => { setShowNoteInput(!showNoteInput); setNoteType("call"); }}>
                        <Play className="h-3 w-3" /> Log Call
                      </Button>
                    </div>

                    {showNoteInput && (
                      <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          {noteType === "note" && <><StickyNote className="h-3 w-3" /> Add Note</>}
                          {noteType === "reply" && <><MessageSquare className="h-3 w-3" /> Log Reply</>}
                          {noteType === "call" && <><Play className="h-3 w-3" /> Log Call</>}
                        </div>
                        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                          placeholder={noteType === "reply" ? "Summary of the reply..." : noteType === "call" ? "Call notes..." : "Add a note..."}
                          className="w-full p-2 border border-border rounded-lg text-sm bg-background focus:border-primary outline-none min-h-[60px] resize-y" />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNoteInput(false)}>Cancel</Button>
                          <Button size="sm" className="h-7 text-xs bg-primary text-white rounded-lg" onClick={handleLogNote} disabled={!noteText.trim()}>Save</Button>
                        </div>
                      </div>
                    )}

                    {filteredActivities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">No activity recorded yet.</p>
                    ) : (
                      <div className="relative pl-4 space-y-0 max-h-[300px] overflow-y-auto">
                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                        {filteredActivities.map((a: any) => {
                          const typeColors: Record<string, string> = {
                            email_sent: "bg-emerald-500", email_delivered: "bg-emerald-400", email_opened: "bg-blue-500",
                            email_clicked: "bg-violet-500", reply_logged: "bg-primary", reply_received: "bg-emerald-600",
                            auto_reply_received: "bg-amber-500", sequence_paused: "bg-amber-600",
                            email_bounced: "bg-red-500",
                            email_failed: "bg-red-400", lead_unsubscribed: "bg-red-600", email_scheduled: "bg-amber-500",
                            email_canceled: "bg-gray-400", email_paused: "bg-amber-400", email_resumed: "bg-emerald-400",
                            note_added: "bg-blue-400", call_logged: "bg-teal-500", sequence_activated: "bg-blue-600",
                          };
                          const dotColor = typeColors[a.type] || "bg-gray-400";
                          return (
                            <div key={a.id} className="relative flex items-start gap-3 pb-3">
                              <div className={`absolute left-[-12px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card ${dotColor} z-10`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground">{a.description}</p>
                                {a.createdBy && a.createdBy !== "system" && (
                                  <span className="text-[10px] text-muted-foreground">by {a.createdBy}</span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{format(new Date(a.createdAt), "MMM d, h:mm a")}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
              {linkedSequence && activateSequence && (
                <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                  <Link2 className="h-3 w-3 inline mr-1" />
                  Confirming will also activate {sequenceSteps.length - 1} follow-up emails from "{linkedSequence.name}"
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days.
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

function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
    </div>
  );
}

function SelectField({ label, value, options, onChange, allowEmpty }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none">
        {allowEmpty && <option value="">—</option>}
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
