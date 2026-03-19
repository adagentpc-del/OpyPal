import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetLeads, useCreateLead, useUpdateLead, useDeleteLead, useDuplicateLead, useUpdateLeadStatus, useGetSyncStatus, useGetTemplates, getGetLeadsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit2, Building2, Copy, ChevronDown, X, Filter, Cloud, CloudOff, Loader2, AlertCircle, Mail, Check } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const STATUSES = ["New Lead", "Contacted", "Replied", "Qualified", "Meeting Booked", "Meeting Completed", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost", "Nurture"];
const PIPELINE_TYPES = ["Event", "Agency"];
const PROJECT_TYPES = ["Event Activation", "Conference", "Hotel Event", "Brand Activation", "Experiential Install", "Fabrication", "Large Format Printing", "Projection Mapping", "Ongoing Partnership"];
const SOURCES = ["ZoomInfo", "LinkedIn", "Referral", "Website", "Cold Call", "Email", "Existing Relationship", "Other"];

const emptyLead = {
  pipelineType: "Event",
  companyName: "",
  contactName: "",
  title: "",
  email: "",
  phone: "",
  linkedin: "",
  location: "",
  industry: "",
  venueProperty: "",
  projectType: "",
  estimatedBudget: undefined as number | undefined,
  status: "New Lead",
  lastContactDate: "",
  nextStep: "",
  nextFollowUpDate: "",
  notes: "",
  dealValueEstimate: undefined as number | undefined,
  proposalValue: undefined as number | undefined,
  closeProbability: undefined as number | undefined,
  source: "",
};

export default function Leads() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyLead });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: syncStatus } = useGetSyncStatus({ query: { refetchInterval: 10000 } });

  const { data: leads, isLoading } = useGetLeads({
    search: search || undefined,
    pipelineType: filterType || undefined,
    status: filterStatus || undefined,
    projectType: filterProject || undefined,
    source: filterSource || undefined,
    overdue: filterOverdue || undefined,
    followUpDueToday: filterDueToday || undefined,
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
    setEditingLead(null);
    setForm({ ...emptyLead });
    setModalOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditingLead(lead);
    setForm({
      pipelineType: lead.pipelineType,
      companyName: lead.companyName,
      contactName: lead.contactName,
      title: lead.title || "",
      email: lead.email || "",
      phone: lead.phone || "",
      linkedin: lead.linkedin || "",
      location: lead.location || "",
      industry: lead.industry || "",
      venueProperty: lead.venueProperty || "",
      projectType: lead.projectType || "",
      estimatedBudget: lead.estimatedBudget ? Number(lead.estimatedBudget) : undefined,
      status: lead.status,
      lastContactDate: lead.lastContactDate || "",
      nextStep: lead.nextStep || "",
      nextFollowUpDate: lead.nextFollowUpDate || "",
      notes: lead.notes || "",
      dealValueEstimate: lead.dealValueEstimate ? Number(lead.dealValueEstimate) : undefined,
      proposalValue: lead.proposalValue ? Number(lead.proposalValue) : undefined,
      closeProbability: lead.closeProbability ? Number(lead.closeProbability) : undefined,
      source: lead.source || "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    const payload: any = { ...form };
    if (!payload.companyName || !payload.contactName) {
      toast({ title: "Required fields", description: "Company and Contact name are required.", variant: "destructive" });
      return;
    }
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: payload }, {
        onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Lead updated" }); },
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Lead created" }); },
      });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Lead deleted" }); } });
  };

  const handleDuplicate = (id: number) => {
    duplicateMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Lead duplicated" }); } });
  };

  const handleQuickStatus = (id: number, status: string) => {
    statusMutation.mutate({ id, data: { status } }, { onSuccess: invalidate });
  };

  const { data: allTemplates } = useGetTemplates();
  const emailTemplates = (allTemplates || []).filter((t: any) =>
    ["Cold Email", "Follow-Up Email"].includes(t.category)
  );

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendLead, setSendLead] = useState<any>(null);
  const [sendSelectedTemplateId, setSendSelectedTemplateId] = useState<number | null>(null);
  const [sendCustomSubject, setSendCustomSubject] = useState("");
  const [sendCustomBody, setSendCustomBody] = useState("");

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmLeadId, setConfirmLeadId] = useState<number | null>(null);
  const [confirmLeadName, setConfirmLeadName] = useState("");

  const openSendForLead = (lead: any) => {
    setSendLead(lead);
    setSendSelectedTemplateId(emailTemplates.length > 0 ? emailTemplates[0].id : null);
    const firstTpl = emailTemplates.length > 0 ? emailTemplates[0] : null;
    setSendCustomSubject(firstTpl?.subject || "");
    setSendCustomBody(firstTpl?.body || "");
    setSendModalOpen(true);
  };

  const handleTemplateChange = (id: number) => {
    setSendSelectedTemplateId(id);
    const tpl = (allTemplates || []).find((t: any) => t.id === id);
    if (tpl) {
      setSendCustomSubject(tpl.subject || "");
      setSendCustomBody(tpl.body || "");
    }
  };

  const handleSendFromLeads = () => {
    if (!sendLead?.email) {
      toast({ title: "This lead has no email address", variant: "destructive" });
      return;
    }
    const subject = encodeURIComponent(sendCustomSubject);
    const body = encodeURIComponent(sendCustomBody.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    const mailto = `mailto:${encodeURIComponent(sendLead.email)}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setSendModalOpen(false);

    setConfirmLeadId(sendLead.id);
    setConfirmLeadName(sendLead.companyName || sendLead.contactName || sendLead.email);
    setTimeout(() => setConfirmModalOpen(true), 800);
  };

  const handleConfirmSent = (didSend: boolean) => {
    if (didSend && confirmLeadId) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      let followUp = new Date(now);
      let added = 0;
      while (added < 2) {
        followUp.setDate(followUp.getDate() + 1);
        const dow = followUp.getDay();
        if (dow !== 0 && dow !== 6) added++;
      }
      const followUpStr = followUp.toISOString().split("T")[0];
      updateMutation.mutate(
        {
          id: confirmLeadId,
          data: {
            status: "Contacted",
            lastContactDate: todayStr,
            nextStep: "Awaiting reply",
            nextFollowUpDate: followUpStr,
          } as any,
        },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Lead updated to Contacted", description: `Follow-up set for ${followUpStr}` });
          },
        }
      );
    }
    setConfirmModalOpen(false);
    setConfirmLeadId(null);
  };

  const today = new Date().toISOString().split("T")[0];
  const forecast = ((form.proposalValue || form.dealValueEstimate || 0) * (form.closeProbability || 0)) / 100;
  const activeFilters = [filterType, filterStatus, filterProject, filterSource, filterOverdue, filterDueToday].filter(Boolean).length;

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
                <option value="">All Types</option>
                {PIPELINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Projects</option>
                {PROJECT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background">
                <option value="">All Sources</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-background cursor-pointer">
                <input type="checkbox" checked={filterDueToday} onChange={(e) => setFilterDueToday(e.target.checked)} className="rounded" />
                Due Today
              </label>
              <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-background cursor-pointer">
                <input type="checkbox" checked={filterOverdue} onChange={(e) => setFilterOverdue(e.target.checked)} className="rounded" />
                Overdue
              </label>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setFilterType(""); setFilterStatus(""); setFilterProject(""); setFilterSource(""); setFilterOverdue(false); setFilterDueToday(false); }}>
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
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Type</th>
                    <th className="px-4 py-3 font-semibold text-right hidden lg:table-cell">Value</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Follow-Up</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                  ) : leads?.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-10 w-10 text-border mx-auto mb-2" />
                      <p>No leads found.</p>
                    </td></tr>
                  ) : (
                    leads?.map((lead) => {
                      const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < today && lead.status !== "Closed Won" && lead.status !== "Closed Lost";
                      return (
                        <tr key={lead.id} className={`hover:bg-muted/30 transition-colors group ${isOverdue ? "bg-destructive/5" : ""}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lead.pipelineType === "Event" ? "bg-primary" : "bg-accent"}`} />
                              <span className="font-medium text-foreground">{lead.companyName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{lead.contactName}</td>
                          <td className="px-4 py-3">
                            <select
                              value={lead.status}
                              onChange={(e) => handleQuickStatus(lead.id, e.target.value)}
                              className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer
                                ${lead.status === "Closed Won" ? "bg-emerald-100 text-emerald-700" :
                                  lead.status === "Closed Lost" ? "bg-red-100 text-red-700" :
                                  lead.status === "Nurture" ? "bg-amber-100 text-amber-700" :
                                  "bg-primary/10 text-primary"}`}
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.pipelineType}</td>
                          <td className="px-4 py-3 text-right font-medium hidden lg:table-cell">
                            ${Number(lead.proposalValue || lead.dealValueEstimate || 0).toLocaleString()}
                          </td>
                          <td className={`px-4 py-3 hidden lg:table-cell ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {lead.nextFollowUpDate ? format(new Date(lead.nextFollowUpDate + "T12:00:00"), "MMM d, yyyy") : "-"}
                            {isOverdue && " (overdue)"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {lead.email && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSendForLead(lead)} title="Send via Outlook">
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)} title="Edit">
                                <Edit2 className="h-4 w-4" />
                              </Button>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-border z-10">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{editingLead ? "Edit Lead" : "New Lead"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Company Name *" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
                <Field label="Contact Name *" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} />
                <SelectField label="Pipeline Type" value={form.pipelineType} options={PIPELINE_TYPES} onChange={(v) => setForm({ ...form, pipelineType: v })} />
                <SelectField label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm({ ...form, status: v })} />
                <Field label="Title / Role" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
                <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                <Field label="LinkedIn" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} />
                <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} />
                <Field label="Venue / Property" value={form.venueProperty} onChange={(v) => setForm({ ...form, venueProperty: v })} />
                <SelectField label="Project Type" value={form.projectType} options={PROJECT_TYPES} onChange={(v) => setForm({ ...form, projectType: v })} allowEmpty />
                <SelectField label="Source" value={form.source} options={SOURCES} onChange={(v) => setForm({ ...form, source: v })} allowEmpty />
                <Field label="Estimated Budget" value={form.estimatedBudget?.toString() || ""} onChange={(v) => setForm({ ...form, estimatedBudget: v ? Number(v) : undefined })} type="number" />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Deal & Forecast</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Deal Value Estimate" value={form.dealValueEstimate?.toString() || ""} onChange={(v) => setForm({ ...form, dealValueEstimate: v ? Number(v) : undefined })} type="number" />
                  <Field label="Proposal Value" value={form.proposalValue?.toString() || ""} onChange={(v) => setForm({ ...form, proposalValue: v ? Number(v) : undefined })} type="number" />
                  <Field label="Close Probability (%)" value={form.closeProbability?.toString() || ""} onChange={(v) => setForm({ ...form, closeProbability: v ? Number(v) : undefined })} type="number" />
                </div>
                {forecast > 0 && (
                  <p className="text-sm mt-2 text-primary font-semibold">Forecast: ${forecast.toLocaleString()}</p>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Follow-Up & Notes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Last Contact Date" value={form.lastContactDate} onChange={(v) => setForm({ ...form, lastContactDate: v })} type="date" />
                  <Field label="Next Follow-Up Date" value={form.nextFollowUpDate} onChange={(v) => setForm({ ...form, nextFollowUpDate: v })} type="date" />
                  <div className="sm:col-span-2">
                    <Field label="Next Step" value={form.nextStep} onChange={(v) => setForm({ ...form, nextStep: v })} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm font-medium text-foreground block mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-y" />
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex flex-col sm:flex-row justify-between gap-3 rounded-b-2xl">
              <div>
                {editingLead && editingLead.email && (
                  <Button variant="outline" className="rounded-xl gap-2" onClick={() => { setModalOpen(false); openSendForLead(editingLead); }}>
                    <Mail className="h-4 w-4" /> Send via Outlook
                  </Button>
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleSave} className="bg-primary text-white rounded-xl" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingLead ? "Save Changes" : "Create Lead"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSendModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border z-10">
            <div className="px-5 sm:px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Send via Outlook</h2>
              <Button variant="ghost" size="icon" onClick={() => setSendModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Sending to</p>
                <p className="text-sm font-semibold">{sendLead?.companyName} — {sendLead?.contactName}</p>
                <p className="text-xs text-muted-foreground">{sendLead?.email}</p>
              </div>

              {emailTemplates.length > 0 && (
                <div>
                  <label className="text-sm font-medium block mb-1.5">Template</label>
                  <select
                    value={sendSelectedTemplateId || ""}
                    onChange={(e) => handleTemplateChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none"
                  >
                    {emailTemplates.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1.5">Subject</label>
                <input
                  type="text"
                  value={sendCustomSubject}
                  onChange={(e) => setSendCustomSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Body</label>
                <textarea
                  value={sendCustomBody}
                  onChange={(e) => setSendCustomBody(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[180px] resize-y whitespace-pre-wrap"
                />
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setSendModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSendFromLeads} className="bg-primary text-white rounded-xl gap-2">
                <Mail className="h-4 w-4" /> Send via Outlook
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModalOpen && (
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
                  To <span className="font-medium text-foreground">{confirmLeadName}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days.
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleConfirmSent(false)}>
                  No
                </Button>
                <Button className="flex-1 rounded-xl bg-primary text-white gap-2" onClick={() => handleConfirmSent(true)}>
                  <Check className="h-4 w-4" /> Yes, I sent it
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
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

function SyncBadge({ status }: { status?: string }) {
  if (!status) return null;
  const config: Record<string, { icon: any; label: string; classes: string }> = {
    connected: { icon: Cloud, label: "Synced", classes: "bg-emerald-100 text-emerald-700" },
    syncing: { icon: Loader2, label: "Syncing", classes: "bg-blue-100 text-blue-700" },
    error: { icon: AlertCircle, label: "Sync Error", classes: "bg-red-100 text-red-700" },
    disconnected: { icon: CloudOff, label: "Disconnected", classes: "bg-gray-100 text-gray-600" },
  };
  const c = config[status] || config.disconnected;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${c.classes}`}>
      <Icon className={`h-3 w-3 ${status === "syncing" ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}
