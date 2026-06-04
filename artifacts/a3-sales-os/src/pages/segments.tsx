import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetLeads, useGetContacts,
  getGetLeadsQueryKey, getGetContactsQueryKey,
  getGetScheduledEmailsQueryKey, getGetSequenceQueueQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PieChart, Search, Send, Users, X, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { assignSegment } from "@/lib/segments-api";
import { deriveLifecycleStatus, LIFECYCLE_COLORS } from "@/lib/lifecycle";

const API_BASE = import.meta.env.BASE_URL + "api";

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}

interface SegmentRow {
  id: number;
  name: string;
  status?: string | null;
  campaignId: number;
  campaignName: string;
  audienceCount?: number;
}

// Fetch every campaign segment across all campaigns and flatten them into one
// operational list. There is no global "list all segments" endpoint, so we walk
// campaigns and pull each one's segments.
function useAllSegments() {
  return useQuery<SegmentRow[]>({
    queryKey: ["all-segments"],
    queryFn: async () => {
      const campaigns = await apiGet<any[]>("/campaigns");
      const perCampaign = await Promise.all(
        (campaigns || []).map(async (c) => {
          try {
            const segs = await apiGet<any[]>(`/campaigns/${c.id}/segments`);
            return (segs || []).map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
              campaignId: c.id,
              campaignName: c.name,
              audienceCount: s.audienceCount ?? 0,
            }));
          } catch {
            return [] as SegmentRow[];
          }
        }),
      );
      return perCampaign.flat();
    },
  });
}

function LifecycleBadge({ record }: { record: any }) {
  const status = deriveLifecycleStatus(record);
  return <Badge variant="outline" className={`${LIFECYCLE_COLORS[status]} border font-medium`}>{status}</Badge>;
}

export default function Segments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [includeAudience, setIncludeAudience] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: segments, isLoading: segLoading } = useAllSegments();
  const { data: leads } = useGetLeads();
  const { data: contacts } = useGetContacts();

  const selected = useMemo(
    () => (segments || []).find((s) => s.id === selectedId) || null,
    [segments, selectedId],
  );

  // Leads/contacts already tagged with this segment (the segment's members).
  const taggedLeads = useMemo(
    () => (leads || []).filter((l: any) => selectedId != null && l.segmentId === selectedId),
    [leads, selectedId],
  );
  const taggedContacts = useMemo(
    () => (contacts || []).filter((c: any) => selectedId != null && c.segmentId === selectedId),
    [contacts, selectedId],
  );

  // Resolved audience (leads matching the segment's saved criteria) — these may
  // not be tagged yet but are who the segment targets.
  const { data: audience } = useQuery<{ count: number; contacts: any[] }>({
    queryKey: ["segment-audience", selectedId],
    queryFn: () => apiGet(`/campaign-segments/${selectedId}/audience`),
    enabled: selectedId != null,
  });
  const audienceLeads = audience?.contacts || [];

  const filteredSegments = useMemo(() => {
    let list = segments || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.campaignName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [segments, search]);

  const taggedLeadIds = useMemo(() => taggedLeads.map((l: any) => l.id), [taggedLeads]);
  const taggedContactIds = useMemo(() => taggedContacts.map((c: any) => c.id), [taggedContacts]);
  const audienceLeadIds = useMemo(() => audienceLeads.map((l: any) => l.id), [audienceLeads]);

  const finalLeadIds = useMemo(() => {
    const set = new Set<number>(taggedLeadIds);
    if (includeAudience) audienceLeadIds.forEach((id: number) => set.add(id));
    return Array.from(set);
  }, [taggedLeadIds, audienceLeadIds, includeAudience]);

  const recipientCount = finalLeadIds.length + taggedContactIds.length;

  const handleAssign = async () => {
    if (!selected) return;
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and body are required", variant: "destructive" });
      return;
    }
    if (recipientCount === 0) {
      toast({ title: "No recipients for this segment", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await assignSegment({
        segmentId: selected.id,
        leadIds: finalLeadIds,
        contactIds: taggedContactIds,
        subject,
        body,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      });
      queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetScheduledEmailsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["all-segments"] });
      queryClient.invalidateQueries({ queryKey: ["segment-audience", selected.id] });
      toast({
        title: "Segment activated",
        description: `${result.emailsCreated} email(s) scheduled · ${result.leadsAssigned} lead(s), ${result.contactsAssigned} contact(s) assigned${result.skipped ? ` · ${result.skipped} skipped` : ""}`,
      });
      setShowAssign(false);
      setSubject("");
      setBody("");
      setScheduledFor("");
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const members = useMemo(() => {
    const rows: any[] = [];
    taggedLeads.forEach((l: any) =>
      rows.push({ key: `lead-${l.id}`, type: "Lead", name: l.contactName, email: l.email, company: l.companyName, record: l }),
    );
    taggedContacts.forEach((c: any) =>
      rows.push({ key: `contact-${c.id}`, type: "Contact", name: c.fullName, email: c.email, company: c.company, record: c }),
    );
    if (includeAudience) {
      const taggedSet = new Set(taggedLeadIds);
      audienceLeads
        .filter((l: any) => !taggedSet.has(l.id))
        .forEach((l: any) =>
          rows.push({ key: `aud-${l.id}`, type: "Audience", name: l.contactName, email: l.email, company: l.companyName, record: l }),
        );
    }
    return rows;
  }, [taggedLeads, taggedContacts, audienceLeads, includeAudience, taggedLeadIds]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 h-full pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Segments</h1>
            <p className="text-muted-foreground text-sm mt-1">Activate a segment to schedule outreach across leads &amp; contacts in one converged pipeline.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Segment list */}
          <Card className="p-3 sm:p-4 bg-card border-border/50 rounded-2xl flex flex-col min-h-0 lg:col-span-1">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search segments..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
            </div>
            <div className="overflow-auto flex-1 space-y-2">
              {segLoading && <div className="p-6 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
              {!segLoading && filteredSegments.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <PieChart className="h-10 w-10 text-border mx-auto mb-2" />
                  <p className="text-sm">No segments found. Create segments inside a campaign first.</p>
                </div>
              )}
              {filteredSegments.map((s) => (
                <button key={s.id} onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedId === s.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{s.name}</span>
                    {s.status && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">{s.status}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{s.campaignName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.audienceCount ?? 0} in audience</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Segment detail / members */}
          <Card className="p-3 sm:p-4 bg-card border-border/50 rounded-2xl flex flex-col min-h-0 lg:col-span-2">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Users className="h-10 w-10 text-border mx-auto mb-2" />
                  <p className="text-sm">Select a segment to view members and activate outreach.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-xs text-muted-foreground">{selected.campaignName}</p>
                  </div>
                  <Button onClick={() => setShowAssign(true)} className="rounded-xl gap-2 bg-primary text-white self-start sm:self-auto shadow-md">
                    <Send className="h-4 w-4" /> Assign / Activate
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{taggedLeads.length} tagged lead(s)</span>
                  <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{taggedContacts.length} tagged contact(s)</span>
                  <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{audienceLeads.length} resolved audience</span>
                  <label className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={includeAudience} onChange={(e) => setIncludeAudience(e.target.checked)} />
                    Include audience
                  </label>
                </div>

                <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col min-h-0">
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Member</th>
                          <th className="px-4 py-3 font-semibold hidden sm:table-cell">Company</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {members.map((m) => (
                          <tr key={m.key} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{m.name || "Unknown"}</div>
                              <div className="text-xs text-muted-foreground">{m.email}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{m.company || "-"}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{m.type}</span>
                            </td>
                            <td className="px-4 py-3"><LifecycleBadge record={m.record} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {members.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm">No members yet for this segment.</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{members.length} member(s)</div>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Assign / Activate modal */}
      {showAssign && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setShowAssign(false)} />
          <div className="relative bg-card w-full max-w-lg rounded-2xl border border-border z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold">Activate “{selected.name}”</h2>
                <p className="text-xs text-muted-foreground">Schedules outreach for {recipientCount} recipient(s).</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => !submitting && setShowAssign(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{finalLeadIds.length} lead(s)</span>
                <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{taggedContactIds.length} contact(s)</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seg-subject">Subject</Label>
                <Input id="seg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Quick idea for {{company}}" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seg-body">Body</Label>
                <Textarea id="seg-body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder={"Hi {{firstName}},\n\n..."} />
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> Tokens: {"{{firstName}}, {{company}}, {{title}}, {{event}}"}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seg-when">Scheduled for (optional)</Label>
                <Input id="seg-when" type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
                <p className="text-xs text-muted-foreground">Leave blank to schedule immediately.</p>
              </div>
            </div>
            <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssign(false)} disabled={submitting} className="rounded-xl">Cancel</Button>
              <Button onClick={handleAssign} disabled={submitting || recipientCount === 0} className="rounded-xl gap-2 bg-primary text-white">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Activating..." : "Activate Segment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
