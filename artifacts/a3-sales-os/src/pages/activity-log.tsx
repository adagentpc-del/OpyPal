import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Search, Filter, RefreshCw, Mail, MessageSquare, Zap, AlertTriangle, CheckCircle2, XCircle, Send, Eye, UserCheck, Clock } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL + "api";

interface ActivityItem {
  id: number;
  type: string;
  description: string;
  leadId: number | null;
  metadata: any;
  createdBy: string | null;
  createdAt: string;
  relatedTemplateId: number | null;
  relatedSequenceId: number | null;
  relatedScheduledEmailId: number | null;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  email_sent: { icon: Send, color: "text-green-600 bg-green-100", label: "Email Sent" },
  email_failed: { icon: XCircle, color: "text-red-600 bg-red-100", label: "Send Failed" },
  email_delivered: { icon: CheckCircle2, color: "text-green-600 bg-green-100", label: "Delivered" },
  email_opened: { icon: Eye, color: "text-blue-600 bg-blue-100", label: "Opened" },
  email_clicked: { icon: Zap, color: "text-purple-600 bg-purple-100", label: "Clicked" },
  reply_received: { icon: MessageSquare, color: "text-emerald-600 bg-emerald-100", label: "Reply" },
  reply_logged: { icon: MessageSquare, color: "text-emerald-600 bg-emerald-100", label: "Reply Logged" },
  reply_confirmed: { icon: CheckCircle2, color: "text-green-600 bg-green-100", label: "Reply Confirmed" },
  auto_reply_received: { icon: Mail, color: "text-gray-500 bg-gray-100", label: "Auto Reply" },
  auto_reply_confirmed: { icon: Mail, color: "text-gray-500 bg-gray-100", label: "Auto Reply Confirmed" },
  sequence_paused: { icon: Clock, color: "text-amber-600 bg-amber-100", label: "Sequence Paused" },
  contact_paused: { icon: Clock, color: "text-amber-600 bg-amber-100", label: "Contact Paused" },
  lead_unsubscribed: { icon: XCircle, color: "text-red-600 bg-red-100", label: "Unsubscribed" },
  email_bounced: { icon: AlertTriangle, color: "text-red-600 bg-red-100", label: "Bounced" },
  manual_outlook_email: { icon: Mail, color: "text-blue-600 bg-blue-100", label: "Outlook Email" },
  outlook_sent_synced: { icon: Send, color: "text-blue-600 bg-blue-100", label: "Outlook Synced" },
  status_change: { icon: UserCheck, color: "text-indigo-600 bg-indigo-100", label: "Status Change" },
  lead_created: { icon: UserCheck, color: "text-green-600 bg-green-100", label: "Lead Created" },
};

export default function ActivityLog() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [limit, setLimit] = useState(100);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/activity?limit=${limit}`);
      const data = await res.json();
      setActivities(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [limit]);

  const types = useMemo(() => {
    const set = new Set(activities.map(a => a.type));
    return Array.from(set).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    let result = activities;
    if (typeFilter) result = result.filter(a => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a => a.description.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
    }
    return result;
  }, [activities, typeFilter, search]);

  const getTypeConfig = (type: string) => TYPE_CONFIG[type] || { icon: Activity, color: "text-gray-500 bg-gray-100", label: type.replace(/_/g, " ") };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
            <p className="text-muted-foreground mt-1">{filtered.length} events</p>
          </div>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              className="w-full pl-9 pr-4 py-2.5 border rounded-xl bg-background text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm bg-background"
          >
            <option value="">All Types</option>
            {types.map(t => (
              <option key={t} value={t}>{getTypeConfig(t).label}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border rounded-xl px-3 py-2 text-sm bg-background"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={250}>Last 250</option>
            <option value={500}>Last 500</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No activity recorded yet. Events will appear here as emails are sent, replies are detected, and status changes occur.
          </Card>
        ) : (
          <div className="space-y-1">
            {filtered.map(item => {
              const config = getTypeConfig(item.type);
              const Icon = config.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{config.label}</Badge>
                      {item.createdBy && item.createdBy !== "system" && item.createdBy !== "scheduler" && (
                        <span className="text-xs text-muted-foreground">by {item.createdBy}</span>
                      )}
                      {item.createdBy === "scheduler" && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">auto</Badge>
                      )}
                    </div>
                    <p className="text-sm mt-0.5">{item.description}</p>
                    {item.metadata && typeof item.metadata === "object" && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {item.metadata.sendVia && <span className="text-xs text-muted-foreground">via {item.metadata.sendVia}</span>}
                        {item.metadata.pausedCount != null && <span className="text-xs text-muted-foreground">{item.metadata.pausedCount} emails paused</span>}
                        {item.metadata.resumedCount != null && <span className="text-xs text-muted-foreground">{item.metadata.resumedCount} emails resumed</span>}
                        {item.metadata.error && <span className="text-xs text-red-500">{item.metadata.error}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {format(new Date(item.createdAt), "MMM d, h:mm a")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
