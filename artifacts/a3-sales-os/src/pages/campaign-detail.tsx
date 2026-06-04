import { useMemo, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { roleCan } from "@/lib/permissions";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Send,
  Upload,
  Calendar,
  Users,
  FileText,
  X,
  Play,
  ExternalLink,
  Loader2,
  SendHorizontal,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  useGetTemplateSets,
} from "@workspace/api-client-react";
import {
  useCampaignDetail,
  useContactTypes,
  useSegments,
  useSegmentAudience,
  useSegmentMutations,
  usePreviewAudience,
  useAssets,
  useAssetMutations,
  useSchedules,
  useScheduleMutations,
  useCampaignPerformance,
  uploadCampaignFile,
  storageObjectUrl,
  parseArray,
  parseObject,
  type Segment,
  type SegmentInput,
  type SegmentCriteria,
  type SegmentFilterRules,
  type CampaignAsset,
  type CampaignSchedule,
  type Performance,
  type SendAllResult,
} from "@/lib/campaign-api";

function PerfBar({ p }: { p: Performance }) {
  const items: Array<[string, number, string]> = [
    ["Sent", p.sent, "text-green-700"],
    ["Scheduled", p.scheduled, "text-blue-700"],
    ["Queued", p.queued, "text-amber-700"],
    ["Failed", p.failed, "text-red-700"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(([label, n, cls]) => (
        <span key={label} className={cls}>
          <span className="font-semibold">{n}</span> {label}
        </span>
      ))}
    </div>
  );
}

export default function CampaignDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { toast } = useToast();
  const { currentRole } = useWorkspace();
  const canMutate = roleCan(currentRole, "mutate");
  const canManage = roleCan(currentRole, "manage");

  const { data: campaign, isLoading } = useCampaignDetail(id);
  const { data: templateSets } = useGetTemplateSets();

  if (Number.isNaN(id)) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Invalid campaign.</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {isLoading ? "Loading…" : campaign?.name}
            </h1>
            {campaign?.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
          {campaign && (
            <Badge variant={campaign.isActive ? "default" : "secondary"}>
              {campaign.status || (campaign.isActive ? "Active" : "Inactive")}
            </Badge>
          )}
        </div>

        {campaign && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="segments">
                Segments ({campaign.segmentCount})
              </TabsTrigger>
              <TabsTrigger value="assets">
                Assets ({campaign.assetCount})
              </TabsTrigger>
              <TabsTrigger value="schedule">
                Schedule ({campaign.scheduleCount})
              </TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab campaignId={id} />
            </TabsContent>
            <TabsContent value="segments" className="mt-6">
              <SegmentsTab
                campaignId={id}
                canMutate={canMutate}
                canManage={canManage}
                templateSets={templateSets || []}
              />
            </TabsContent>
            <TabsContent value="assets" className="mt-6">
              <AssetsTab campaignId={id} canMutate={canMutate} />
            </TabsContent>
            <TabsContent value="schedule" className="mt-6">
              <ScheduleTab
                campaignId={id}
                canMutate={canMutate}
                canManage={canManage}
                templateSets={templateSets || []}
              />
            </TabsContent>
            <TabsContent value="contacts" className="mt-6">
              <ContactsTab campaignId={id} />
            </TabsContent>
            <TabsContent value="performance" className="mt-6">
              <PerformanceTab campaignId={id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-6">
              <ActivityTab campaignId={id} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function OverviewTab({ campaignId }: { campaignId: number }) {
  const { data: campaign } = useCampaignDetail(campaignId);
  const { data: perf } = useCampaignPerformance(campaignId);
  if (!campaign) return null;

  const stat = (label: string, value: React.ReactNode) => (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stat("Segments", campaign.segmentCount)}
        {stat("Assets", campaign.assetCount)}
        {stat("Scheduled sends", campaign.scheduleCount)}
        {stat("Emails sent", perf?.totals.sent ?? 0)}
      </div>
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row label="Objective" value={campaign.objective} />
          <Row label="Owner" value={campaign.owner} />
          <Row label="Status" value={campaign.status} />
          <Row
            label="Default sender"
            value={
              campaign.defaultSenderEmail
                ? `${campaign.defaultSenderName || ""} <${campaign.defaultSenderEmail}>`.trim()
                : null
            }
          />
          <Row label="Default reply-to" value={campaign.defaultReplyTo} />
          <Row label="Provider" value={campaign.defaultProvider} />
          <Row
            label="Start date"
            value={campaign.startDate ? format(new Date(campaign.startDate), "MMM d, yyyy") : null}
          />
          <Row
            label="End date"
            value={campaign.endDate ? format(new Date(campaign.endDate), "MMM d, yyyy") : null}
          />
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value || "—"}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------
const EMPTY_SEGMENT_FORM = {
  name: "",
  contactTypes: [] as string[],
  filterRules: {} as SegmentFilterRules,
  templateId: "" as string,
  sequenceId: "" as string,
  senderName: "",
  senderEmail: "",
  replyTo: "",
  notes: "",
};

function SegmentsTab({
  campaignId,
  canMutate,
  canManage,
  templateSets,
}: {
  campaignId: number;
  canMutate: boolean;
  canManage: boolean;
  templateSets: any[];
}) {
  const { data: segments, isLoading } = useSegments(campaignId);
  const { data: contactTypes } = useContactTypes();
  const { create, update, remove, send, sendAll } = useSegmentMutations(campaignId);
  const preview = usePreviewAudience(campaignId);
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_SEGMENT_FORM });
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [showSendAll, setShowSendAll] = useState(false);
  const [sendAllForm, setSendAllForm] = useState<{
    mode: "send_now" | "schedule";
    scheduledFor: string;
    scheduleStyle: "same" | "stagger" | "custom";
    staggerMinutes: string;
    segmentTimes: Record<number, string>;
  }>({
    mode: "send_now",
    scheduledFor: "",
    scheduleStyle: "same",
    staggerMinutes: "30",
    segmentTimes: {},
  });
  const [sendAllResult, setSendAllResult] = useState<SendAllResult | null>(null);

  const segmentCount = segments?.length ?? 0;

  const openNew = () => {
    setForm({ ...EMPTY_SEGMENT_FORM });
    setEditId(null);
    setPreviewCount(null);
    setShowModal(true);
  };
  const openEdit = (s: Segment) => {
    setForm({
      name: s.name,
      contactTypes: parseArray<string>(s.contactTypes),
      filterRules: parseObject<SegmentFilterRules>(s.filterRules),
      templateId: s.templateId ? String(s.templateId) : "",
      sequenceId: s.sequenceId ? String(s.sequenceId) : "",
      senderName: s.senderName || "",
      senderEmail: s.senderEmail || "",
      replyTo: s.replyTo || "",
      notes: s.notes || "",
    });
    setEditId(s.id);
    setPreviewCount(s.audienceCount);
    setShowModal(true);
  };

  const criteria = (): SegmentCriteria => ({
    contactTypes: form.contactTypes,
    filterRules: cleanFilters(form.filterRules),
  });

  const runPreview = () => {
    preview.mutate(criteria(), {
      onSuccess: (r) => setPreviewCount(r.count),
      onError: (e: any) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
    });
  };

  const toggleType = (t: string) => {
    setForm((f) => ({
      ...f,
      contactTypes: f.contactTypes.includes(t)
        ? f.contactTypes.filter((x) => x !== t)
        : [...f.contactTypes, t],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    const data: SegmentInput = {
      name: form.name,
      contactTypes: form.contactTypes,
      filterRules: cleanFilters(form.filterRules),
      templateId: form.templateId ? Number(form.templateId) : null,
      sequenceId: form.sequenceId ? Number(form.sequenceId) : null,
      senderName: form.senderName || null,
      senderEmail: form.senderEmail || null,
      replyTo: form.replyTo || null,
      notes: form.notes || null,
    };
    const onSuccess = () => {
      setShowModal(false);
      toast({ title: editId ? "Segment updated" : "Segment created" });
    };
    const onError = (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" });
    if (editId) update.mutate({ id: editId, data }, { onSuccess, onError });
    else create.mutate(data, { onSuccess, onError });
  };

  const handleDelete = (id: number) => {
    remove.mutate(id, {
      onSuccess: () => toast({ title: "Segment deleted" }),
      onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });
  };

  const handleSend = (s: Segment) => {
    send.mutate(
      { id: s.id },
      {
        onSuccess: () => toast({ title: `Send started for "${s.name}"` }),
        onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const openSendAll = () => {
    setSendAllForm({
      mode: "send_now",
      scheduledFor: "",
      scheduleStyle: "same",
      staggerMinutes: "30",
      segmentTimes: {},
    });
    setSendAllResult(null);
    setShowSendAll(true);
  };

  const handleSendAll = () => {
    const isSchedule = sendAllForm.mode === "schedule";
    const isCustom = isSchedule && sendAllForm.scheduleStyle === "custom";

    if (isSchedule && !isCustom && !sendAllForm.scheduledFor) {
      return toast({ title: "Pick a date/time", variant: "destructive" });
    }

    let staggerMinutes: number | null = null;
    if (isSchedule && sendAllForm.scheduleStyle === "stagger") {
      const n = Number(sendAllForm.staggerMinutes);
      if (!Number.isFinite(n) || n <= 0) {
        return toast({ title: "Enter a stagger interval greater than 0", variant: "destructive" });
      }
      staggerMinutes = Math.floor(n);
    }

    let segmentSchedules: Array<{ segmentId: number; scheduledFor: string }> | undefined;
    if (isCustom) {
      segmentSchedules = (segments || [])
        .map((s) => ({ segmentId: s.id, raw: sendAllForm.segmentTimes[s.id] }))
        .filter((e) => !!e.raw)
        .map((e) => ({ segmentId: e.segmentId, scheduledFor: new Date(e.raw).toISOString() }));
      if (segmentSchedules.length === 0) {
        return toast({ title: "Set a time for at least one segment", variant: "destructive" });
      }
    }

    sendAll.mutate(
      {
        mode: sendAllForm.mode,
        scheduledFor:
          isSchedule && !isCustom && sendAllForm.scheduledFor
            ? new Date(sendAllForm.scheduledFor).toISOString()
            : null,
        staggerMinutes,
        segmentSchedules,
      },
      {
        onSuccess: (r) => {
          setSendAllResult(r);
          setShowSendAll(false);
          const { sent, scheduled, skipped, failed } = r.summary;
          const parts = [
            r.mode === "schedule" ? `${scheduled} scheduled` : `${sent} sent`,
            skipped ? `${skipped} skipped` : null,
            failed ? `${failed} failed` : null,
          ].filter(Boolean);
          toast({
            title: "Campaign send finished",
            description: parts.join(" · "),
            variant: failed ? "destructive" : "default",
          });
        },
        onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Each segment targets its own audience with its own template, sender, and schedule.
        </p>
        <div className="flex gap-2">
          {canManage && segmentCount > 0 && (
            <Button
              variant="outline"
              onClick={openSendAll}
              disabled={sendAll.isPending}
              className="rounded-xl gap-2"
            >
              {sendAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              Send all segments
            </Button>
          )}
          {canMutate && (
            <Button onClick={openNew} className="rounded-xl gap-2">
              <Plus className="h-4 w-4" /> New Segment
            </Button>
          )}
        </div>
      </div>

      {sendAllResult && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {sendAllResult.mode === "schedule" ? "Schedule all segments" : "Send all segments"} — results
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSendAllResult(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {sendAllResult.mode === "schedule" ? (
              <span className="text-blue-700"><span className="font-semibold">{sendAllResult.summary.scheduled}</span> scheduled</span>
            ) : (
              <span className="text-green-700"><span className="font-semibold">{sendAllResult.summary.sent}</span> sent</span>
            )}
            <span className="text-amber-700"><span className="font-semibold">{sendAllResult.summary.skipped}</span> skipped</span>
            <span className="text-red-700"><span className="font-semibold">{sendAllResult.summary.failed}</span> failed</span>
            <span className="text-muted-foreground">of {sendAllResult.summary.total} segments</span>
          </div>
          <ul className="space-y-1.5">
            {sendAllResult.results.map((r) => (
              <li key={r.segmentId} className="flex items-start gap-2 text-sm border-b border-border/40 pb-1.5">
                {r.status === "sent" || r.status === "scheduled" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : r.status === "skipped" ? (
                  <MinusCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-medium">{r.name}</span>{" "}
                  <span className="text-muted-foreground">— {r.status}</span>
                  {r.status === "scheduled" && r.scheduledFor ? (
                    <span className="text-muted-foreground"> · {format(new Date(r.scheduledFor), "MMM d, yyyy 'at' h:mm a")}</span>
                  ) : null}
                  {r.message && <span className="text-muted-foreground"> · {r.message}</span>}
                  {r.totalSkipped ? (
                    <span className="text-muted-foreground"> ({r.totalSkipped} recipient{r.totalSkipped === 1 ? "" : "s"} suppressed)</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading segments…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(segments || []).map((s) => (
          <Card key={s.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{s.name}</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parseArray<string>(s.contactTypes).map((t) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </div>
              {canMutate && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-bold text-primary">{s.audienceCount}</span>
              <span className="text-muted-foreground">in audience</span>
            </div>
            {s.performance.total > 0 && <PerfBar p={s.performance} />}
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-2"
                disabled={send.isPending || s.audienceCount === 0}
                onClick={() => handleSend(s)}
              >
                <Send className="h-3.5 w-3.5" /> Send now
              </Button>
            )}
          </Card>
        ))}
      </div>

      {!isLoading && (!segments || segments.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">
          No segments yet. Create one to target a slice of your contacts.
        </Card>
      )}

      {showModal && (
        <Modal title={editId ? "Edit Segment" : "New Segment"} onClose={() => setShowModal(false)} wide>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <Field label="Name *">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>

            <div>
              <label className="text-sm font-medium block mb-1">Contact types</label>
              <div className="flex flex-wrap gap-2">
                {(contactTypes || []).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1 rounded-full text-xs border ${
                      form.contactTypes.includes(t)
                        ? "bg-primary text-white border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status filter">
                <input className={inputCls} placeholder="e.g. new" value={form.filterRules.status || ""} onChange={(e) => setForm({ ...form, filterRules: { ...form.filterRules, status: e.target.value } })} />
              </Field>
              <Field label="Source filter">
                <input className={inputCls} value={form.filterRules.source || ""} onChange={(e) => setForm({ ...form, filterRules: { ...form.filterRules, source: e.target.value } })} />
              </Field>
              <Field label="Industry filter">
                <input className={inputCls} value={form.filterRules.industry || ""} onChange={(e) => setForm({ ...form, filterRules: { ...form.filterRules, industry: e.target.value } })} />
              </Field>
              <Field label="Search (name/company/email)">
                <input className={inputCls} value={form.filterRules.search || ""} onChange={(e) => setForm({ ...form, filterRules: { ...form.filterRules, search: e.target.value } })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sequence">
                <select className={inputCls} value={form.sequenceId} onChange={(e) => setForm({ ...form, sequenceId: e.target.value })}>
                  <option value="">Use campaign default</option>
                  {templateSets.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Sender name">
                <input className={inputCls} value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
              </Field>
              <Field label="Sender email">
                <input className={inputCls} value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} />
              </Field>
              <Field label="Reply-to">
                <input className={inputCls} value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} />
              </Field>
            </div>

            <Field label="Notes">
              <textarea className={`${inputCls} min-h-[60px]`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>

            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
              <Button type="button" size="sm" variant="outline" onClick={runPreview} disabled={preview.isPending}>
                {preview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Preview audience"}
              </Button>
              {previewCount != null && (
                <span className="text-sm">
                  <span className="font-bold text-primary">{previewCount}</span> contacts match
                </span>
              )}
            </div>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} saving={create.isPending || update.isPending} saveLabel={editId ? "Update" : "Create"} />
        </Modal>
      )}

      {showSendAll && (
        <Modal title="Send all segments" onClose={() => setShowSendAll(false)}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              This runs a send for every segment in this campaign ({segmentCount}), using each
              segment's own template, sender, and audience. Segments with no template or an empty
              audience are skipped.
            </p>
            <Field label="When">
              <select
                className={inputCls}
                value={sendAllForm.mode}
                onChange={(e) => setSendAllForm({ ...sendAllForm, mode: e.target.value as "send_now" | "schedule" })}
              >
                <option value="send_now">Send now</option>
                <option value="schedule">Schedule for later</option>
              </select>
            </Field>
            {sendAllForm.mode === "schedule" && (
              <>
                <Field label="Timing">
                  <select
                    className={inputCls}
                    value={sendAllForm.scheduleStyle}
                    onChange={(e) =>
                      setSendAllForm({
                        ...sendAllForm,
                        scheduleStyle: e.target.value as "same" | "stagger" | "custom",
                      })
                    }
                  >
                    <option value="same">Same time for all segments</option>
                    <option value="stagger">Stagger by interval</option>
                    <option value="custom">Custom time per segment</option>
                  </select>
                </Field>

                {sendAllForm.scheduleStyle !== "custom" && (
                  <Field label={sendAllForm.scheduleStyle === "stagger" ? "First segment at *" : "Send at *"}>
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={sendAllForm.scheduledFor}
                      onChange={(e) => setSendAllForm({ ...sendAllForm, scheduledFor: e.target.value })}
                    />
                  </Field>
                )}

                {sendAllForm.scheduleStyle === "stagger" && (
                  <Field label="Stagger between segments (minutes) *">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={inputCls}
                      value={sendAllForm.staggerMinutes}
                      onChange={(e) => setSendAllForm({ ...sendAllForm, staggerMinutes: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Each segment goes out this many minutes after the previous one, in the order
                      shown below.
                    </p>
                  </Field>
                )}

                {sendAllForm.scheduleStyle === "stagger" && (() => {
                  const base = sendAllForm.scheduledFor ? new Date(sendAllForm.scheduledFor) : null;
                  const stagger = Number(sendAllForm.staggerMinutes);
                  const validBase = base && !isNaN(base.getTime());
                  const validStagger = Number.isFinite(stagger) && stagger > 0;
                  const ordered = [...(segments || [])].sort((a, b) => a.id - b.id);
                  if (ordered.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Schedule preview</p>
                      {validBase && validStagger ? (
                        <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                          {ordered.map((s, i) => {
                            // Mirror the backend skip rules (executeSegmentSend):
                            // a segment with no template or an empty audience will
                            // be skipped at send time. Skipped segments still
                            // consume a stagger slot on the backend, so non-skipped
                            // segments keep their position-based (i) send time.
                            const willSkip = !s.templateId || s.audienceCount === 0;
                            const skipReason = !s.templateId
                              ? "no template"
                              : "empty audience";
                            const when = new Date(base!.getTime());
                            when.setMinutes(when.getMinutes() + i * Math.floor(stagger));
                            return (
                              <li
                                key={s.id}
                                className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-1.5"
                              >
                                <span className={`truncate ${willSkip ? "text-muted-foreground/60" : ""}`}>
                                  {s.name}
                                </span>
                                {willSkip ? (
                                  <span className="shrink-0 text-xs italic text-muted-foreground/60">
                                    will be skipped — {skipReason}
                                  </span>
                                ) : (
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {format(when, "MMM d, h:mm a")}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Set a first send time and a stagger interval to preview each segment's
                          send time.
                        </p>
                      )}
                    </div>
                  );
                })()}

                {sendAllForm.scheduleStyle === "custom" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Pick a time for each segment. Segments left blank are skipped.
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(segments || []).map((s) => (
                        <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                          <span className="text-sm truncate">{s.name}</span>
                          <input
                            type="datetime-local"
                            className={inputCls + " w-auto"}
                            value={sendAllForm.segmentTimes[s.id] || ""}
                            onChange={(e) =>
                              setSendAllForm({
                                ...sendAllForm,
                                segmentTimes: { ...sendAllForm.segmentTimes, [s.id]: e.target.value },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <ModalFooter
            onCancel={() => setShowSendAll(false)}
            onSave={handleSendAll}
            saving={sendAll.isPending}
            saveLabel={sendAllForm.mode === "schedule" ? "Schedule all" : "Send all"}
          />
        </Modal>
      )}
    </div>
  );
}

function cleanFilters(f: SegmentFilterRules): SegmentFilterRules {
  const out: SegmentFilterRules = {};
  (Object.keys(f) as (keyof SegmentFilterRules)[]).forEach((k) => {
    const v = f[k];
    if (v && v.trim()) out[k] = v.trim();
  });
  return out;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------
function AssetsTab({ campaignId, canMutate }: { campaignId: number; canMutate: boolean }) {
  const { data: assets, isLoading } = useAssets(campaignId);
  const { create, remove } = useAssetMutations(campaignId);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadCampaignFile(file);
      await create.mutateAsync({
        title: up.name,
        contentType: up.contentType,
        objectPath: up.objectPath,
      });
      toast({ title: "Asset uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = (id: number) => {
    remove.mutate(id, {
      onSuccess: () => toast({ title: "Asset removed" }),
      onError: (e: any) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Upload images, PDFs, or attach links for this campaign.</p>
        {canMutate && (
          <>
            <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
            <Button onClick={() => fileRef.current?.click()} className="rounded-xl gap-2" disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Asset
            </Button>
          </>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading assets…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(assets || []).map((a) => (
          <Card key={a.id} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="font-medium truncate">{a.title}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{a.contentType || "link"}</p>
              {(a.objectPath || a.url) && (
                <a
                  href={a.url || storageObjectUrl(a.objectPath!)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1 mt-2"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {canMutate && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => handleDelete(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </Card>
        ))}
      </div>

      {!isLoading && (!assets || assets.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">No assets yet.</Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------
function ScheduleTab({
  campaignId,
  canMutate,
  canManage,
  templateSets,
}: {
  campaignId: number;
  canMutate: boolean;
  canManage: boolean;
  templateSets: any[];
}) {
  const { data: schedules, isLoading } = useSchedules(campaignId);
  const { data: segments } = useSegments(campaignId);
  const { create, remove, run } = useScheduleMutations(campaignId);
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ label: "", segmentId: "", scheduledFor: "", sendWindowStart: "", sendWindowEnd: "" });

  const openNew = () => {
    setForm({ label: "", segmentId: "", scheduledFor: "", sendWindowStart: "", sendWindowEnd: "" });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.segmentId) return toast({ title: "Pick a segment", variant: "destructive" });
    if (!form.scheduledFor) return toast({ title: "Pick a date/time", variant: "destructive" });
    create.mutate(
      {
        label: form.label || null,
        segmentId: Number(form.segmentId),
        scheduledFor: new Date(form.scheduledFor).toISOString(),
        sendWindowStart: form.sendWindowStart || null,
        sendWindowEnd: form.sendWindowEnd || null,
      },
      {
        onSuccess: () => { setShowModal(false); toast({ title: "Schedule created" }); },
        onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handleRun = (id: number) => {
    run.mutate(id, {
      onSuccess: () => toast({ title: "Schedule run started" }),
      onError: (e: any) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    remove.mutate(id, {
      onSuccess: () => toast({ title: "Schedule deleted" }),
      onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });
  };

  const segName = (sid?: number | null) =>
    sid ? segments?.find((s) => s.id === sid)?.name || `Segment ${sid}` : "Whole campaign";

  const minutesToTime = (m?: number | null) => {
    if (m == null) return "";
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Schedule staggered sends, each targeting a specific segment.</p>
        {canMutate && (
          <Button onClick={openNew} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" /> New Schedule
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading schedules…</p>}

      <div className="space-y-3">
        {(schedules || []).map((s) => (
          <Card key={s.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{s.label || segName(s.segmentId)}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(s.scheduledFor), "MMM d, yyyy 'at' h:mm a")} · {segName(s.segmentId)}
                  {s.sendWindowStart != null && s.sendWindowEnd != null ? ` · window ${minutesToTime(s.sendWindowStart)}–${minutesToTime(s.sendWindowEnd)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={s.status === "sent" ? "default" : "secondary"}>{s.status || "scheduled"}</Badge>
              {canManage && (
                <Button variant="outline" size="sm" className="rounded-xl gap-1" disabled={run.isPending} onClick={() => handleRun(s.id)}>
                  <Play className="h-3.5 w-3.5" /> Run
                </Button>
              )}
              {canMutate && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {!isLoading && (!schedules || schedules.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">No schedules yet.</Card>
      )}

      {showModal && (
        <Modal title="New Schedule" onClose={() => setShowModal(false)}>
          <div className="p-6 space-y-4">
            <Field label="Label">
              <input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
            <Field label="Segment *">
              <select className={inputCls} value={form.segmentId} onChange={(e) => setForm({ ...form, segmentId: e.target.value })}>
                <option value="">Select a segment…</option>
                {(segments || []).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Send at *">
              <input type="datetime-local" className={inputCls} value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Window start (HH:MM)">
                <input type="time" className={inputCls} value={form.sendWindowStart} onChange={(e) => setForm({ ...form, sendWindowStart: e.target.value })} />
              </Field>
              <Field label="Window end (HH:MM)">
                <input type="time" className={inputCls} value={form.sendWindowEnd} onChange={(e) => setForm({ ...form, sendWindowEnd: e.target.value })} />
              </Field>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowModal(false)} onSave={handleSave} saving={create.isPending} saveLabel="Create" />
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts (resolved audience across all segments)
// ---------------------------------------------------------------------------
function ContactsTab({ campaignId }: { campaignId: number }) {
  const { data: segments, isLoading } = useSegments(campaignId);
  const [selected, setSelected] = useState<number | null>(null);

  const activeSegment = useMemo(
    () => (selected != null ? selected : segments?.[0]?.id ?? null),
    [selected, segments],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(segments || []).map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`px-3 py-1.5 rounded-xl text-sm border ${
              activeSegment === s.id ? "bg-primary text-white border-primary" : "bg-background border-border"
            }`}
          >
            {s.name} ({s.audienceCount})
          </button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (!segments || segments.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">Create a segment to see its contacts.</Card>
      )}
      {activeSegment != null && <SegmentContacts segmentId={activeSegment} />}
    </div>
  );
}

function SegmentContacts({ segmentId }: { segmentId: number }) {
  const { data, isLoading } = useSegmentAudience(segmentId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading contacts…</p>;
  if (!data || data.count === 0) return <Card className="p-8 text-center text-muted-foreground">No matching contacts.</Card>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.contacts.map((c) => (
              <tr key={c.id} className="border-t border-border/50">
                <td className="px-4 py-2">{c.companyName || "—"}</td>
                <td className="px-4 py-2">{c.contactName || "—"}</td>
                <td className="px-4 py-2">{c.email || "—"}</td>
                <td className="px-4 py-2">{c.contactType || "—"}</td>
                <td className="px-4 py-2">
                  {c.isUnsubscribed ? (
                    <Badge variant="destructive">Unsubscribed</Badge>
                  ) : c.isBounced ? (
                    <Badge variant="destructive">Bounced</Badge>
                  ) : (
                    <Badge variant="secondary">{c.status || "active"}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------
function PerformanceTab({ campaignId }: { campaignId: number }) {
  const { data: perf, isLoading } = useCampaignPerformance(campaignId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading performance…</p>;
  if (!perf) return null;
  const t = perf.totals;
  const stat = (label: string, n: number, cls: string) => (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cls}`}>{n}</p>
    </Card>
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stat("Total", t.total, "")}
        {stat("Sent", t.sent, "text-green-700")}
        {stat("Scheduled", t.scheduled, "text-blue-700")}
        {stat("Queued", t.queued, "text-amber-700")}
        {stat("Failed", t.failed, "text-red-700")}
      </div>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">By segment</h3>
        {perf.segments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No segments yet.</p>
        ) : (
          <div className="space-y-3">
            {perf.segments.map((s) => (
              <div key={s.segmentId} className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="font-medium">{s.name}</span>
                <PerfBar p={s.performance} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity (derived from schedules + segment send state)
// ---------------------------------------------------------------------------
function ActivityTab({ campaignId }: { campaignId: number }) {
  const { data: schedules } = useSchedules(campaignId);
  const { data: segments } = useSegments(campaignId);

  const events: Array<{ when: string; text: string }> = [];
  (schedules || []).forEach((s) => {
    if (s.lastRunAt) events.push({ when: s.lastRunAt, text: `Schedule "${s.label || "send"}" ran` });
    events.push({ when: s.createdAt, text: `Schedule "${s.label || "send"}" created` });
  });
  (segments || []).forEach((s) => {
    if (s.lastBulkCampaignId) events.push({ when: "", text: `Segment "${s.name}" has an active send` });
  });
  events.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  if (events.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">No activity yet.</Card>;
  }
  return (
    <Card className="p-5">
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p>{e.text}</p>
              {e.when && <p className="text-xs text-muted-foreground">{format(new Date(e.when), "MMM d, yyyy 'at' h:mm a")}</p>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared modal primitives
// ---------------------------------------------------------------------------
const inputCls = "w-full px-3 py-2 border border-border rounded-xl text-sm bg-background";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative bg-card rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} border border-border z-10`}>
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, saveLabel }: { onCancel: () => void; onSave: () => void; saving?: boolean; saveLabel: string }) {
  return (
    <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
      <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
      <Button onClick={onSave} className="rounded-xl bg-primary text-white" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveLabel}
      </Button>
    </div>
  );
}
