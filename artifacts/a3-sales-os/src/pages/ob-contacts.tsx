import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { SendViaOutlook } from "@/components/send-via-outlook";
import {
  useGetContacts,
  useDeleteContact,
  usePauseContact,
  useResumeContact,
  useMarkContactReplied,
  useMarkContactDnc,
  useMarkContactUnsubscribed,
  useSkipContactStep,
  useForceSendStep,
  useGetContactSteps,
  useGetContactEvents,
  useGeneratePersonalization,
  useUpdateContactCustomLine,
  useBulkGeneratePersonalization,
  useBulkClearPersonalization,
  useGetAssets,
  getGetContactsQueryKey,
  getGetOutboundAnalyticsQueryKey,
  getGetAssetsQueryKey,
  getGetScheduledEmailsQueryKey,
  getGetSequenceQueueQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Pause,
  Play,
  SkipForward,
  Send,
  MessageCircle,
  Ban,
  Trash2,
  X,
  Flame,
  Thermometer,
  Snowflake,
  MailX,
  Eye,
  MousePointerClick,
  Sparkles,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  Pencil,
  Check,
  Tag,
  Upload,
  Plus,
  Paperclip,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { deriveLifecycleStatus, LIFECYCLE_COLORS } from "@/lib/lifecycle";
import { assignSegment, bulkImportContacts, bulkSendContacts } from "@/lib/segments-api";
import { uploadCampaignFile, storageObjectUrl } from "@/lib/campaign-api";

const REFERRAL_STATUSES = ["Prospect", "Active", "Inactive", "Declined"];

const emptyContact = {
  fullName: "", firstName: "", lastName: "", company: "", title: "", email: "", phone: "",
  location: "", industry: "", intentSignal: "", notes: "",
  event: "", companyWebsite: "", segmentId: undefined as number | undefined,
  referral: false, referredBy: "", referralNotes: "", referralPartnerStatus: "",
};

function parseContactsCsv(text: string): any[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines
    .slice(1)
    .map((line) => {
      const cells = line.split(",");
      const obj: any = {};
      headers.forEach((h, i) => {
        const v = (cells[i] || "").trim();
        if (!v) return;
        if (h === "segmentId") obj[h] = Number(v);
        else if (h === "referral") obj[h] = ["true", "1", "yes"].includes(v.toLowerCase());
        else obj[h] = v;
      });
      return obj;
    })
    .filter((o) => o.email);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  active: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  paused_manual: "bg-amber-100 text-amber-700",
  paused_replied: "bg-green-100 text-green-700",
  completed: "bg-emerald-100 text-emerald-700",
  do_not_contact: "bg-red-100 text-red-700",
  dnc: "bg-red-100 text-red-700",
};

const TIER_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  hot: { icon: Flame, color: "text-red-600", bg: "bg-red-50" },
  warm: { icon: Thermometer, color: "text-amber-600", bg: "bg-amber-50" },
  cold: { icon: Snowflake, color: "text-blue-400", bg: "bg-blue-50" },
};

const CL_STATUS_COLORS: Record<string, string> = {
  not_generated: "bg-gray-100 text-gray-600",
  generated_safe: "bg-violet-100 text-violet-700",
  generated_enhanced: "bg-purple-100 text-purple-700",
  manual: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
};

export default function ObContacts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [clFilter, setClFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({ ...emptyContact });
  const [savingContact, setSavingContact] = useState(false);
  const [assignContact, setAssignContact] = useState<any>(null);
  const [assigning, setAssigning] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [reps, setReps] = useState<{ id: number; email: string; replyToEmail: string | null }[]>([]);
  const [assignRepId, setAssignRepId] = useState<string>("");
  const [assigningRep, setAssigningRep] = useState(false);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "api/members", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const { data: contacts, isLoading } = useGetContacts({
    search: search || undefined,
    sequenceStatus: statusFilter || undefined,
    campaignName: campaignFilter || undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMut = useDeleteContact();
  const pauseMut = usePauseContact();
  const resumeMut = useResumeContact();
  const repliedMut = useMarkContactReplied();
  const dncMut = useMarkContactDnc();
  const unsubMut = useMarkContactUnsubscribed();
  const skipMut = useSkipContactStep();
  const forceMut = useForceSendStep();
  const bulkGenMut = useBulkGeneratePersonalization();
  const bulkClearMut = useBulkClearPersonalization();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm({ ...emptyContact });
    setShowContactModal(true);
  };

  const openEditContact = (c: any) => {
    setEditingContact(c);
    setContactForm({
      fullName: c.fullName || "", firstName: c.firstName || "", lastName: c.lastName || "",
      company: c.company || "", title: c.title || "", email: c.email || "", phone: c.phone || "",
      location: c.location || "", industry: c.industry || "", intentSignal: c.intentSignal || "", notes: c.notes || "",
      event: c.event || "", companyWebsite: c.companyWebsite || "", segmentId: c.segmentId ?? undefined,
      referral: !!c.referral, referredBy: c.referredBy || "", referralNotes: c.referralNotes || "",
      referralPartnerStatus: c.referralPartnerStatus || "",
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.fullName || !contactForm.company || !contactForm.email) {
      toast({ title: "Full name, company, and email are required", variant: "destructive" });
      return;
    }
    setSavingContact(true);
    try {
      const base = import.meta.env.BASE_URL + "api";
      const url = editingContact ? `${base}/contacts/${editingContact.id}` : `${base}/contacts`;
      const res = await fetch(url, {
        method: editingContact ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Save failed");
      invalidate();
      toast({ title: editingContact ? "Contact updated" : "Contact created" });
      setShowContactModal(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingContact(false);
    }
  };

  const handleAssignSegment = async (subject: string, body: string, scheduledFor?: string) => {
    if (!assignContact) return;
    setAssigning(true);
    try {
      const res = await assignSegment({ contactIds: [assignContact.id], subject, body, scheduledFor: scheduledFor || undefined });
      invalidate();
      queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
      toast({ title: "Assigned to segment", description: `${res.emailsCreated ?? 0} email(s) scheduled, ${res.skipped ?? 0} skipped` });
      setAssignContact(null);
    } catch (err: any) {
      toast({ title: "Assign failed", description: err.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleAction = (mutFn: any, id: number, label: string) => {
    mutFn.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: label }); },
      onError: () => toast({ title: `Failed: ${label}`, variant: "destructive" }),
    });
  };

  const uniqueCampaigns = [...new Set((contacts || []).map((c: any) => c.campaignName).filter(Boolean))] as string[];
  const uniqueSegments = [...new Set((contacts || []).map((c: any) => c.segmentType).filter(Boolean))] as string[];

  const filtered = (contacts || []).filter((c: any) => {
    if (segmentFilter && c.segmentType !== segmentFilter) return false;
    if (tierFilter && c.engagementTier !== tierFilter) return false;
    if (clFilter === "missing" && c.customLineStatus && c.customLineStatus !== "not_generated") return false;
    if (clFilter === "has" && (!c.customLineStatus || c.customLineStatus === "not_generated")) return false;
    if (clFilter === "locked" && !c.customLineLocked) return false;
    return true;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const handleBulkGenerate = (mode: "safe" | "enhanced") => {
    const ids = Array.from(selectedIds);
    bulkGenMut.mutate({ data: { contactIds: ids, mode } }, {
      onSuccess: (data: any) => {
        invalidate();
        toast({ title: `Generated: ${data.generated}, Failed: ${data.failed}, Skipped: ${data.skipped}` });
        setSelectedIds(new Set());
      },
      onError: () => toast({ title: "Bulk generation failed", variant: "destructive" }),
    });
  };

  const handleBulkClear = () => {
    const ids = Array.from(selectedIds);
    bulkClearMut.mutate({ data: { contactIds: ids } }, {
      onSuccess: (data: any) => {
        invalidate();
        toast({ title: `Cleared ${data.cleared} custom lines` });
        setSelectedIds(new Set());
      },
      onError: () => toast({ title: "Bulk clear failed", variant: "destructive" }),
    });
  };

  const handleBulkAssignRep = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !assignRepId) return;
    const memberId = assignRepId === "none" ? null : Number(assignRepId);
    setAssigningRep(true);
    try {
      const base = import.meta.env.BASE_URL + "api";
      let ok = 0;
      for (const id of ids) {
        const res = await fetch(`${base}/contacts/${id}/assign-rep`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ memberId }),
        });
        if (res.ok) ok++;
      }
      invalidate();
      toast({ title: "Reps assigned", description: `${ok}/${ids.length} contact(s) updated` });
      setSelectedIds(new Set());
      setAssignRepId("");
    } catch (err: any) {
      toast({ title: "Assign failed", description: err.message, variant: "destructive" });
    } finally {
      setAssigningRep(false);
    }
  };

  const handleBulkRestart = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Restart the template sequence for ${ids.length} contact(s)? Their follow-up sequence will be re-armed and rescheduled from today. Past send history is kept.`)) return;
    setRestarting(true);
    try {
      const base = import.meta.env.BASE_URL + "api";
      const res = await fetch(`${base}/contacts/restart-sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Restart failed");
      invalidate();
      queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
      toast({ title: "Sequences restarted", description: `${data.restarted ?? 0} contact(s) re-armed, ${data.totalSteps ?? 0} steps scheduled` });
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Restart failed", description: err.message, variant: "destructive" });
    } finally {
      setRestarting(false);
    }
  };

  const handleBulkSend = async (subject: string, body: string, scheduledFor?: string, templateId?: number) => {
    const ids = Array.from(selectedIds);
    setBulkSending(true);
    try {
      const res = await bulkSendContacts({
        contactIds: ids,
        subject,
        body,
        scheduledFor: scheduledFor || undefined,
        templateId: templateId ?? undefined,
        source: "bulk_send",
      });
      invalidate();
      queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
      toast({
        title: scheduledFor ? "Emails scheduled" : "Emails queued to send",
        description: `${res.emailsCreated ?? 0} email(s) queued, ${res.skipped ?? 0} skipped (already active or unsubscribed)`,
      });
      setShowBulkSend(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground mt-1">Manage outbound contacts, engagement scoring, and AI personalization.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkImport(true)} className="rounded-xl gap-1.5">
              <Users className="h-4 w-4" /> Bulk Import
            </Button>
            <Button onClick={openNewContact} className="rounded-xl gap-1.5 bg-primary text-white">
              <Plus className="h-4 w-4" /> Add Contact
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl text-sm bg-background" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="paused_replied">Replied</option>
            <option value="completed">Completed</option>
            <option value="do_not_contact">Do Not Contact</option>
          </select>
          <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background">
            <option value="">All Campaigns</option>
            {uniqueCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background">
            <option value="">All Segments</option>
            {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background">
            <option value="">All Tiers</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
          <select value={clFilter} onChange={(e) => setClFilter(e.target.value)}
            className="px-3 py-2 border border-violet-200 rounded-xl text-sm bg-background">
            <option value="">All Personalization</option>
            <option value="missing">Missing Custom Line</option>
            <option value="has">Has Custom Line</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <Card className="p-3 border-violet-200 bg-violet-50/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-violet-800">{selectedIds.size} contacts selected</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowBulkSend(true)}
                  className="rounded-xl gap-1.5 text-xs bg-primary text-white hover:bg-primary/90">
                  <Send className="h-3 w-3" /> Send Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkGenerate("safe")}
                  disabled={bulkGenMut.isPending} className="rounded-xl gap-1.5 text-xs border-violet-200">
                  {bulkGenMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate (Safe)
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkGenerate("enhanced")}
                  disabled={bulkGenMut.isPending} className="rounded-xl gap-1.5 text-xs border-purple-200">
                  {bulkGenMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate (Enhanced)
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkClear}
                  disabled={bulkClearMut.isPending} className="rounded-xl gap-1.5 text-xs border-red-200 text-red-600">
                  <X className="h-3 w-3" />
                  Clear Lines
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkRestart}
                  disabled={restarting} className="rounded-xl gap-1.5 text-xs border-emerald-300 text-emerald-700">
                  {restarting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Restart Sequence
                </Button>
                <select
                  value={assignRepId}
                  onChange={(e) => setAssignRepId(e.target.value)}
                  disabled={assigningRep}
                  className="h-8 rounded-xl border border-blue-200 bg-white px-2 text-xs"
                  title="Route replies for the selected contacts to this rep"
                >
                  <option value="">Assign rep…</option>
                  {reps.map((r) => (
                    <option key={r.id} value={String(r.id)}>{r.replyToEmail || r.email}</option>
                  ))}
                  <option value="none">Unassign</option>
                </select>
                <Button size="sm" variant="outline" onClick={handleBulkAssignRep}
                  disabled={assigningRep || !assignRepId} className="rounded-xl gap-1.5 text-xs border-blue-300 text-blue-700">
                  {assigningRep && <Loader2 className="h-3 w-3 animate-spin" />}
                  Assign rep
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="rounded-xl text-xs">
                  Deselect
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div className="text-sm text-muted-foreground">{filtered.length} contacts</div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Segment</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Custom Line</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Lifecycle</th>
                <th className="text-left px-4 py-3 font-medium">Step</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => {
                const tier = TIER_CONFIG[c.engagementTier] || TIER_CONFIG.cold;
                const TierIcon = tier.icon;
                const clStatus = c.customLineStatus || "not_generated";
                return (
                  <>
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)} className="rounded" />
                      </td>
                      <td className="px-4 py-3 font-medium">{c.fullName}</td>
                      <td className="px-4 py-3">{c.company}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{c.email}</td>
                      <td className="px-4 py-3">
                        {c.segmentType ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{c.segmentType}</span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TierIcon className={`h-3.5 w-3.5 ${tier.color}`} />
                          <span className={`text-xs font-bold ${tier.color}`}>{c.engagementScore || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          {c.customLine ? (
                            <>
                              <span className="text-xs text-muted-foreground truncate">{c.customLine.substring(0, 40)}...</span>
                              {c.customLineLocked && <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />}
                            </>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CL_STATUS_COLORS[clStatus]}`}>
                              {clStatus === "not_generated" ? "none" : clStatus.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.sequenceStatus] || "bg-gray-100"}`}>
                          {c.sequenceStatus?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs font-medium ${LIFECYCLE_COLORS[deriveLifecycleStatus(c)]}`}>
                          {deriveLifecycleStatus(c)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{c.currentStep || 0}/7</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {c.sequenceStatus === "active" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Pause"
                                onClick={() => handleAction(pauseMut, c.id, "Contact paused")}>
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Skip step"
                                onClick={() => handleAction(skipMut, c.id, "Step skipped")}>
                                <SkipForward className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Force send"
                                onClick={() => handleAction(forceMut, c.id, "Step sent")}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {(c.sequenceStatus === "paused" || c.sequenceStatus === "paused_manual" || c.sequenceStatus === "completed") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Resume"
                              onClick={() => handleAction(resumeMut, c.id, "Contact resumed")}>
                              <Play className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Mark replied"
                            onClick={() => handleAction(repliedMut, c.id, "Marked as replied")}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Unsubscribe"
                            onClick={() => handleAction(unsubMut, c.id, "Marked as unsubscribed")}>
                            <MailX className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Do not contact"
                            onClick={() => handleAction(dncMut, c.id, "Marked do not contact")}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                          <SendViaOutlook contact={c} variant="icon" onUpdated={invalidate} /><Button variant="ghost" size="icon" className="h-7 w-7 text-violet-600" title="Assign to segment"
                            onClick={() => setAssignContact(c)}>
                            <Tag className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit"
                            onClick={() => openEditContact(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete"
                            onClick={() => handleAction(deleteMut, c.id, "Contact deleted")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={11} className="px-4 py-4 bg-muted/10">
                          <ContactDetail contact={c} onUpdate={invalidate} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No contacts found.</div>
          )}
        </div>
      </div>

      {showContactModal && (
        <ContactFormModal
          form={contactForm}
          setForm={setContactForm}
          editing={!!editingContact}
          saving={savingContact}
          onClose={() => setShowContactModal(false)}
          onSave={handleSaveContact}
        />
      )}
      {assignContact && (
        <AssignSegmentModal
          recordName={assignContact.fullName}
          onClose={() => setAssignContact(null)}
          onAssign={handleAssignSegment}
          assigning={assigning}
        />
      )}
      {showBulkImport && (
        <BulkImportModal onClose={() => setShowBulkImport(false)} onDone={invalidate} />
      )}
      {showBulkSend && (
        <BulkSendModal
          count={selectedIds.size}
          onClose={() => setShowBulkSend(false)}
          onSend={handleBulkSend}
          sending={bulkSending}
        />
      )}
    </AppLayout>
  );
}

function ContactDetail({ contact, onUpdate }: { contact: any; onUpdate: () => void }) {
  const { data: steps } = useGetContactSteps(contact.id);
  const { data: events } = useGetContactEvents(contact.id);
  const [tab, setTab] = useState<"details" | "steps" | "events" | "personalization" | "routing">("details");
  const [editingCL, setEditingCL] = useState(false);
  const [clText, setClText] = useState(contact.customLine || "");

  const generateMut = useGeneratePersonalization();
  const updateCLMut = useUpdateContactCustomLine();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tier = TIER_CONFIG[contact.engagementTier] || TIER_CONFIG.cold;
  const TierIcon = tier.icon;

  const handleRegenerate = (mode: "safe" | "enhanced") => {
    generateMut.mutate({ id: contact.id, data: { mode, force: true } }, {
      onSuccess: (data: any) => {
        toast({ title: `Generated: ${data.source === "ai" ? "AI" : "Fallback"}` });
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        onUpdate();
      },
      onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleSaveCL = () => {
    updateCLMut.mutate({ id: contact.id, data: { customLine: clText } }, {
      onSuccess: () => {
        toast({ title: "Custom line saved" });
        setEditingCL(false);
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        onUpdate();
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  };

  const handleToggleLock = () => {
    updateCLMut.mutate({ id: contact.id, data: { locked: !contact.customLineLocked } }, {
      onSuccess: () => {
        toast({ title: contact.customLineLocked ? "Custom line unlocked" : "Custom line locked" });
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        onUpdate();
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 mb-2"><SendViaOutlook contact={contact} variant="button" onUpdated={() => { queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() }); onUpdate(); }} /></div><div className="flex gap-2 border-b border-border">
        {(["details", "personalization", "routing", "steps", "events"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "details" ? "Details" : t === "personalization" ? "Personalization" : t === "routing" ? "Routing" : t === "steps" ? "Sequence Steps" : "Engagement Timeline"}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Contact Info</h4>
            <div className="space-y-1 text-sm">
              {contact.firstName && <div><span className="text-muted-foreground">First:</span> {contact.firstName}</div>}
              {contact.lastName && <div><span className="text-muted-foreground">Last:</span> {contact.lastName}</div>}
              <div><span className="text-muted-foreground">Phone:</span> {contact.phone || "-"}</div>
              <div><span className="text-muted-foreground">Location:</span> {contact.location || "-"}</div>
              <div><span className="text-muted-foreground">Title:</span> {contact.title || "-"}</div>
              <div><span className="text-muted-foreground">Industry:</span> {contact.industry || "-"}</div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Outbound Info</h4>
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Segment:</span> {contact.segmentType || "-"}</div>
              <div><span className="text-muted-foreground">Campaign:</span> {contact.campaignName || "-"}</div>
              <div><span className="text-muted-foreground">Template Set:</span> {contact.assignedTemplateSet || "-"}</div>
              <div><span className="text-muted-foreground">Source:</span> {contact.sourceFileName || "-"}</div>
              {contact.intentSignal && <div><span className="text-muted-foreground">Intent:</span> {contact.intentSignal}</div>}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Engagement</h4>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className={`p-2 rounded-lg ${tier.bg}`}>
                <TierIcon className={`h-5 w-5 ${tier.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold">{contact.engagementScore || 0}</div>
                <div className={`text-xs font-semibold uppercase ${tier.color}`}>{contact.engagementTier || "cold"}</div>
              </div>
            </div>
            {contact.bounceStatus && (
              <div className="text-xs text-red-600 font-medium">Bounce: {contact.bounceStatus}</div>
            )}
            {contact.notes && <div className="text-sm"><span className="text-muted-foreground">Notes:</span> {contact.notes}</div>}
          </div>
        </div>
        {(contact.referral || contact.event || contact.companyWebsite) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-t border-border/40 pt-3">
            {contact.event && <div><span className="text-muted-foreground">Event:</span> {contact.event}</div>}
            {contact.companyWebsite && <div><span className="text-muted-foreground">Website:</span> {contact.companyWebsite}</div>}
            {contact.referral && (
              <div>
                <span className="text-muted-foreground">Referral:</span> {contact.referredBy || "Yes"}
                {contact.referralPartnerStatus ? ` (${contact.referralPartnerStatus})` : ""}
              </div>
            )}
          </div>
        )}
        <ContactUploads contactId={contact.id} />
        </div>
      )}

      {tab === "personalization" && (
        <div className="space-y-4">
          <Card className="p-4 border-violet-200 bg-violet-50/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h4 className="font-semibold text-sm text-violet-900">Custom Line</h4>
                {contact.customLineLocked && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> Locked
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CL_STATUS_COLORS[contact.customLineStatus || "not_generated"]}`}>
                  {(contact.customLineStatus || "not_generated").replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={handleToggleLock} className="h-7 px-2 text-xs gap-1">
                  {contact.customLineLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {contact.customLineLocked ? "Unlock" : "Lock"}
                </Button>
              </div>
            </div>

            {editingCL ? (
              <div className="space-y-2">
                <textarea value={clText} onChange={(e) => setClText(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-violet-200 rounded-xl text-sm bg-white resize-none"
                  placeholder="Enter custom first line..." />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingCL(false); setClText(contact.customLine || ""); }} className="rounded-xl text-xs">Cancel</Button>
                  <Button size="sm" onClick={handleSaveCL} disabled={updateCLMut.isPending} className="rounded-xl text-xs bg-violet-600 text-white">
                    <Check className="h-3 w-3 mr-1" /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {contact.customLine ? (
                  <p className="text-sm text-foreground bg-white p-3 rounded-lg border border-violet-100 italic">
                    "{contact.customLine}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No custom line generated yet.</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingCL(true)} className="rounded-xl text-xs gap-1 border-violet-200">
                    <Pencil className="h-3 w-3" /> Edit Manually
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRegenerate("safe")}
                    disabled={generateMut.isPending} className="rounded-xl text-xs gap-1 border-violet-200">
                    {generateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Regenerate (Safe)
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleRegenerate("enhanced")}
                    disabled={generateMut.isPending} className="rounded-xl text-xs gap-1 border-purple-200">
                    {generateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Regenerate (Enhanced)
                  </Button>
                </div>
              </div>
            )}

            {contact.customLineGeneratedAt && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Generated: {format(new Date(contact.customLineGeneratedAt), "MMM d, h:mm a")} via {contact.customLineSource || "unknown"}
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === "routing" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Routing State</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">State:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  contact.routingState === "hot_priority" ? "bg-red-50 text-red-600" :
                  contact.routingState === "warm_followup" ? "bg-amber-50 text-amber-600" :
                  contact.routingState === "awaiting_manual_outreach" ? "bg-blue-50 text-blue-600" :
                  contact.routingState === "qualified_opportunity" ? "bg-emerald-50 text-emerald-600" :
                  "bg-gray-50 text-gray-600"
                }`}>
                  {(contact.routingState || "standard_nurture").replace(/_/g, " ")}
                </span>
              </div>
              <div><span className="text-muted-foreground">Qualified:</span> <span className="capitalize">{contact.qualifiedStatus || "unreviewed"}</span></div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Locked:</span>
                {contact.routingLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-gray-400" />}
                <span>{contact.routingLocked ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Recommended Action</h4>
            {contact.recommendedNextAction ? (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="font-medium text-sm">{contact.recommendedNextAction.replace(/_/g, " ")}</div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No action recommended yet.</p>
            )}
            {contact.manualPriority && (
              <div className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                <Flame className="h-3 w-3" /> Manually flagged as priority
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Quick Actions</h4>
            <p className="text-xs text-muted-foreground">Use the Routing page for full admin controls, routing history, and bulk updates.</p>
          </div>
        </div>
      )}

      {tab === "steps" && (
        <div className="space-y-1.5">
          {steps && steps.length > 0 ? steps.map((s: any) => (
            <div key={s.id} className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg ${s.status === "sent" ? "bg-green-50" : s.status === "scheduled" ? "bg-blue-50" : s.status === "skipped" ? "bg-gray-50" : "bg-red-50"}`}>
              <span className="font-medium">Step {s.stepNumber} (Day +{s.delayDays})</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.status === "sent" ? "bg-green-200 text-green-800" : s.status === "scheduled" ? "bg-blue-200 text-blue-800" : "bg-gray-200 text-gray-700"}`}>
                {s.status}
              </span>
              {s.scheduledFor && <span className="text-muted-foreground">{format(new Date(s.scheduledFor), "MMM d, h:mm a")}</span>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No sequence steps yet.</p>}
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-2">
          {events && events.length > 0 ? events.map((ev: any) => (
            <div key={ev.id} className="flex items-center gap-3 text-sm px-3 py-2 border-b border-border/30">
              <div className={`p-1.5 rounded-lg ${ev.eventType === "open" ? "bg-blue-50" : ev.eventType === "click" ? "bg-green-50" : ev.eventType === "reply" ? "bg-emerald-50" : ev.eventType === "bounce" ? "bg-red-50" : "bg-gray-50"}`}>
                {ev.eventType === "open" && <Eye className="h-3.5 w-3.5 text-blue-600" />}
                {ev.eventType === "click" && <MousePointerClick className="h-3.5 w-3.5 text-green-600" />}
                {ev.eventType === "reply" && <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />}
                {ev.eventType === "bounce" && <MailX className="h-3.5 w-3.5 text-red-600" />}
              </div>
              <div className="flex-1">
                <span className="font-medium capitalize">{ev.eventType}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {ev.timestamp ? format(new Date(ev.timestamp), "MMM d, h:mm a") : "-"}
              </span>
            </div>
          )) : <p className="text-sm text-muted-foreground">No engagement events yet.</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: any) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
        <option value="">—</option>
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ContactFormModal({ form, setForm, editing, saving, onClose, onSave }: any) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl border border-border z-10 my-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card rounded-t-2xl">
          <h2 className="text-lg font-bold">{editing ? "Edit Contact" : "Add Contact"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full Name *" value={form.fullName} onChange={(v: string) => setForm({ ...form, fullName: v })} />
          <Field label="Company *" value={form.company} onChange={(v: string) => setForm({ ...form, company: v })} />
          <Field label="Email *" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v: string) => setForm({ ...form, phone: v })} />
          <Field label="First Name" value={form.firstName} onChange={(v: string) => setForm({ ...form, firstName: v })} />
          <Field label="Last Name" value={form.lastName} onChange={(v: string) => setForm({ ...form, lastName: v })} />
          <Field label="Title" value={form.title} onChange={(v: string) => setForm({ ...form, title: v })} />
          <Field label="Industry" value={form.industry} onChange={(v: string) => setForm({ ...form, industry: v })} />
          <Field label="Location" value={form.location} onChange={(v: string) => setForm({ ...form, location: v })} />
          <Field label="Intent Signal" value={form.intentSignal} onChange={(v: string) => setForm({ ...form, intentSignal: v })} />
          <Field label="Event" value={form.event} onChange={(v: string) => setForm({ ...form, event: v })} />
          <Field label="Company Website" value={form.companyWebsite} onChange={(v: string) => setForm({ ...form, companyWebsite: v })} />
          <Field label="Segment ID" type="number" value={form.segmentId != null ? String(form.segmentId) : ""}
            onChange={(v: string) => setForm({ ...form, segmentId: v ? Number(v) : undefined })} />
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-foreground block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full p-2.5 border border-border rounded-xl text-sm bg-background outline-none min-h-[60px] resize-y" />
          </div>
          <div className="sm:col-span-2 border border-border/60 rounded-xl p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={!!form.referral} onChange={(e) => setForm({ ...form, referral: e.target.checked })}
                className="h-4 w-4 rounded border-border text-primary cursor-pointer" />
              Referral
            </label>
            {form.referral && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Referred By" value={form.referredBy} onChange={(v: string) => setForm({ ...form, referredBy: v })} />
                <SelectField label="Referral Partner Status" value={form.referralPartnerStatus} options={REFERRAL_STATUSES}
                  onChange={(v: string) => setForm({ ...form, referralPartnerStatus: v })} />
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground block mb-1.5">Referral Notes</label>
                  <textarea value={form.referralNotes || ""} onChange={(e) => setForm({ ...form, referralNotes: e.target.value })}
                    className="w-full p-2.5 border border-border rounded-xl text-sm bg-background outline-none min-h-[50px] resize-y" />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="rounded-xl bg-primary text-white hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} {editing ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AssignSegmentModal({ recordName, onClose, onAssign, assigning }: any) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const canSubmit = subject.trim() && body.trim();
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Tag className="h-4 w-4" /> Assign to Segment</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Stamp lifecycle and schedule an email for <span className="font-medium text-foreground">{recordName}</span>.</p>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[120px] resize-y" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Schedule For (optional)</label>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={() => onAssign(subject, body, scheduledFor ? new Date(scheduledFor).toISOString() : undefined)}
            disabled={!canSubmit || assigning} className="rounded-xl bg-primary text-white hover:bg-primary/90">
            {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Tag className="h-4 w-4 mr-1" />} Assign
          </Button>
        </div>
      </div>
    </div>
  );
}

function BulkImportModal({ onClose, onDone }: any) {
  const [text, setText] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();
  const parsed = parseContactsCsv(text);
  const handleImport = async () => {
    if (parsed.length === 0) { toast({ title: "No valid rows (need a header row and an email column)", variant: "destructive" }); return; }
    setImporting(true);
    try {
      const res = await bulkImportContacts(parsed, dedupe);
      toast({ title: "Bulk import complete", description: `${res.created ?? 0} created, ${res.skipped ?? 0} skipped` });
      onDone();
      onClose();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border z-10">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="h-4 w-4" /> Bulk Import Contacts</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Paste CSV with a header row. Recognized columns: fullName, firstName, lastName, company, email, phone, title, industry, location, event, companyWebsite, segmentId, referral.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"fullName,company,email\nJane Doe,Acme,jane@acme.com"}
            className="w-full p-3 border border-border rounded-xl text-xs font-mono bg-background outline-none min-h-[160px] resize-y" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="h-4 w-4 rounded" />
              Skip duplicates by email
            </label>
            <span className="text-xs text-muted-foreground">{parsed.length} valid row(s)</span>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleImport} disabled={importing || parsed.length === 0} className="rounded-xl bg-primary text-white hover:bg-primary/90">
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />} Import
          </Button>
        </div>
      </div>
    </div>
  );
}

function BulkSendModal({ count, onClose, onSend, sending }: any) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingT, setLoadingT] = useState(true);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(import.meta.env.BASE_URL + "api/templates?isActive=true");
        if (res.ok) setTemplates(await res.json());
      } catch {
        /* templates are optional; user can still type subject/body */
      } finally {
        setLoadingT(false);
      }
    })();
  }, []);

  const pickTemplate = (idStr: string) => {
    if (!idStr) { setTemplateId(""); return; }
    const id = Number(idStr);
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      if (t.subject) setSubject(t.subject);
      if (t.body) setBody(t.body);
    }
  };

  const canSubmit = count > 0 && subject.trim() && body.trim() && !sending;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-12 px-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border z-10 my-8">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card rounded-t-2xl">
          <h2 className="text-lg font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send Email</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Sending to <span className="font-medium text-foreground">{count} selected contact{count === 1 ? "" : "s"}</span>.
            Contacts already in an active sequence or unsubscribed are skipped automatically.
          </p>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Template</label>
            <select value={templateId === "" ? "" : String(templateId)} onChange={(e) => pickTemplate(e.target.value)}
              disabled={loadingT}
              className="w-full p-2.5 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
              <option value="">{loadingT ? "Loading templates..." : "— No template (write your own) —"}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ""}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Picking a template fills the subject &amp; body below — you can still edit them. Tokens like <code>{"{{firstName}}"}</code> and <code>{"{{company}}"}</code> are personalized per contact.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[140px] resize-y" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Schedule For (optional — leave empty to send now)</label>
            <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-card rounded-b-2xl">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button
            onClick={() => onSend(subject, body, scheduledFor ? new Date(scheduledFor).toISOString() : undefined, templateId === "" ? undefined : templateId)}
            disabled={!canSubmit} className="rounded-xl bg-primary text-white hover:bg-primary/90">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {scheduledFor ? "Schedule" : "Send Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactUploads({ contactId }: { contactId: number }) {
  const { data: assets } = useGetAssets();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const linked = ((assets as any[]) || []).filter((a) => a.linkedContactId === contactId);
  const handleUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadCampaignFile(file);
      const res = await fetch(`${import.meta.env.BASE_URL}api/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: up.name, category: "Upload", url: storageObjectUrl(up.objectPath),
          contentType: up.contentType, objectPath: up.objectPath, linkedContactId: contactId,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getGetAssetsQueryKey() });
      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="border border-border/60 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Uploads</h4>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-border hover:bg-muted">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
          </span>
        </label>
      </div>
      {linked.length > 0 ? (
        <div className="space-y-1">
          {linked.map((a: any) => (
            <a key={a.id} href={a.url || storageObjectUrl(a.objectPath)} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline">
              <Paperclip className="h-3 w-3" /> {a.title}
            </a>
          ))}
        </div>
      ) : <p className="text-xs text-muted-foreground">No files uploaded.</p>}
    </div>
  );
}
