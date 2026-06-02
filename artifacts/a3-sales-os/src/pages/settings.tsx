import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Mail, Clock, Shield, Zap, RefreshCw, ExternalLink, Plug, Play, Pause, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface SettingsData {
  primary_send_provider: string;
  weekday_sending_only: string;
  sending_start_hour: string;
  sending_end_hour: string;
  default_timezone: string;
  throttle_per_hour: string;
  min_delay_between_emails_seconds: string;
  max_delay_between_emails_seconds: string;
  auto_stop_on_human_reply: string;
  ignore_auto_replies: string;
  review_uncertain_replies: string;
  scheduler_enabled: string;
  outlook_sync_interval_minutes: string;
}

interface SchedulerStatus {
  running: boolean;
  lastFollowUpRun: string | null;
  lastSyncRun: string | null;
  pendingFollowUps: number;
  sendProvider: string;
  outlookConfigured: boolean;
  outlookConnected: boolean;
}

interface OutlookStatus {
  configured: boolean;
  connectionCount: number;
  primaryEmail: string | null;
  connections: Array<{
    id: number;
    emailAddress: string;
    displayName: string;
    isPrimary: boolean;
    isActive: boolean;
    lastSyncedAt: string | null;
    syncError: string | null;
    tokenExpiresAt: string | null;
  }>;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [outlook, setOutlook] = useState<OutlookStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    fetch(`${API_BASE}/settings`).then(r => r.json()).then(setSettings).catch(() => {});
    fetch(`${API_BASE}/scheduler/status`).then(r => r.json()).then(setScheduler).catch(() => {});
    fetch(`${API_BASE}/outlook/status`).then(r => r.json()).then(setOutlook).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const save = async (updates: Partial<SettingsData>) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSettings(data);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleScheduler = async (action: "start" | "stop") => {
    try {
      const res = await fetch(`${API_BASE}/scheduler/${action}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setScheduler(data);
      toast({ title: action === "start" ? "Scheduler started" : "Scheduler stopped" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const connectOutlook = async () => {
    try {
      const res = await fetch(`${API_BASE}/outlook/auth-url`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
      else toast({ title: data.message || "Outlook not configured", variant: "destructive" });
    } catch {
      toast({ title: "Failed to get auth URL", variant: "destructive" });
    }
  };

  const syncMailbox = async (connId: number) => {
    setSyncing(connId);
    try {
      const res = await fetch(`${API_BASE}/outlook/connections/${connId}/sync`, { method: "POST" });
      const data = await res.json();
      toast({ title: `Synced: ${data.newMessages || 0} new, ${data.syncedOutbound || 0} outbound` });
      load();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    }
    setSyncing(null);
  };

  const disconnectMailbox = async (connId: number) => {
    try {
      await fetch(`${API_BASE}/outlook/connections/${connId}`, { method: "DELETE" });
      toast({ title: "Mailbox disconnected" });
      load();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const setPrimary = async (connId: number) => {
    try {
      await fetch(`${API_BASE}/outlook/connections/${connId}/primary`, { method: "PATCH" });
      toast({ title: "Primary mailbox updated" });
      load();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  if (!settings) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure email, scheduling, and integrations</p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Plug className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Outlook / Microsoft 365</h2>
              <p className="text-sm text-muted-foreground">Connect your mailbox for sending, receiving, and thread tracking</p>
            </div>
            {outlook?.configured ? (
              <Badge variant="outline" className="ml-auto text-green-600 border-green-300">Configured</Badge>
            ) : (
              <Badge variant="outline" className="ml-auto text-amber-600 border-amber-300">Not Configured</Badge>
            )}
          </div>

          {!outlook?.configured && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Outlook integration requires Azure app credentials</p>
                  <p className="text-sm text-amber-700 mt-1">Set <code className="bg-amber-100 px-1 rounded">OUTLOOK_CLIENT_ID</code>, <code className="bg-amber-100 px-1 rounded">OUTLOOK_CLIENT_SECRET</code>, and optionally <code className="bg-amber-100 px-1 rounded">OUTLOOK_TENANT_ID</code> as environment variables.</p>
                </div>
              </div>
            </div>
          )}

          {outlook?.connections && outlook.connections.length > 0 ? (
            <div className="space-y-3">
              {outlook.connections.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{conn.emailAddress}</div>
                      <div className="text-xs text-muted-foreground">
                        {conn.displayName}
                        {conn.lastSyncedAt && ` · Last sync: ${new Date(conn.lastSyncedAt).toLocaleString()}`}
                      </div>
                      {conn.syncError && <div className="text-xs text-red-500 mt-0.5">{conn.syncError}</div>}
                    </div>
                    {conn.isPrimary && <Badge className="text-xs">Primary</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {!conn.isPrimary && (
                      <Button size="sm" variant="ghost" onClick={() => setPrimary(conn.id)}>Set Primary</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => syncMailbox(conn.id)} disabled={syncing === conn.id}>
                      {syncing === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => disconnectMailbox(conn.id)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : outlook?.configured ? (
            <p className="text-sm text-muted-foreground mb-4">No mailboxes connected yet.</p>
          ) : null}

          {outlook?.configured && (
            <Button className="mt-4" onClick={connectOutlook}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Outlook Mailbox
            </Button>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Background Scheduler</h2>
              <p className="text-sm text-muted-foreground">Automatic follow-up processing and inbox sync</p>
            </div>
            {scheduler?.running ? (
              <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">Running</Badge>
            ) : (
              <Badge variant="outline" className="ml-auto text-gray-500">Stopped</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold">{scheduler?.pendingFollowUps ?? "-"}</div>
              <div className="text-xs text-muted-foreground">Pending Follow-ups</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium">{scheduler?.sendProvider || "resend"}</div>
              <div className="text-xs text-muted-foreground">Send Provider</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium">{scheduler?.lastFollowUpRun ? new Date(scheduler.lastFollowUpRun).toLocaleTimeString() : "—"}</div>
              <div className="text-xs text-muted-foreground">Last Follow-up Run</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm font-medium">{scheduler?.lastSyncRun ? new Date(scheduler.lastSyncRun).toLocaleTimeString() : "—"}</div>
              <div className="text-xs text-muted-foreground">Last Sync Run</div>
            </div>
          </div>

          <div className="flex gap-3">
            {scheduler?.running ? (
              <Button variant="outline" onClick={() => toggleScheduler("stop")}>
                <Pause className="h-4 w-4 mr-2" /> Stop Scheduler
              </Button>
            ) : (
              <Button onClick={() => toggleScheduler("start")}>
                <Play className="h-4 w-4 mr-2" /> Start Scheduler
              </Button>
            )}
            <Button variant="ghost" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh Status
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold">Email Sending</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Primary Send Provider</div>
                <div className="text-sm text-muted-foreground">Choose how outbound emails are sent</div>
              </div>
              <select
                value={settings.primary_send_provider}
                onChange={(e) => save({ primary_send_provider: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="resend">Resend (default)</option>
                <option value="outlook">Outlook / Microsoft 365</option>
                <option value="gmail">Gmail / Google Workspace</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Throttle Per Hour</div>
                <div className="text-sm text-muted-foreground">Maximum emails sent per hour</div>
              </div>
              <input
                type="number"
                value={settings.throttle_per_hour}
                onChange={(e) => setSettings(s => s ? { ...s, throttle_per_hour: e.target.value } : s)}
                onBlur={() => save({ throttle_per_hour: settings.throttle_per_hour })}
                className="w-20 border rounded-lg px-3 py-2 text-sm text-right"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Min Delay Between Sends (seconds)</div>
                <div className="text-sm text-muted-foreground">Minimum gap between consecutive sends</div>
              </div>
              <input
                type="number"
                value={settings.min_delay_between_emails_seconds}
                onChange={(e) => setSettings(s => s ? { ...s, min_delay_between_emails_seconds: e.target.value } : s)}
                onBlur={() => save({ min_delay_between_emails_seconds: settings.min_delay_between_emails_seconds })}
                className="w-20 border rounded-lg px-3 py-2 text-sm text-right"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold">Send Window</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Weekday Sending Only</div>
                <div className="text-sm text-muted-foreground">Only send on Monday through Friday</div>
              </div>
              <Switch
                checked={settings.weekday_sending_only === "true"}
                onCheckedChange={(checked) => save({ weekday_sending_only: checked ? "true" : "false" })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Send Start Hour</div>
                <div className="text-sm text-muted-foreground">Earliest hour to send (24h format)</div>
              </div>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.sending_start_hour}
                onChange={(e) => setSettings(s => s ? { ...s, sending_start_hour: e.target.value } : s)}
                onBlur={() => save({ sending_start_hour: settings.sending_start_hour })}
                className="w-20 border rounded-lg px-3 py-2 text-sm text-right"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Send End Hour</div>
                <div className="text-sm text-muted-foreground">Latest hour to send (24h format)</div>
              </div>
              <input
                type="number"
                min="0"
                max="23"
                value={settings.sending_end_hour}
                onChange={(e) => setSettings(s => s ? { ...s, sending_end_hour: e.target.value } : s)}
                onBlur={() => save({ sending_end_hour: settings.sending_end_hour })}
                className="w-20 border rounded-lg px-3 py-2 text-sm text-right"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Timezone</div>
                <div className="text-sm text-muted-foreground">Default timezone for send windows</div>
              </div>
              <select
                value={settings.default_timezone}
                onChange={(e) => save({ default_timezone: e.target.value })}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="America/Los_Angeles">Pacific (LA)</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Chicago">Central</option>
                <option value="America/New_York">Eastern (NY)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold">Reply Intelligence</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Auto-Stop on Human Reply</div>
                <div className="text-sm text-muted-foreground">Automatically pause sequences when a real reply is detected</div>
              </div>
              <Switch
                checked={settings.auto_stop_on_human_reply === "true"}
                onCheckedChange={(checked) => save({ auto_stop_on_human_reply: checked ? "true" : "false" })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Ignore Auto-Replies</div>
                <div className="text-sm text-muted-foreground">Do not count OOO, auto-responses, or read receipts as real replies</div>
              </div>
              <Switch
                checked={settings.ignore_auto_replies === "true"}
                onCheckedChange={(checked) => save({ ignore_auto_replies: checked ? "true" : "false" })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Review Uncertain Replies</div>
                <div className="text-sm text-muted-foreground">Queue ambiguous replies for manual review before acting</div>
              </div>
              <Switch
                checked={settings.review_uncertain_replies === "true"}
                onCheckedChange={(checked) => save({ review_uncertain_replies: checked ? "true" : "false" })}
              />
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
