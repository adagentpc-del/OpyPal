import { useState, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetLeads,
  useGetTemplates,
  useUpdateLead,
  getGetLeadsQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Copy,
  UserCheck,
  Clock,
  SkipForward,
  ExternalLink,
  Sparkles,
  Edit2,
  X,
  Check,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Calendar,
  AlertTriangle,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";

type QueueView = "new-imports" | "due-today" | "overdue" | "awaiting-reply";

function getNextBusinessDay(from: Date, days: number): string {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().split("T")[0];
}

function addBusinessDays(days: number): string {
  return getNextBusinessDay(new Date(), days);
}

function addCalendarDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

const DRAFT_STORAGE_KEY = "a3-outreach-drafts";

function getDrafts(): Record<number, { subject: string; body: string; generatedAt: string }> {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDraft(leadId: number, subject: string, body: string) {
  const drafts = getDrafts();
  drafts[leadId] = { subject, body, generatedAt: new Date().toISOString() };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function deleteDraft(leadId: number) {
  const drafts = getDrafts();
  delete drafts[leadId];
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

function generateDraftFromTemplate(
  template: { subject?: string | null; body: string },
  lead: any
): { subject: string; body: string } {
  const firstName = (lead.contactName || "").split(" ")[0] || "there";
  const replacements: Record<string, string> = {
    "[First Name]": firstName,
    "[Name]": lead.contactName || "",
    "[Company Name]": lead.companyName || "",
    "[company]": lead.companyName || "",
    "[Company]": lead.companyName || "",
    "[venue / agency]": lead.companyName || "",
    "[venue]": lead.venueProperty || lead.companyName || "",
    "[Title]": lead.title || "",
    "[Location]": lead.location || "",
    "[Industry]": lead.industry || "",
  };
  let subject = template.subject || "";
  let body = template.body || "";
  for (const [key, val] of Object.entries(replacements)) {
    subject = subject.split(key).join(val);
    body = body.split(key).join(val);
  }
  return { subject, body };
}

export default function OutreachQueue() {
  const [activeView, setActiveView] = useState<QueueView>("new-imports");
  const [sortBy, setSortBy] = useState("newest");
  const [filterPipeline, setFilterPipeline] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendLead, setSendLead] = useState<any>(null);
  const [sendSubject, setSendSubject] = useState("");
  const [sendBody, setSendBody] = useState("");

  const [editDraftOpen, setEditDraftOpen] = useState(false);
  const [editDraftLead, setEditDraftLead] = useState<any>(null);
  const [editDraftSubject, setEditDraftSubject] = useState("");
  const [editDraftBody, setEditDraftBody] = useState("");

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmLeadId, setConfirmLeadId] = useState<number | null>(null);
  const [confirmLeadName, setConfirmLeadName] = useState("");

  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpLeadId, setFollowUpLeadId] = useState<number | null>(null);
  const [customDate, setCustomDate] = useState("");

  const [batchFollowUpOpen, setBatchFollowUpOpen] = useState(false);
  const [batchCustomDate, setBatchCustomDate] = useState("");

  const [draftsVersion, setDraftsVersion] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: leads, isLoading } = useGetLeads();
  const { data: templates } = useGetTemplates();
  const updateMutation = useUpdateLead();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient]);

  const today = new Date().toISOString().split("T")[0];

  const emailTemplates = useMemo(() => {
    return (templates || []).filter((t: any) =>
      ["Cold Email", "Follow-Up Email"].includes(t.category)
    );
  }, [templates]);

  const coldTemplates = useMemo(() => {
    return (templates || []).filter((t: any) => t.category === "Cold Email");
  }, [templates]);

  const followUpTemplates = useMemo(() => {
    return (templates || []).filter((t: any) => t.category === "Follow-Up Email");
  }, [templates]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    let result = leads.filter((l: any) => {
      switch (activeView) {
        case "new-imports":
          return l.status === "New Lead";
        case "due-today":
          return (
            l.nextFollowUpDate === today &&
            l.status !== "Closed Won" &&
            l.status !== "Closed Lost"
          );
        case "overdue":
          return (
            l.nextFollowUpDate &&
            l.nextFollowUpDate < today &&
            l.status !== "Closed Won" &&
            l.status !== "Closed Lost"
          );
        case "awaiting-reply":
          return (
            l.status === "Contacted" ||
            (l.nextStep && l.nextStep.toLowerCase().includes("awaiting reply"))
          );
        default:
          return true;
      }
    });

    result = result.filter((l: any) => !skippedIds.has(l.id));

    if (filterPipeline) result = result.filter((l: any) => l.pipelineType === filterPipeline);
    if (filterSource) result = result.filter((l: any) => l.source === filterSource);
    if (filterLocation) result = result.filter((l: any) => l.location && l.location.toLowerCase().includes(filterLocation.toLowerCase()));
    if (filterStatus) result = result.filter((l: any) => l.status === filterStatus);

    switch (sortBy) {
      case "newest":
        result.sort((a: any, b: any) => (b.id || 0) - (a.id || 0));
        break;
      case "oldest-followup":
        result.sort((a: any, b: any) => (a.nextFollowUpDate || "9999").localeCompare(b.nextFollowUpDate || "9999"));
        break;
      case "highest-value":
        result.sort((a: any, b: any) => Number(b.proposalValue || b.dealValueEstimate || 0) - Number(a.proposalValue || a.dealValueEstimate || 0));
        break;
      case "pipeline":
        result.sort((a: any, b: any) => (a.pipelineType || "").localeCompare(b.pipelineType || ""));
        break;
    }

    return result;
  }, [leads, activeView, today, skippedIds, filterPipeline, filterSource, filterLocation, filterStatus, sortBy]);

  const viewCounts = useMemo(() => {
    if (!leads) return { "new-imports": 0, "due-today": 0, overdue: 0, "awaiting-reply": 0 };
    return {
      "new-imports": leads.filter((l: any) => l.status === "New Lead").length,
      "due-today": leads.filter((l: any) => l.nextFollowUpDate === today && l.status !== "Closed Won" && l.status !== "Closed Lost").length,
      overdue: leads.filter((l: any) => l.nextFollowUpDate && l.nextFollowUpDate < today && l.status !== "Closed Won" && l.status !== "Closed Lost").length,
      "awaiting-reply": leads.filter((l: any) => l.status === "Contacted" || (l.nextStep && l.nextStep.toLowerCase().includes("awaiting reply"))).length,
    };
  }, [leads, today]);

  const drafts = useMemo(() => {
    void draftsVersion;
    return getDrafts();
  }, [draftsVersion]);

  const uniqueSources = useMemo(() => {
    if (!leads) return [];
    return [...new Set(leads.map((l: any) => l.source).filter(Boolean))].sort();
  }, [leads]);

  const buildLeadUpdate = useCallback((lead: any, changes: Record<string, any>) => {
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
  }, []);

  const activeFilters = [filterPipeline, filterSource, filterLocation, filterStatus].filter(Boolean).length;

  const handleGenerateDraft = useCallback((lead: any) => {
    const isNewLead = lead.status === "New Lead";
    const pool = isNewLead && coldTemplates.length > 0 ? coldTemplates : followUpTemplates.length > 0 ? followUpTemplates : emailTemplates;
    if (pool.length === 0) {
      toast({ title: "No email templates available", description: "Create templates first in the Templates page.", variant: "destructive" });
      return;
    }
    const template = pool[Math.floor(Math.random() * pool.length)];
    const { subject, body } = generateDraftFromTemplate(template, lead);
    saveDraft(lead.id, subject, body);
    setDraftsVersion((v) => v + 1);
    toast({ title: "Draft generated", description: `Based on "${template.name}"` });
  }, [coldTemplates, followUpTemplates, emailTemplates, toast]);

  const handleBatchGenerateDrafts = useCallback(() => {
    const pool = coldTemplates.length > 0 ? coldTemplates : emailTemplates;
    if (pool.length === 0) {
      toast({ title: "No email templates available", variant: "destructive" });
      return;
    }
    let count = 0;
    selectedIds.forEach((id) => {
      const lead = leads?.find((l: any) => l.id === id);
      if (lead && !drafts[id]) {
        const isNew = lead.status === "New Lead";
        const tplPool = isNew && coldTemplates.length > 0 ? coldTemplates : followUpTemplates.length > 0 ? followUpTemplates : pool;
        const template = tplPool[Math.floor(Math.random() * tplPool.length)];
        const { subject, body } = generateDraftFromTemplate(template, lead);
        saveDraft(lead.id, subject, body);
        count++;
      }
    });
    setDraftsVersion((v) => v + 1);
    toast({ title: `${count} draft${count !== 1 ? "s" : ""} generated` });
  }, [selectedIds, leads, drafts, coldTemplates, followUpTemplates, emailTemplates, toast]);

  const handleCopyDraft = useCallback((leadId: number) => {
    const draft = drafts[leadId];
    if (!draft) return;
    const text = draft.subject ? `Subject: ${draft.subject}\n\n${draft.body}` : draft.body;
    navigator.clipboard.writeText(text);
    toast({ title: "Email copied to clipboard" });
  }, [drafts, toast]);

  const handleOpenSend = useCallback((lead: any) => {
    if (!lead.email) {
      toast({ title: "This lead has no email address", variant: "destructive" });
      return;
    }
    const draft = drafts[lead.id];
    setSendLead(lead);
    setSendSubject(draft?.subject || "");
    setSendBody(draft?.body || "");
    setSendModalOpen(true);
  }, [drafts, toast]);

  const handleSendViaOutlook = useCallback(() => {
    if (!sendLead?.email) return;
    const subject = encodeURIComponent(sendSubject);
    const body = encodeURIComponent(sendBody.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
    window.open(`mailto:${encodeURIComponent(sendLead.email)}?subject=${subject}&body=${body}`, "_blank");
    setSendModalOpen(false);
    setConfirmLeadId(sendLead.id);
    setConfirmLeadName(sendLead.companyName || sendLead.contactName || sendLead.email);
    setTimeout(() => setConfirmModalOpen(true), 800);
  }, [sendLead, sendSubject, sendBody]);

  const handleConfirmSent = useCallback((didSend: boolean) => {
    if (didSend && confirmLeadId) {
      const lead = leads?.find((l: any) => l.id === confirmLeadId);
      if (lead) {
        const todayStr = new Date().toISOString().split("T")[0];
        const followUpDate = addBusinessDays(2);
        updateMutation.mutate(
          { id: confirmLeadId, data: buildLeadUpdate(lead, { status: "Contacted", lastContactDate: todayStr, nextStep: "Awaiting reply", nextFollowUpDate: followUpDate }) },
          { onSuccess: () => { invalidate(); toast({ title: "Lead updated to Contacted", description: `Follow-up set for ${followUpDate}` }); } }
        );
      }
    }
    setConfirmModalOpen(false);
    setConfirmLeadId(null);
  }, [confirmLeadId, leads, buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleMarkAsContacted = useCallback((lead: any) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const followUpDate = addBusinessDays(2);
    updateMutation.mutate(
      { id: lead.id, data: buildLeadUpdate(lead, { status: "Contacted", lastContactDate: todayStr, nextStep: "Awaiting reply", nextFollowUpDate: followUpDate }) },
      { onSuccess: () => { invalidate(); toast({ title: `${lead.companyName} marked as Contacted` }); }, onError: () => { toast({ title: `Failed to update ${lead.companyName}`, variant: "destructive" }); } }
    );
  }, [buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleBatchMarkContacted = useCallback(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const followUpDate = addBusinessDays(2);
    let done = 0;
    let success = 0;
    const total = selectedIds.size;
    selectedIds.forEach((id) => {
      const lead = leads?.find((l: any) => l.id === id);
      if (!lead) { done++; return; }
      updateMutation.mutate(
        { id, data: buildLeadUpdate(lead, { status: "Contacted", lastContactDate: todayStr, nextStep: "Awaiting reply", nextFollowUpDate: followUpDate }) },
        {
          onSuccess: () => { success++; },
          onError: () => { toast({ title: `Failed to update ${lead.companyName}`, variant: "destructive" }); },
          onSettled: () => { done++; if (done >= total) { invalidate(); if (success > 0) toast({ title: `${success} lead${success !== 1 ? "s" : ""} marked as Contacted` }); } }
        }
      );
    });
    setSelectedIds(new Set());
  }, [selectedIds, leads, buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleSnooze = useCallback((lead: any) => {
    const newDate = addBusinessDays(1);
    updateMutation.mutate(
      { id: lead.id, data: buildLeadUpdate(lead, { nextFollowUpDate: newDate, nextStep: "Snoozed — follow up " + newDate }) },
      { onSuccess: () => { invalidate(); toast({ title: `${lead.companyName} snoozed to ${newDate}` }); }, onError: () => { toast({ title: `Failed to snooze ${lead.companyName}`, variant: "destructive" }); } }
    );
  }, [buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleSkip = useCallback((lead: any) => {
    setSkippedIds((prev) => new Set(prev).add(lead.id));
    toast({ title: `Skipped ${lead.companyName}` });
  }, [toast]);

  const handleSetFollowUp = useCallback((leadId: number, date: string, label: string) => {
    const lead = leads?.find((l: any) => l.id === leadId);
    if (!lead) return;
    updateMutation.mutate(
      { id: leadId, data: buildLeadUpdate(lead, { nextFollowUpDate: date, nextStep: `Follow up ${label}` }) },
      { onSuccess: () => { invalidate(); setFollowUpOpen(false); toast({ title: `Follow-up set for ${date}` }); }, onError: () => { toast({ title: "Failed to set follow-up", variant: "destructive" }); } }
    );
  }, [leads, buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleBatchSetFollowUp = useCallback((date: string) => {
    let done = 0;
    let success = 0;
    const total = selectedIds.size;
    selectedIds.forEach((id) => {
      const lead = leads?.find((l: any) => l.id === id);
      if (!lead) { done++; return; }
      updateMutation.mutate(
        { id, data: buildLeadUpdate(lead, { nextFollowUpDate: date, nextStep: `Follow up ${date}` }) },
        {
          onSuccess: () => { success++; },
          onError: () => { toast({ title: `Failed to update ${lead.companyName}`, variant: "destructive" }); },
          onSettled: () => { done++; if (done >= total) { invalidate(); setBatchFollowUpOpen(false); if (success > 0) toast({ title: `Follow-up set for ${success} lead${success !== 1 ? "s" : ""}` }); } }
        }
      );
    });
    setSelectedIds(new Set());
  }, [selectedIds, leads, buildLeadUpdate, updateMutation, invalidate, toast]);

  const handleEditDraft = useCallback((lead: any) => {
    const draft = drafts[lead.id];
    setEditDraftLead(lead);
    setEditDraftSubject(draft?.subject || "");
    setEditDraftBody(draft?.body || "");
    setEditDraftOpen(true);
  }, [drafts]);

  const handleSaveEditDraft = useCallback(() => {
    if (editDraftLead) {
      saveDraft(editDraftLead.id, editDraftSubject, editDraftBody);
      setDraftsVersion((v) => v + 1);
      setEditDraftOpen(false);
      toast({ title: "Draft saved" });
    }
  }, [editDraftLead, editDraftSubject, editDraftBody, toast]);

  const handleBatchExport = useCallback(() => {
    if (!leads) return;
    const selected = leads.filter((l: any) => selectedIds.has(l.id));
    if (selected.length === 0) return;
    const headers = ["Company Name", "Contact Name", "Email", "Status", "Pipeline", "Deal Value", "Next Follow-Up", "Source"];
    const rows = selected.map((l: any) => [
      l.companyName, l.contactName, l.email || "", l.status, l.pipelineType,
      l.proposalValue || l.dealValueEstimate || "", l.nextFollowUpDate || "", l.source || ""
    ]);
    const csv = [headers.join(","), ...rows.map((r: any) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-export-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${selected.length} leads exported` });
  }, [leads, selectedIds, today, toast]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l: any) => l.id)));
    }
  };

  const views: { key: QueueView; label: string; color: string }[] = [
    { key: "new-imports", label: "New Imports", color: "bg-blue-100 text-blue-700" },
    { key: "due-today", label: "Due Today", color: "bg-amber-100 text-amber-700" },
    { key: "overdue", label: "Overdue", color: "bg-red-100 text-red-700" },
    { key: "awaiting-reply", label: "Awaiting Reply", color: "bg-violet-100 text-violet-700" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Outreach Queue</h1>
            <p className="text-muted-foreground text-sm mt-1">Daily outbound execution — fast and organized.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}</span>
            {skippedIds.size > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSkippedIds(new Set())}>
                Reset skipped ({skippedIds.size})
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => { setActiveView(v.key); setSelectedIds(new Set()); setSkippedIds(new Set()); }}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${activeView === v.key ? v.color + " shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
            >
              {v.label}
              <span className={`ml-1.5 text-xs ${activeView === v.key ? "opacity-80" : "opacity-60"}`}>
                {viewCounts[v.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className={`rounded-lg text-xs ${showFilters ? "border-primary text-primary" : ""}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3 w-3 mr-1.5" /> Filters {activeFilters > 0 && `(${activeFilters})`}
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setShowSort(!showSort)}>
                <ArrowUpDown className="h-3 w-3 mr-1.5" /> Sort
              </Button>
              {showSort && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-30 py-1 min-w-[180px]">
                  {[
                    { key: "newest", label: "Newest imported" },
                    { key: "oldest-followup", label: "Oldest follow-up" },
                    { key: "highest-value", label: "Highest deal value" },
                    { key: "pipeline", label: "Pipeline type" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${sortBy === s.key ? "font-semibold text-primary" : ""}`}
                      onClick={() => { setSortBy(s.key); setShowSort(false); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={handleBatchGenerateDrafts}>
                <Sparkles className="h-3 w-3" /> Generate Drafts
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={handleBatchMarkContacted}>
                <UserCheck className="h-3 w-3" /> Mark Contacted
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => setBatchFollowUpOpen(true)}>
                <Calendar className="h-3 w-3" /> Set Follow-Up
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={handleBatchExport}>
                <Copy className="h-3 w-3" /> Export
              </Button>
              <span className="text-xs text-muted-foreground self-center">{selectedIds.size} selected</span>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-xl">
            <select value={filterPipeline} onChange={(e) => setFilterPipeline(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background">
              <option value="">All Pipelines</option>
              <option value="Event">Event</option>
              <option value="Agency">Agency</option>
            </select>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background">
              <option value="">All Sources</option>
              {uniqueSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background">
              <option value="">All Statuses</option>
              {["New Lead", "Contacted", "Replied", "Qualified", "Meeting Booked", "Proposal Sent", "Negotiation", "Nurture"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter by location..."
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background w-36"
            />
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setFilterPipeline(""); setFilterSource(""); setFilterLocation(""); setFilterStatus(""); }}>
                Clear
              </Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading queue...</div>
        ) : filteredLeads.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center bg-card rounded-2xl">
            <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Queue is clear</h3>
            <p className="text-sm text-muted-foreground">No leads in this view. Great work!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                {selectedIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <span className="text-xs text-muted-foreground">Select all</span>
            </div>

            {filteredLeads.map((lead: any) => {
              const draft = drafts[lead.id];
              const hasDraft = !!draft;
              const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < today && lead.status !== "Closed Won" && lead.status !== "Closed Lost";
              const isDueToday = lead.nextFollowUpDate === today;
              const isZoomInfo = lead.source === "ZoomInfo";
              const isSelected = selectedIds.has(lead.id);
              const dealValue = Number(lead.proposalValue || lead.dealValueEstimate || 0);

              return (
                <Card
                  key={lead.id}
                  className={`rounded-2xl overflow-hidden transition-all ${
                    isOverdue ? "border-red-300 bg-red-50/30" :
                    isDueToday ? "border-amber-300 bg-amber-50/30" :
                    isSelected ? "border-primary/50 bg-primary/5" :
                    "bg-card border-border/50"
                  }`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleSelect(lead.id)} className="mt-1 flex-shrink-0">
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base">{lead.companyName}</h3>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lead.pipelineType === "Event" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground"}`}>
                              {lead.pipelineType}
                            </span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
                              </span>
                            )}
                            {isDueToday && !isOverdue && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">DUE TODAY</span>
                            )}
                            {isZoomInfo && lead.status === "New Lead" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">ZOOMINFO</span>
                            )}
                          </div>
                          {dealValue > 0 && (
                            <span className="text-sm font-semibold text-foreground">${dealValue.toLocaleString()}</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground text-xs">Contact</span>
                            <p className="font-medium truncate">{lead.contactName}</p>
                          </div>
                          {lead.title && (
                            <div>
                              <span className="text-muted-foreground text-xs">Title</span>
                              <p className="truncate">{lead.title}</p>
                            </div>
                          )}
                          {lead.email && (
                            <div>
                              <span className="text-muted-foreground text-xs">Email</span>
                              <p className="truncate text-primary">{lead.email}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground text-xs">Status</span>
                            <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>{lead.status}</p>
                          </div>
                          {lead.nextStep && (
                            <div>
                              <span className="text-muted-foreground text-xs">Next Step</span>
                              <p className="truncate">{lead.nextStep}</p>
                            </div>
                          )}
                          {lead.nextFollowUpDate && (
                            <div>
                              <span className="text-muted-foreground text-xs">Follow-Up</span>
                              <p className={`${isOverdue ? "text-red-600 font-semibold" : isDueToday ? "text-amber-600 font-semibold" : ""}`}>
                                {format(new Date(lead.nextFollowUpDate + "T12:00:00"), "MMM d, yyyy")}
                              </p>
                            </div>
                          )}
                          {lead.source && (
                            <div>
                              <span className="text-muted-foreground text-xs">Source</span>
                              <p className="truncate">{lead.source}</p>
                            </div>
                          )}
                        </div>

                        {hasDraft && (
                          <div className="bg-muted/40 rounded-xl p-3 mb-3 border border-border/30">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Draft Preview</span>
                              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => handleEditDraft(lead)}>
                                <Edit2 className="h-2.5 w-2.5 mr-1" /> Edit
                              </Button>
                            </div>
                            {draft.subject && <p className="text-xs font-medium mb-0.5">Subj: {draft.subject}</p>}
                            <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{draft.body}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {!hasDraft ? (
                            <Button size="sm" className="rounded-lg text-xs gap-1 bg-primary text-white" onClick={() => handleGenerateDraft(lead)}>
                              <Sparkles className="h-3 w-3" /> Generate Draft
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => handleOpenSend(lead)}>
                                <Mail className="h-3 w-3" /> Send via Outlook
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => handleCopyDraft(lead.id)}>
                                <Copy className="h-3 w-3" /> Copy
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => handleMarkAsContacted(lead)}>
                            <UserCheck className="h-3 w-3" /> Contacted
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => { setFollowUpLeadId(lead.id); setFollowUpOpen(true); }}>
                            <Clock className="h-3 w-3" /> Follow-Up
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => handleSnooze(lead)}>
                            <Clock className="h-3 w-3" /> Snooze
                          </Button>
                          <Button size="sm" variant="ghost" className="rounded-lg text-xs gap-1" onClick={() => handleSkip(lead)}>
                            <SkipForward className="h-3 w-3" /> Skip
                          </Button>
                          <Link href="/leads" className="inline-flex">
                            <Button size="sm" variant="ghost" className="rounded-lg text-xs gap-1">
                              <ExternalLink className="h-3 w-3" /> Open Lead
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-12 px-4">
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
              <div>
                <label className="text-sm font-medium block mb-1.5">Subject</label>
                <input type="text" value={sendSubject} onChange={(e) => setSendSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Body</label>
                <textarea value={sendBody} onChange={(e) => setSendBody(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[180px] resize-y whitespace-pre-wrap" />
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setSendModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSendViaOutlook} className="bg-primary text-white rounded-xl gap-2">
                <Mail className="h-4 w-4" /> Send via Outlook
              </Button>
            </div>
          </div>
        </div>
      )}

      {editDraftOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditDraftOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border z-10">
            <div className="px-5 sm:px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Edit Draft — {editDraftLead?.companyName}</h2>
              <Button variant="ghost" size="icon" onClick={() => setEditDraftOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Subject</label>
                <input type="text" value={editDraftSubject} onChange={(e) => setEditDraftSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Body</label>
                <textarea value={editDraftBody} onChange={(e) => setEditDraftBody(e.target.value)}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[200px] resize-y whitespace-pre-wrap" />
              </div>
            </div>
            <div className="px-5 sm:px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditDraftOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSaveEditDraft} className="bg-primary text-white rounded-xl">Save Draft</Button>
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
                <p className="text-sm text-muted-foreground mt-1">To <span className="font-medium text-foreground">{confirmLeadName}</span></p>
              </div>
              <p className="text-xs text-muted-foreground">If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days.</p>
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

      {followUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFollowUpOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-xs border border-border z-10">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-base font-bold">Set Follow-Up</h2>
              <Button variant="ghost" size="icon" onClick={() => setFollowUpOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => followUpLeadId && handleSetFollowUp(followUpLeadId, addBusinessDays(1), "tomorrow")}>
                Tomorrow
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => followUpLeadId && handleSetFollowUp(followUpLeadId, addBusinessDays(2), "in 2 days")}>
                In 2 business days
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => followUpLeadId && handleSetFollowUp(followUpLeadId, nextMonday(), "next week")}>
                Next week (Monday)
              </Button>
              <div className="border-t border-border pt-2 mt-2">
                <label className="text-xs font-medium block mb-1.5">Custom date</label>
                <div className="flex gap-2">
                  <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm bg-background" />
                  <Button size="sm" className="rounded-lg" disabled={!customDate}
                    onClick={() => followUpLeadId && customDate && handleSetFollowUp(followUpLeadId, customDate, customDate)}>
                    Set
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchFollowUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBatchFollowUpOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-xs border border-border z-10">
            <div className="px-5 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-base font-bold">Set Follow-Up ({selectedIds.size})</h2>
              <Button variant="ghost" size="icon" onClick={() => setBatchFollowUpOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => handleBatchSetFollowUp(addBusinessDays(1))}>
                Tomorrow
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => handleBatchSetFollowUp(addBusinessDays(2))}>
                In 2 business days
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg text-sm" onClick={() => handleBatchSetFollowUp(nextMonday())}>
                Next week (Monday)
              </Button>
              <div className="border-t border-border pt-2 mt-2">
                <label className="text-xs font-medium block mb-1.5">Custom date</label>
                <div className="flex gap-2">
                  <input type="date" value={batchCustomDate} onChange={(e) => setBatchCustomDate(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-border rounded-lg text-sm bg-background" />
                  <Button size="sm" className="rounded-lg" disabled={!batchCustomDate}
                    onClick={() => batchCustomDate && handleBatchSetFollowUp(batchCustomDate)}>
                    Set
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
