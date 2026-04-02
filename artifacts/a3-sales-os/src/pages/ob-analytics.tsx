import { AppLayout } from "@/components/layout";
import {
  useGetOutboundAnalytics,
  useGetSendLogs,
  useGetOutboundSettings,
  useUpdateOutboundSettings,
  getGetOutboundSettingsQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Send,
  Clock,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Settings,
  Flame,
  Thermometer,
  Snowflake,
  Eye,
  MousePointerClick,
  Ban,
  MailX,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function ObAnalytics() {
  const { data: analytics } = useGetOutboundAnalytics();
  const { data: sendLogs } = useGetSendLogs({ limit: 20 });
  const { data: settings } = useGetOutboundSettings();
  const updateSettings = useUpdateOutboundSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const getVal = (key: string, def: string) => {
    const s = (settings || []).find((s: any) => s.key === key);
    return s?.value || def;
  };

  const openSettings = () => {
    setSettingsForm({
      daily_send_cap: getVal("daily_send_cap", "50"),
      per_inbox_send_cap: getVal("per_inbox_send_cap", "25"),
      send_window_start: getVal("send_window_start", "8"),
      send_window_end: getVal("send_window_end", "18"),
      business_days_only: getVal("business_days_only", "true"),
      randomized_spacing: getVal("randomized_spacing", "true"),
      reply_detection_interval: getVal("reply_detection_interval", "60"),
      tracking_domain: getVal("tracking_domain", ""),
    });
    setShowSettings(true);
  };

  const saveSettings = () => {
    updateSettings.mutate({
      data: {
        settings: Object.entries(settingsForm).map(([key, value]) => ({ key, value })),
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOutboundSettingsQueryKey() });
        setShowSettings(false);
        toast({ title: "Settings saved" });
      },
    });
  };

  const kpis = [
    { label: "Total Contacts", value: analytics?.totalContacts || 0, icon: Users, color: "text-primary" },
    { label: "Active Sequences", value: analytics?.activeSequences || 0, icon: RefreshCw, color: "text-blue-600" },
    { label: "Sent Today", value: analytics?.sentToday || 0, icon: Send, color: "text-green-600" },
    { label: "Scheduled Today", value: analytics?.scheduledToday || 0, icon: Clock, color: "text-amber-600" },
    { label: "Replied", value: analytics?.pausedReplied || 0, icon: MessageCircle, color: "text-emerald-600" },
    { label: "Completed", value: analytics?.completed || 0, icon: CheckCircle2, color: "text-green-700" },
    { label: "Bounced", value: analytics?.bouncedCount || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "DNC", value: analytics?.dncCount || 0, icon: Ban, color: "text-red-500" },
    { label: "Unsubscribed", value: analytics?.unsubscribedCount || 0, icon: MailX, color: "text-amber-500" },
    { label: "Reactivation Due", value: analytics?.reactivationDue || 0, icon: RefreshCw, color: "text-orange-600" },
  ];

  const engagementMetrics = [
    { label: "Total Sent", value: analytics?.totalSent || 0, icon: Send, color: "text-primary" },
    { label: "Open Rate", value: analytics?.openRate || "0%", icon: Eye, color: "text-blue-600" },
    { label: "Click Rate", value: analytics?.clickRate || "0%", icon: MousePointerClick, color: "text-green-600" },
    { label: "Reply Rate", value: analytics?.replyRate || "0%", icon: MessageCircle, color: "text-emerald-600" },
    { label: "Bounce Rate", value: analytics?.bounceRate || "0%", icon: AlertTriangle, color: "text-red-600" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Outbound Analytics</h1>
            <p className="text-muted-foreground mt-1">Overview of your outbound engine performance.</p>
          </div>
          <Button variant="outline" onClick={openSettings} className="rounded-xl gap-2">
            <Settings className="h-4 w-4" /> Settings
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map(kpi => (
            <Card key={kpi.label} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {engagementMetrics.map(m => (
            <Card key={m.label} className="p-4 border-2 border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              </div>
              <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">By Engagement Tier</h3>
            {analytics?.byTier && analytics.byTier.length > 0 ? (
              <div className="space-y-3">
                {analytics.byTier.map((t: any) => {
                  const cfg = t.tier === "hot" ? { icon: Flame, color: "text-red-600", bg: "bg-red-50" }
                    : t.tier === "warm" ? { icon: Thermometer, color: "text-amber-600", bg: "bg-amber-50" }
                    : { icon: Snowflake, color: "text-blue-400", bg: "bg-blue-50" };
                  const Icon = cfg.icon;
                  return (
                    <div key={t.tier} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                          <Icon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <span className={`font-semibold capitalize ${cfg.color}`}>{t.tier}</span>
                      </div>
                      <span className="text-lg font-bold">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">No tier data yet.</p>}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">By Segment</h3>
            {analytics?.bySegment && analytics.bySegment.length > 0 ? (
              <div className="space-y-2">
                {analytics.bySegment.map((s: any) => (
                  <div key={s.segment} className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{s.segment}</span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No segment data yet.</p>}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">By Campaign</h3>
            {analytics?.byCampaign && analytics.byCampaign.length > 0 ? (
              <div className="space-y-2">
                {analytics.byCampaign.map((c: any) => (
                  <div key={c.campaign} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.campaign}</span>
                    <span className="text-muted-foreground">{c.count} contacts</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No campaign data yet.</p>}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">By Sequence Step</h3>
            {analytics?.byStep && analytics.byStep.length > 0 ? (
              <div className="space-y-2">
                {analytics.byStep.map((s: any) => (
                  <div key={s.step} className="flex items-center justify-between text-sm">
                    <span className="font-medium">Step {s.step}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((s.count / (analytics.activeSequences || 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-muted-foreground w-8 text-right">{s.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No step data yet.</p>}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Top Engaged Contacts</h3>
            {analytics?.topEngaged && analytics.topEngaged.length > 0 ? (
              <div className="space-y-2">
                {analytics.topEngaged.map((c: any) => {
                  const cfg = c.engagementTier === "hot" ? { icon: Flame, color: "text-red-600" }
                    : c.engagementTier === "warm" ? { icon: Thermometer, color: "text-amber-600" }
                    : { icon: Snowflake, color: "text-blue-400" };
                  const Icon = cfg.icon;
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                      <div>
                        <span className="font-medium">{c.fullName}</span>
                        <span className="text-muted-foreground"> ({c.company})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        <span className={`font-bold ${cfg.color}`}>{c.engagementScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">No engaged contacts yet.</p>}
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Recent Send Activity</h3>
          {sendLogs && sendLogs.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {sendLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2">
                  <div className="flex-1">
                    <span className="font-medium">{log.contactName}</span>
                    <span className="text-muted-foreground"> ({log.company})</span>
                    {log.subject && <span className="text-muted-foreground ml-2">- {log.subject}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {log.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(new Date(log.sentAt), "MMM d, h:mm a")}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No sends yet.</p>}
        </Card>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border z-10">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold">Outbound Settings</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Daily Send Cap</label>
                  <input type="number" value={settingsForm.daily_send_cap}
                    onChange={(e) => setSettingsForm({ ...settingsForm, daily_send_cap: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Per-Inbox Cap</label>
                  <input type="number" value={settingsForm.per_inbox_send_cap}
                    onChange={(e) => setSettingsForm({ ...settingsForm, per_inbox_send_cap: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Send Window Start (hr)</label>
                  <input type="number" value={settingsForm.send_window_start} min="0" max="23"
                    onChange={(e) => setSettingsForm({ ...settingsForm, send_window_start: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Send Window End (hr)</label>
                  <input type="number" value={settingsForm.send_window_end} min="0" max="23"
                    onChange={(e) => setSettingsForm({ ...settingsForm, send_window_end: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Reply Detection Interval (min)</label>
                <input type="number" value={settingsForm.reply_detection_interval}
                  onChange={(e) => setSettingsForm({ ...settingsForm, reply_detection_interval: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Tracking Domain</label>
                <input type="text" value={settingsForm.tracking_domain} placeholder="e.g., track.a3visual.com"
                  onChange={(e) => setSettingsForm({ ...settingsForm, tracking_domain: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={settingsForm.business_days_only === "true"}
                    onChange={(e) => setSettingsForm({ ...settingsForm, business_days_only: String(e.target.checked) })}
                    className="rounded" />
                  Business days only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={settingsForm.randomized_spacing === "true"}
                    onChange={(e) => setSettingsForm({ ...settingsForm, randomized_spacing: String(e.target.checked) })}
                    className="rounded" />
                  Randomized spacing
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSettings(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={saveSettings} className="rounded-xl bg-primary text-white">Save</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
