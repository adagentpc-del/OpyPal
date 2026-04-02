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
  BarChart3,
  Send,
  Clock,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Settings,
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
  const [dailyCap, setDailyCap] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");

  const openSettings = () => {
    const getVal = (key: string, def: string) => {
      const s = (settings || []).find((s: any) => s.key === key);
      return s?.value || def;
    };
    setDailyCap(getVal("daily_send_cap", "50"));
    setWindowStart(getVal("send_window_start", "8"));
    setWindowEnd(getVal("send_window_end", "18"));
    setShowSettings(true);
  };

  const saveSettings = () => {
    updateSettings.mutate({
      data: {
        settings: [
          { key: "daily_send_cap", value: dailyCap },
          { key: "send_window_start", value: windowStart },
          { key: "send_window_end", value: windowEnd },
        ],
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
    { label: "Imported Today", value: analytics?.importedToday || 0, icon: Users, color: "text-purple-600" },
    { label: "Sent Today", value: analytics?.sentToday || 0, icon: Send, color: "text-green-600" },
    { label: "Scheduled Today", value: analytics?.scheduledToday || 0, icon: Clock, color: "text-amber-600" },
    { label: "Scheduled Tomorrow", value: analytics?.scheduledTomorrow || 0, icon: Clock, color: "text-blue-500" },
    { label: "Replied", value: analytics?.pausedReplied || 0, icon: MessageCircle, color: "text-emerald-600" },
    { label: "Completed", value: analytics?.completed || 0, icon: CheckCircle2, color: "text-green-700" },
    { label: "Bounced", value: analytics?.bouncedCount || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Reactivation Due", value: analytics?.reactivationDue || 0, icon: RefreshCw, color: "text-orange-600" },
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold">Outbound Settings</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Daily Send Cap</label>
                <input type="number" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                <p className="text-xs text-muted-foreground mt-1">Maximum emails sent per day</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Send Window Start</label>
                  <input type="number" value={windowStart} onChange={(e) => setWindowStart(e.target.value)}
                    min="0" max="23"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                  <p className="text-xs text-muted-foreground mt-1">Hour (0-23)</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Send Window End</label>
                  <input type="number" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)}
                    min="0" max="23"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
                  <p className="text-xs text-muted-foreground mt-1">Hour (0-23)</p>
                </div>
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
