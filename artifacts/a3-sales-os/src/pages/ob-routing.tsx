import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useGetRoutingQueue,
  useGetRoutingAnalytics,
  useGetRoutingRecommendations,
  useUpdateContactRouting,
  useBulkUpdateRouting,
  useGetNextActions,
  useGetCtaLibrary,
  useCreateNextAction,
  useUpdateNextAction,
  useDeleteNextAction,
  useCreateCtaEntry,
  useUpdateCtaEntry,
  useDeleteCtaEntry,
  useEvaluateContactRouting,
  useGetRoutingLogs,
  getGetRoutingQueueQueryKey,
  getGetRoutingAnalyticsQueryKey,
  getGetRoutingRecommendationsQueryKey,
  getGetNextActionsQueryKey,
  getGetCtaLibraryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Flame,
  Thermometer,
  Snowflake,
  AlertTriangle,
  RefreshCw,
  Star,
  Lock,
  Unlock,
  ChevronRight,
  Users,
  Target,
  ArrowRight,
  Plus,
  Trash2,
  Edit,
  MessageSquare,
  RotateCcw,
  CheckCircle,
  XCircle,
  Shield,
} from "lucide-react";
import { format } from "date-fns";

const ROUTING_STATES = [
  { value: "standard_nurture", label: "Standard Nurture", color: "text-gray-600", bg: "bg-gray-50" },
  { value: "warm_followup", label: "Warm Follow-up", color: "text-amber-600", bg: "bg-amber-50" },
  { value: "hot_priority", label: "Hot Priority", color: "text-red-600", bg: "bg-red-50" },
  { value: "awaiting_manual_outreach", label: "Awaiting Manual", color: "text-blue-600", bg: "bg-blue-50" },
  { value: "meeting_candidate", label: "Meeting Candidate", color: "text-purple-600", bg: "bg-purple-50" },
  { value: "qualified_opportunity", label: "Qualified Opportunity", color: "text-emerald-600", bg: "bg-emerald-50" },
  { value: "reactivation_pool", label: "Reactivation Pool", color: "text-orange-600", bg: "bg-orange-50" },
  { value: "closed_won", label: "Closed Won", color: "text-green-600", bg: "bg-green-50" },
  { value: "closed_lost", label: "Closed Lost", color: "text-red-500", bg: "bg-red-50" },
  { value: "disqualified", label: "Disqualified", color: "text-gray-400", bg: "bg-gray-50" },
];

const QUALIFIED_STATUSES = ["unreviewed", "candidate", "qualified", "closed_won", "closed_lost", "disqualified"];

function RoutingStateBadge({ state }: { state: string }) {
  const cfg = ROUTING_STATES.find(s => s.value === state) || ROUTING_STATES[0];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function TierIcon({ tier }: { tier: string }) {
  if (tier === "hot") return <Flame className="h-4 w-4 text-red-600" />;
  if (tier === "warm") return <Thermometer className="h-4 w-4 text-amber-600" />;
  return <Snowflake className="h-4 w-4 text-blue-400" />;
}

export default function ObRouting() {
  const [activeTab, setActiveTab] = useState<"queues" | "actions" | "ctas" | "analytics">("queues");
  const [activeQueue, setActiveQueue] = useState("hot_priority");
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [showCtaForm, setShowCtaForm] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [editingCta, setEditingCta] = useState<any>(null);
  const [actionForm, setActionForm] = useState({ name: "", description: "", recommendedForTier: "", recommendedForSegment: "" });
  const [ctaForm, setCtaForm] = useState({ name: "", description: "", text: "", recommendedForTier: "", recommendedForSegment: "" });
  const [bulkForm, setBulkForm] = useState({ routingState: "", recommendedNextAction: "", qualifiedStatus: "", reason: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: queue } = useGetRoutingQueue(activeQueue);
  const { data: analytics } = useGetRoutingAnalytics();
  const { data: recommendations } = useGetRoutingRecommendations(selectedContact || 0, { query: { enabled: !!selectedContact } });
  const { data: routingLogs } = useGetRoutingLogs(selectedContact || 0, { query: { enabled: !!selectedContact } });
  const { data: nextActions } = useGetNextActions();
  const { data: ctaLibrary } = useGetCtaLibrary();

  const updateRouting = useUpdateContactRouting();
  const bulkUpdate = useBulkUpdateRouting();
  const evaluateRouting = useEvaluateContactRouting();
  const createAction = useCreateNextAction();
  const updateAction = useUpdateNextAction();
  const deleteAction = useDeleteNextAction();
  const createCta = useCreateCtaEntry();
  const updateCta = useUpdateCtaEntry();
  const deleteCta = useDeleteCtaEntry();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetRoutingQueueQueryKey(activeQueue) });
    queryClient.invalidateQueries({ queryKey: getGetRoutingAnalyticsQueryKey() });
    if (selectedContact) {
      queryClient.invalidateQueries({ queryKey: getGetRoutingRecommendationsQueryKey(selectedContact) });
      queryClient.invalidateQueries({ queryKey: ["getRoutingLogs", selectedContact] });
    }
  };

  const handleUpdateRouting = (id: number, updates: any) => {
    updateRouting.mutate({ id, data: updates }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Routing updated" }); },
      onError: () => toast({ title: "Failed to update routing", variant: "destructive" }),
    });
  };

  const handleBulkUpdate = () => {
    const data: any = { contactIds: selectedContacts };
    if (bulkForm.routingState) data.routingState = bulkForm.routingState;
    if (bulkForm.recommendedNextAction) data.recommendedNextAction = bulkForm.recommendedNextAction;
    if (bulkForm.qualifiedStatus) data.qualifiedStatus = bulkForm.qualifiedStatus;
    if (bulkForm.reason) data.reason = bulkForm.reason;
    bulkUpdate.mutate({ data }, {
      onSuccess: (result: any) => {
        invalidateAll();
        setShowBulkModal(false);
        setSelectedContacts([]);
        const parts = [`Updated: ${result.updated || 0}`];
        if (result.skippedLocked) parts.push(`Locked: ${result.skippedLocked}`);
        if (result.notFound) parts.push(`Not found: ${result.notFound}`);
        toast({ title: parts.join(", ") });
      },
      onError: () => toast({ title: "Bulk update failed", variant: "destructive" }),
    });
  };

  const handleReEvaluate = (id: number) => {
    evaluateRouting.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Routing re-evaluated" }); },
      onError: () => toast({ title: "Re-evaluation failed", variant: "destructive" }),
    });
  };

  const handleSaveAction = () => {
    if (editingAction) {
      updateAction.mutate({ id: editingAction.id, data: actionForm as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNextActionsQueryKey() });
          setShowActionForm(false); setEditingAction(null);
          toast({ title: "Action updated" });
        },
        onError: () => toast({ title: "Failed to update action", variant: "destructive" }),
      });
    } else {
      createAction.mutate({ data: actionForm as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetNextActionsQueryKey() });
          setShowActionForm(false);
          toast({ title: "Action created" });
        },
        onError: () => toast({ title: "Failed to create action", variant: "destructive" }),
      });
    }
  };

  const handleSaveCta = () => {
    if (editingCta) {
      updateCta.mutate({ id: editingCta.id, data: ctaForm as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCtaLibraryQueryKey() });
          setShowCtaForm(false); setEditingCta(null);
          toast({ title: "CTA updated" });
        },
        onError: () => toast({ title: "Failed to update CTA", variant: "destructive" }),
      });
    } else {
      createCta.mutate({ data: ctaForm as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCtaLibraryQueryKey() });
          setShowCtaForm(false);
          toast({ title: "CTA created" });
        },
        onError: () => toast({ title: "Failed to create CTA", variant: "destructive" }),
      });
    }
  };

  const toggleContactSelect = (id: number) => {
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const TABS = [
    { key: "queues", label: "Routing Queues" },
    { key: "actions", label: "Next Actions" },
    { key: "ctas", label: "CTA Library" },
    { key: "analytics", label: "Routing Analytics" },
  ] as const;

  const QUEUE_TABS = [
    { key: "hot_priority", label: "Hot Priority", icon: Flame, color: "text-red-600" },
    { key: "warm_followup", label: "Warm Follow-up", icon: Thermometer, color: "text-amber-600" },
    { key: "awaiting_manual_outreach", label: "Awaiting Manual", icon: AlertTriangle, color: "text-blue-600" },
    { key: "reactivation_pool", label: "Reactivation", icon: RefreshCw, color: "text-orange-600" },
    { key: "qualified_opportunity", label: "Qualified", icon: Star, color: "text-emerald-600" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offer Routing</h1>
          <p className="text-muted-foreground mt-1">Intelligent lead routing, prioritization, and next-action recommendations.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4 border-red-200">
            <div className="flex items-center gap-2 mb-1"><Flame className="h-4 w-4 text-red-600" /><span className="text-xs text-muted-foreground">Hot Priority</span></div>
            <div className="text-2xl font-bold text-red-600">{analytics?.hotPriority || 0}</div>
          </Card>
          <Card className="p-4 border-amber-200">
            <div className="flex items-center gap-2 mb-1"><Thermometer className="h-4 w-4 text-amber-600" /><span className="text-xs text-muted-foreground">Warm Follow-up</span></div>
            <div className="text-2xl font-bold text-amber-600">{analytics?.warmFollowup || 0}</div>
          </Card>
          <Card className="p-4 border-blue-200">
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">Awaiting Manual</span></div>
            <div className="text-2xl font-bold text-blue-600">{analytics?.awaitingManualOutreach || 0}</div>
          </Card>
          <Card className="p-4 border-orange-200">
            <div className="flex items-center gap-2 mb-1"><RefreshCw className="h-4 w-4 text-orange-600" /><span className="text-xs text-muted-foreground">Reactivation</span></div>
            <div className="text-2xl font-bold text-orange-600">{analytics?.reactivationPool || 0}</div>
          </Card>
          <Card className="p-4 border-emerald-200">
            <div className="flex items-center gap-2 mb-1"><Star className="h-4 w-4 text-emerald-600" /><span className="text-xs text-muted-foreground">Qualified</span></div>
            <div className="text-2xl font-bold text-emerald-600">{(analytics?.byState as any)?.qualified_opportunity || 0}</div>
          </Card>
        </div>

        <div className="flex gap-2 border-b border-border pb-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "queues" && (
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="flex gap-2 mb-4 flex-wrap">
                {QUEUE_TABS.map(qt => {
                  const Icon = qt.icon;
                  return (
                    <button key={qt.key} onClick={() => { setActiveQueue(qt.key); setSelectedContact(null); setSelectedContacts([]); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeQueue === qt.key ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted"}`}>
                      <Icon className={`h-3.5 w-3.5 ${qt.color}`} />
                      {qt.label}
                      <span className="ml-1 text-xs bg-muted rounded-full px-1.5">{(analytics?.byState as any)?.[qt.key] || 0}</span>
                    </button>
                  );
                })}
              </div>

              {selectedContacts.length > 0 && (
                <div className="flex items-center gap-3 mb-3 p-2 bg-primary/5 rounded-xl">
                  <span className="text-sm font-medium">{selectedContacts.length} selected</span>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setShowBulkModal(true)}>Bulk Update</Button>
                  <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setSelectedContacts([])}>Clear</Button>
                </div>
              )}

              <div className="space-y-2">
                {queue && queue.length > 0 ? queue.map((contact: any) => (
                  <Card key={contact.id} className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedContact === contact.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedContact(contact.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={selectedContacts.includes(contact.id)}
                          onChange={(e) => { e.stopPropagation(); toggleContactSelect(contact.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 rounded" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{contact.fullName}</span>
                            <TierIcon tier={contact.engagementTier || "cold"} />
                            {contact.manualPriority && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                            {contact.routingLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {contact.company}{contact.title ? ` · ${contact.title}` : ""}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <RoutingStateBadge state={contact.routingState || "standard_nurture"} />
                            {contact.recommendedNextAction && (
                              <span className="text-xs text-primary font-medium flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                {contact.recommendedNextAction.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{contact.engagementScore || 0}</div>
                        <div className="text-xs text-muted-foreground">score</div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                      </div>
                    </div>
                  </Card>
                )) : (
                  <Card className="p-8 text-center text-muted-foreground">
                    No contacts in this queue.
                  </Card>
                )}
              </div>
            </div>

            {selectedContact && recommendations && (
              <div className="w-[400px] shrink-0">
                <Card className="p-5 sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">{recommendations.contact?.fullName}</h3>
                    <button onClick={() => setSelectedContact(null)} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium">{recommendations.contact?.company}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Title</span>
                      <span className="font-medium">{recommendations.contact?.title || "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Segment</span>
                      <span className="font-medium capitalize">{recommendations.contact?.segmentType || "general"}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Engagement</span>
                      <div className="flex items-center gap-2">
                        <TierIcon tier={recommendations.contact?.engagementTier || "cold"} />
                        <span className="font-bold">{recommendations.contact?.engagementScore}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-muted-foreground">Routing State</span>
                      <RoutingStateBadge state={recommendations.contact?.routingState || "standard_nurture"} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sequence</span>
                      <span className="font-medium capitalize">{recommendations.contact?.sequenceStatus}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Qualified</span>
                      <span className="font-medium capitalize">{recommendations.contact?.qualifiedStatus || "unreviewed"}</span>
                    </div>
                    {recommendations.contact?.lastEmailSentAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Last Email</span>
                        <span className="text-xs">{format(new Date(recommendations.contact.lastEmailSentAt), "MMM d, h:mm a")}</span>
                      </div>
                    )}
                  </div>

                  {recommendations.contact?.recommendedNextAction && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 mb-4">
                      <div className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">Recommended Next Action</div>
                      <div className="font-medium">{recommendations.contact.recommendedNextAction.replace(/_/g, " ")}</div>
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Controls</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={recommendations.contact?.routingState || "standard_nurture"}
                        onChange={(e) => handleUpdateRouting(selectedContact, { routingState: e.target.value, reason: "Manual override by admin" })}
                        className="text-xs px-2 py-1.5 border rounded-lg bg-background">
                        {ROUTING_STATES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <select value={recommendations.contact?.qualifiedStatus || "unreviewed"}
                        onChange={(e) => handleUpdateRouting(selectedContact, { qualifiedStatus: e.target.value })}
                        className="text-xs px-2 py-1.5 border rounded-lg bg-background">
                        {QUALIFIED_STATUSES.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs gap-1"
                        onClick={() => handleUpdateRouting(selectedContact, { routingLocked: !recommendations.contact?.routingLocked })}>
                        {recommendations.contact?.routingLocked ? <><Unlock className="h-3 w-3" /> Unlock</> : <><Lock className="h-3 w-3" /> Lock</>}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs gap-1"
                        onClick={() => handleUpdateRouting(selectedContact, { manualPriority: !recommendations.contact?.manualPriority })}>
                        <Star className={`h-3 w-3 ${recommendations.contact?.manualPriority ? "fill-yellow-500 text-yellow-500" : ""}`} />
                        {recommendations.contact?.manualPriority ? "Unflag" : "Flag Priority"}
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" className="w-full rounded-lg text-xs gap-1"
                      onClick={() => handleReEvaluate(selectedContact)}>
                      <RotateCcw className="h-3 w-3" /> Re-evaluate Routing
                    </Button>
                  </div>

                  {routingLogs && routingLogs.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Routing History</h4>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {routingLogs.map((log: any) => (
                          <div key={log.id} className="text-xs border-l-2 border-primary/20 pl-2 py-1">
                            <div className="font-medium">{log.previousRoutingState?.replace(/_/g, " ")} → {log.newRoutingState?.replace(/_/g, " ")}</div>
                            <div className="text-muted-foreground">{log.reason}</div>
                            <div className="text-muted-foreground/60">{format(new Date(log.createdAt), "MMM d, h:mm a")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.sendHistory && recommendations.sendHistory.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Email History</h4>
                      <div className="space-y-1 max-h-[150px] overflow-y-auto">
                        {recommendations.sendHistory.map((log: any) => (
                          <div key={log.id} className="text-xs flex items-center justify-between py-1">
                            <span className="truncate flex-1">{log.subject || `Step ${log.stepNumber}`}</span>
                            <span className="text-muted-foreground ml-2">{format(new Date(log.sentAt), "MMM d")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.events && recommendations.events.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Engagement Events</h4>
                      <div className="flex flex-wrap gap-1">
                        {["open", "click", "reply", "bounce"].map(type => {
                          const count = recommendations.events.filter((e: any) => e.eventType === type).length;
                          if (!count) return null;
                          const colors: Record<string, string> = { open: "bg-blue-100 text-blue-700", click: "bg-green-100 text-green-700", reply: "bg-emerald-100 text-emerald-700", bounce: "bg-red-100 text-red-700" };
                          return <span key={type} className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>{type}: {count}</span>;
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Next Actions</h3>
              <Button size="sm" className="rounded-xl gap-1" onClick={() => {
                setActionForm({ name: "", description: "", recommendedForTier: "", recommendedForSegment: "" });
                setEditingAction(null);
                setShowActionForm(true);
              }}>
                <Plus className="h-4 w-4" /> Add Action
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {nextActions?.map((action: any) => (
                <Card key={action.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{action.name.replace(/_/g, " ")}</div>
                      <div className="text-sm text-muted-foreground mt-1">{action.description}</div>
                      <div className="flex gap-2 mt-2">
                        {action.recommendedForTier && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-muted font-medium capitalize">{action.recommendedForTier}</span>
                        )}
                        {action.recommendedForSegment && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-muted font-medium capitalize">{action.recommendedForSegment}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => {
                        setEditingAction(action);
                        setActionForm({ name: action.name, description: action.description || "", recommendedForTier: action.recommendedForTier || "", recommendedForSegment: action.recommendedForSegment || "" });
                        setShowActionForm(true);
                      }} className="p-1 hover:bg-muted rounded"><Edit className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteAction.mutate({ id: action.id }, {
                        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetNextActionsQueryKey() }); toast({ title: "Action deleted" }); },
                        onError: () => toast({ title: "Failed to delete action", variant: "destructive" }),
                      })} className="p-1 hover:bg-muted rounded text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ctas" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">CTA Library</h3>
              <Button size="sm" className="rounded-xl gap-1" onClick={() => {
                setCtaForm({ name: "", description: "", text: "", recommendedForTier: "", recommendedForSegment: "" });
                setEditingCta(null);
                setShowCtaForm(true);
              }}>
                <Plus className="h-4 w-4" /> Add CTA
              </Button>
            </div>
            <div className="space-y-3">
              {ctaLibrary?.map((cta: any) => (
                <Card key={cta.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{cta.name}</span>
                        {cta.recommendedForTier && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-muted font-medium capitalize">{cta.recommendedForTier}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{cta.description}</p>
                      <div className="mt-2 p-2 bg-muted/50 rounded-lg text-sm italic">"{cta.text}"</div>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <button onClick={() => {
                        setEditingCta(cta);
                        setCtaForm({ name: cta.name, description: cta.description || "", text: cta.text, recommendedForTier: cta.recommendedForTier || "", recommendedForSegment: cta.recommendedForSegment || "" });
                        setShowCtaForm(true);
                      }} className="p-1 hover:bg-muted rounded"><Edit className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteCta.mutate({ id: cta.id }, {
                        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetCtaLibraryQueryKey() }); toast({ title: "CTA deleted" }); },
                        onError: () => toast({ title: "Failed to delete CTA", variant: "destructive" }),
                      })} className="p-1 hover:bg-muted rounded text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "analytics" && analytics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {ROUTING_STATES.map(state => (
                <Card key={state.value} className="p-3">
                  <div className="text-xs text-muted-foreground">{state.label}</div>
                  <div className={`text-xl font-bold ${state.color}`}>{(analytics.byState as any)?.[state.value] || 0}</div>
                </Card>
              ))}
            </div>

            {analytics.qualifiedBySegment && Object.keys(analytics.qualifiedBySegment).length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Qualified Candidates by Segment</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.qualifiedBySegment).map(([segment, count]: [string, any]) => (
                    <div key={segment} className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{segment}</span>
                      <span className="text-emerald-600 font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {analytics.recentRoutingChanges && analytics.recentRoutingChanges.length > 0 && (
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Recent Routing Changes</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {analytics.recentRoutingChanges.map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                      <div className="flex-1">
                        <span className="font-medium">Contact #{log.contactId}</span>
                        <span className="text-muted-foreground ml-2">
                          {log.previousRoutingState?.replace(/_/g, " ")} → {log.newRoutingState?.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{format(new Date(log.createdAt), "MMM d, h:mm a")}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBulkModal(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border z-10">
            <div className="px-6 py-4 border-b"><h2 className="text-lg font-bold">Bulk Update ({selectedContacts.length} contacts)</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Routing State</label>
                <select value={bulkForm.routingState} onChange={(e) => setBulkForm({ ...bulkForm, routingState: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                  <option value="">— No change —</option>
                  {ROUTING_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Recommended Action</label>
                <select value={bulkForm.recommendedNextAction} onChange={(e) => setBulkForm({ ...bulkForm, recommendedNextAction: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                  <option value="">— No change —</option>
                  {nextActions?.map((a: any) => <option key={a.id} value={a.name}>{a.name.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Qualified Status</label>
                <select value={bulkForm.qualifiedStatus} onChange={(e) => setBulkForm({ ...bulkForm, qualifiedStatus: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                  <option value="">— No change —</option>
                  {QUALIFIED_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Reason</label>
                <input type="text" value={bulkForm.reason} onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value })}
                  placeholder="Reason for change"
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowBulkModal(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleBulkUpdate} className="rounded-xl">Apply</Button>
            </div>
          </div>
        </div>
      )}

      {showActionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowActionForm(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border z-10">
            <div className="px-6 py-4 border-b"><h2 className="text-lg font-bold">{editingAction ? "Edit" : "Create"} Next Action</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <input type="text" value={actionForm.name} onChange={(e) => setActionForm({ ...actionForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <input type="text" value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">For Tier</label>
                  <select value={actionForm.recommendedForTier} onChange={(e) => setActionForm({ ...actionForm, recommendedForTier: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                    <option value="">Any</option>
                    <option value="cold">Cold</option>
                    <option value="warm">Warm</option>
                    <option value="hot">Hot</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">For Segment</label>
                  <select value={actionForm.recommendedForSegment} onChange={(e) => setActionForm({ ...actionForm, recommendedForSegment: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                    <option value="">Any</option>
                    <option value="hotel">Hotel</option>
                    <option value="agency">Agency</option>
                    <option value="developer">Developer</option>
                    <option value="venue">Venue</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowActionForm(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSaveAction} className="rounded-xl">Save</Button>
            </div>
          </div>
        </div>
      )}

      {showCtaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCtaForm(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border z-10">
            <div className="px-6 py-4 border-b"><h2 className="text-lg font-bold">{editingCta ? "Edit" : "Create"} CTA</h2></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Name</label>
                <input type="text" value={ctaForm.name} onChange={(e) => setCtaForm({ ...ctaForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <input type="text" value={ctaForm.description} onChange={(e) => setCtaForm({ ...ctaForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">CTA Text</label>
                <textarea value={ctaForm.text} onChange={(e) => setCtaForm({ ...ctaForm, text: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-background resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">For Tier</label>
                  <select value={ctaForm.recommendedForTier} onChange={(e) => setCtaForm({ ...ctaForm, recommendedForTier: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                    <option value="">Any</option>
                    <option value="cold">Cold</option>
                    <option value="warm">Warm</option>
                    <option value="hot">Hot</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">For Segment</label>
                  <select value={ctaForm.recommendedForSegment} onChange={(e) => setCtaForm({ ...ctaForm, recommendedForSegment: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm bg-background">
                    <option value="">Any</option>
                    <option value="hotel">Hotel</option>
                    <option value="agency">Agency</option>
                    <option value="developer">Developer</option>
                    <option value="venue">Venue</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCtaForm(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSaveCta} className="rounded-xl">Save</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
