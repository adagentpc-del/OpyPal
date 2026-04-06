import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X, CheckCheck, Trash2, Mail, MousePointerClick, AlertTriangle, UserX, MessageSquare, Zap, ShieldAlert, PauseCircle, XCircle, Filter } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL + "api";

const EVENT_ICONS: Record<string, any> = {
  replied: MessageSquare,
  reply_received: MessageSquare,
  clicked: MousePointerClick,
  bounced: AlertTriangle,
  unsubscribed: UserX,
  opened: Mail,
  failed: XCircle,
  multiple_opens: Mail,
  score_threshold: Zap,
  sequence_paused_reply: PauseCircle,
};

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  urgent: { border: "border-l-red-500", bg: "bg-red-50/60", icon: "bg-red-100 text-red-600" },
  important: { border: "border-l-orange-500", bg: "bg-orange-50/40", icon: "bg-orange-100 text-orange-600" },
  warning: { border: "border-l-amber-500", bg: "bg-amber-50/30", icon: "bg-amber-100 text-amber-700" },
  info: { border: "border-l-blue-400", bg: "bg-blue-50/20", icon: "bg-primary/10 text-primary" },
};

const SEVERITY_FILTERS = [
  { value: "", label: "All" },
  { value: "urgent", label: "Urgent" },
  { value: "important", label: "Important" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [severityFilter, setSeverityFilter] = useState("");

  const fetchNotifications = async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (severityFilter) params.set("severity", severityFilter);
      const [nRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/notifications?${params}`),
        fetch(`${API_BASE}/notifications/unread-count`),
      ]);
      if (nRes.ok) setNotifications(await nRes.json());
      if (cRes.ok) { const d = await cRes.json(); setUnreadCount(d.count || 0); }
    } catch {}
  };

  useEffect(() => { fetchNotifications(); const i = setInterval(fetchNotifications, 30000); return () => clearInterval(i); }, [severityFilter]);

  const markRead = async (id: number) => {
    await fetch(`${API_BASE}/notifications/${id}/read`, { method: "PATCH" });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch(`${API_BASE}/notifications/mark-all-read`, { method: "POST" });
    fetchNotifications();
  };

  const deleteNotification = async (id: number) => {
    await fetch(`${API_BASE}/notifications/${id}`, { method: "DELETE" });
    fetchNotifications();
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="relative" onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[400px] max-h-[520px] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card rounded-t-2xl">
              <h3 className="font-bold text-sm">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="px-3 py-2 border-b border-border/50 flex gap-1 overflow-x-auto">
              {SEVERITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${severityFilter === f.value ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  onClick={() => setSeverityFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 text-border mx-auto mb-2" />
                  No notifications{severityFilter ? ` with ${severityFilter} severity` : ""}.
                </div>
              ) : (
                notifications.map((n: any) => {
                  const Icon = EVENT_ICONS[n.type] || Bell;
                  const severity = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
                  return (
                    <div key={n.id} className={`group px-4 py-3 border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer border-l-4 ${!n.isRead ? `${severity.border} ${severity.bg}` : "border-l-transparent opacity-60"}`}
                      onClick={() => { if (!n.isRead) markRead(n.id); }}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!n.isRead ? severity.icon : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                            {n.severity === "urgent" && !n.isRead && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase">Urgent</span>
                            )}
                            {n.severity === "important" && !n.isRead && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 uppercase">Important</span>
                            )}
                          </div>
                          {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] text-muted-foreground">{format(new Date(n.createdAt), "MMM d, h:mm a")}</p>
                            {n.leadId && n.leadCompanyName && (
                              <Link href={`/leads?open=${n.leadId}`} className="text-[10px] text-primary hover:underline" onClick={(e: any) => e.stopPropagation()}>
                                {n.leadCompanyName}
                              </Link>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
