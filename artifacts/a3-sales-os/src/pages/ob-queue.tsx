import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetSequenceQueue, useProcessSequenceQueue,
  getGetSequenceQueueQueryKey, getGetOutboundAnalyticsQueryKey, getGetContactsQueryKey,
  useGetScheduledEmails, useUpdateScheduledEmail, useDeleteScheduledEmail,
  getGetScheduledEmailsQueryKey,
  useGetContacts, useGetLeads,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Search, Trash2, X, Eye, Calendar, XCircle, Mail, User, Building2, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { deriveLifecycleStatus, LIFECYCLE_COLORS, type LifecycleInput } from "@/lib/lifecycle";

// Terminal/transport statuses that the lifecycle model does not represent. These
// keep their own colors so the unified queue can still show canceled/skipped/
// errored rows clearly alongside lifecycle-derived badges.
const TERMINAL_COLORS: Record<string, string> = {
  canceled: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  skipped: "bg-slate-100 text-slate-600 border-slate-200",
  error: "bg-red-100 text-red-700 border-red-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

// Map a queue row (scheduled email OR sequence step) onto ONE unified status
// badge. Lifecycle-relevant states go through deriveLifecycleStatus so leads and
// contacts read identically; transport-only states fall back to TERMINAL_COLORS.
function rowBadge(item: any): { label: string; className: string } {
  const raw = String(item.status || "").toLowerCase();
  if (TERMINAL_COLORS[raw]) return { label: raw, className: `${TERMINAL_COLORS[raw]} border` };
  const input: LifecycleInput = {};
  if (raw === "sent") input.sentCount = 1;
  else if (raw === "queued") input.queuedCount = 1;
  else if (raw === "scheduled" || raw === "active" || raw === "pending") input.scheduledCount = 1;
  else if (raw === "paused") input.status = "paused";
  else if (raw === "completed") input.sentCount = 1;
  else input.status = item.status;
  const ls = deriveLifecycleStatus(input);
  return { label: ls, className: `${LIFECYCLE_COLORS[ls]} border` };
}

export default function ObQueue() {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [previewEmail, setPreviewEmail] = useState<any>(null);
  const { data: queue, isLoading: queueLoading } = useGetSequenceQueue({});
  const { data: scheduledEmails, isLoading: seLoading } = useGetScheduledEmails();
  const { data: contacts } = useGetContacts();
  const { data: leads } = useGetLeads();
  const processMut = useProcessSequenceQueue();
  const updateSEMut = useUpdateScheduledEmail();
  const deleteSEMut = useDeleteScheduledEmail();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const contactMap = useMemo(() => {
    const m: Record<number, any> = {};
    (contacts || []).forEach((c: any) => { m[c.id] = c; });
    return m;
  }, [contacts]);

  const leadMap = useMemo(() => {
    const m: Record<number, any> = {};
    (leads || []).forEach((l: any) => { m[l.id] = l; });
    return m;
  }, [leads]);

  const allItems = useMemo(() => {
    const items: any[] = [];
    (scheduledEmails || []).forEach((e: any) => {
      const lead = e.leadId != null ? leadMap[e.leadId] : null;
      const contact = e.contactId != null ? contactMap[e.contactId] : null;
      const badge = rowBadge(e);
      items.push({
        ...e,
        _source: "scheduled",
        _sourceLabel: e.source || "manual",
        _sendVia: e.sendVia || "auto",
        _recipient: e.leadName || lead?.contactName || contact?.fullName || "Unknown",
        _email: lead?.email || contact?.email || "",
        _company: e.companyName || lead?.companyName || contact?.company || "",
        _step: e.sequenceStepNumber ? `Step ${e.sequenceStepNumber}` : "-",
        _statusLabel: badge.label,
        _statusClass: badge.className,
      });
    });
    (queue || []).filter((q: any) => {
      return !(scheduledEmails || []).some((se: any) => se.id === q.id);
    }).forEach((q: any) => {
      const contact = q.contactId != null ? contactMap[q.contactId] : null;
      const badge = rowBadge(q);
      items.push({
        ...q,
        subject: q.subject || q.subjectRendered || "",
        _source: "queue",
        _sourceLabel: "sequence",
        _sendVia: "sequence",
        _recipient: q.contactName || contact?.fullName || "Unknown",
        _email: q.contactEmail || contact?.email || "",
        _company: q.company || contact?.company || "",
        _step: q.stepNumber ? `Step ${q.stepNumber}` : "-",
        _statusLabel: badge.label,
        _statusClass: badge.className,
      });
    });
    return items;
  }, [queue, scheduledEmails, contactMap, leadMap]);

  const statusOptions = useMemo(() => {
    const seen = new Set<string>();
    allItems.forEach((i) => seen.add(i._statusLabel));
    return Array.from(seen).sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = allItems;
    if (filter) list = list.filter(i => i._statusLabel === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i._recipient || "").toLowerCase().includes(q) ||
        (i._email || "").toLowerCase().includes(q) ||
        (i._company || "").toLowerCase().includes(q) ||
        (i.subject || "").toLowerCase().includes(q));
    }
    return list.sort((a, b) => {
      const aDate = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
      const bDate = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
      return aDate - bDate;
    });
  }, [allItems, filter, search]);

  const handleProcess = () => {
    processMut.mutate(undefined, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        toast({ title: data.message || "Processing complete" });
      },
      onError: () => toast({ title: "Processing failed", variant: "destructive" }),
    });
  };

  const handleCancel = (id: number) => {
    updateSEMut.mutate({ id, data: { status: "canceled" } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
        toast({ title: "Email cancelled" });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this scheduled email?")) return;
    deleteSEMut.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
        toast({ title: "Email deleted" });
      },
    });
  };

  const scheduled = allItems.filter(i => i.status === "scheduled");
  const overdue = scheduled.filter(i => i.scheduledFor && new Date(i.scheduledFor) <= new Date());
  const sent = allItems.filter(i => i.status === "sent" || i.status === "completed");
  const errors = allItems.filter(i => i.status === "error" || i.status === "failed" || i.status === "canceled" || i.status === "cancelled");

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-full pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Unified Send Queue</h1>
            <p className="text-muted-foreground text-sm mt-1">Leads &amp; contacts across both pipelines — scheduled emails and active sequences in one place.</p>
          </div>
          <Button onClick={handleProcess} disabled={processMut.isPending} className="rounded-xl gap-2 bg-primary text-white self-start sm:self-auto shadow-md">
            <Play className="h-4 w-4" />
            {processMut.isPending ? "Processing..." : "Process Queue"}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 text-center rounded-2xl border-border/50">
            <div className="text-2xl font-bold text-primary">{scheduled.length}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </Card>
          <Card className="p-4 text-center rounded-2xl border-border/50">
            <div className="text-2xl font-bold text-amber-600">{overdue.length}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </Card>
          <Card className="p-4 text-center rounded-2xl border-border/50">
            <div className="text-2xl font-bold text-green-600">{sent.length}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </Card>
          <Card className="p-4 text-center rounded-2xl border-border/50">
            <div className="text-2xl font-bold text-red-600">{errors.length}</div>
            <div className="text-xs text-muted-foreground">Cancelled/Errors</div>
          </Card>
        </div>

        <Card className="p-3 sm:p-4 bg-card border-border/50 rounded-2xl flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search by recipient, email, company, subject..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={filter === "" ? "default" : "outline"} size="sm" className="rounded-lg text-xs" onClick={() => setFilter("")}>
                All
              </Button>
              {statusOptions.map(s => (
                <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" className="rounded-lg text-xs capitalize"
                  onClick={() => setFilter(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold hidden sm:table-cell">Company</th>
                    <th className="px-4 py-3 font-semibold hidden lg:table-cell">Subject</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Source</th>
                    <th className="px-4 py-3 font-semibold hidden md:table-cell">Send Via</th>
                    <th className="px-4 py-3 font-semibold">Scheduled For</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.map((item: any) => {
                    const isOverdue = item.status === "scheduled" && item.scheduledFor && new Date(item.scheduledFor) <= new Date();
                    return (
                      <tr key={`${item._source}-${item.id}`} className={`hover:bg-muted/30 transition-colors ${isOverdue ? "bg-amber-50/50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item._recipient}</div>
                          <div className="text-xs text-muted-foreground">{item._email || item._company}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{item._company || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{item.subject || "-"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`${item._statusClass} capitalize font-medium`}>{item._statusLabel}</Badge>
                          {isOverdue && <span className="ml-1 text-xs text-amber-600 font-medium">overdue</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{item._sourceLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell capitalize">{item._sendVia}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.scheduledFor ? format(new Date(item.scheduledFor), "MMM d, h:mm a") : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewEmail(item)} title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
                            {item.status === "scheduled" && item._source === "scheduled" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => handleCancel(item.id)} title="Cancel"><XCircle className="h-3.5 w-3.5" /></Button>
                            )}
                            {item._source === "scheduled" && (item.status === "cancelled" || item.status === "canceled" || item.status === "sent") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(queueLoading || seLoading) && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
              {!queueLoading && !seLoading && filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="h-10 w-10 text-border mx-auto mb-2" />
                  <p>No queued emails found.</p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</div>
        </Card>
      </div>

      {previewEmail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewEmail(null)} />
          <div className="relative bg-card w-full max-w-lg h-full overflow-y-auto border-l border-border z-10 shadow-2xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold">Email Preview</h2>
              <Button variant="ghost" size="icon" onClick={() => setPreviewEmail(null)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`${previewEmail._statusClass} capitalize font-medium`}>{previewEmail._statusLabel}</Badge>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 capitalize">{previewEmail._sourceLabel}</span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 capitalize">via {previewEmail._sendVia}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{previewEmail._recipient}</span></div>
                {previewEmail._email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{previewEmail._email}</span></div>}
                {previewEmail._company && <div className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-muted-foreground" /><span>{previewEmail._company}</span></div>}
                {previewEmail.scheduledFor && <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(new Date(previewEmail.scheduledFor), "MMM d, yyyy 'at' h:mm a")}</span></div>}
                {previewEmail._step !== "-" && <div className="flex items-center gap-2 text-sm"><Tag className="h-4 w-4 text-muted-foreground" /><span>{previewEmail._step}</span></div>}
              </div>
              {previewEmail.subject && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <span className="text-xs font-medium text-muted-foreground">Subject</span>
                  <p className="text-sm font-medium mt-0.5">{previewEmail.subject}</p>
                </div>
              )}
              {(previewEmail.body || previewEmail.bodyRendered) && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <span className="text-xs font-medium text-muted-foreground">Body</span>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{previewEmail.body || previewEmail.bodyRendered}</p>
                </div>
              )}
              {previewEmail.status === "scheduled" && previewEmail._source === "scheduled" && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-amber-600" onClick={() => { handleCancel(previewEmail.id); setPreviewEmail(null); }}>
                    <XCircle className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
