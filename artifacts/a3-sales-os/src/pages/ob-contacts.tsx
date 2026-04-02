import { useState } from "react";
import { AppLayout } from "@/components/layout";
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
  getGetContactsQueryKey,
  getGetOutboundAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

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

export default function ObContacts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
  };

  const handleAction = (mutFn: any, id: number, label: string) => {
    mutFn.mutate({ id }, {
      onSuccess: () => { invalidate(); toast({ title: label }); },
      onError: () => toast({ title: `Failed: ${label}`, variant: "destructive" }),
    });
  };

  const uniqueCampaigns = [...new Set((contacts || []).map((c: any) => c.campaignName).filter(Boolean))];
  const uniqueSegments = [...new Set((contacts || []).map((c: any) => c.segmentType).filter(Boolean))];

  const filtered = (contacts || []).filter((c: any) => {
    if (segmentFilter && c.segmentType !== segmentFilter) return false;
    if (tierFilter && c.engagementTier !== tierFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage outbound contacts, engagement scoring, and sequence status.</p>
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
        </div>

        <div className="text-sm text-muted-foreground">{filtered.length} contacts</div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Segment</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Step</th>
                <th className="text-left px-4 py-3 font-medium">Next Send</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => {
                const tier = TIER_CONFIG[c.engagementTier] || TIER_CONFIG.cold;
                const TierIcon = tier.icon;
                return (
                  <>
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.sequenceStatus] || "bg-gray-100"}`}>
                          {c.sequenceStatus?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{c.currentStep || 0}/7</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {c.nextSendAt ? format(new Date(c.nextSendAt), "MMM d, h:mm a") : "-"}
                      </td>
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
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={9} className="px-4 py-4 bg-muted/10">
                          <ContactDetail contact={c} />
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
    </AppLayout>
  );
}

function ContactDetail({ contact }: { contact: any }) {
  const { data: steps } = useGetContactSteps(contact.id);
  const { data: events } = useGetContactEvents(contact.id);
  const [tab, setTab] = useState<"details" | "steps" | "events">("details");

  const tier = TIER_CONFIG[contact.engagementTier] || TIER_CONFIG.cold;
  const TierIcon = tier.icon;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border">
        {(["details", "steps", "events"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "details" ? "Details" : t === "steps" ? "Sequence Steps" : "Engagement Timeline"}
          </button>
        ))}
      </div>

      {tab === "details" && (
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
              {contact.customLine && <div><span className="text-muted-foreground">Custom Line:</span> {contact.customLine}</div>}
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
