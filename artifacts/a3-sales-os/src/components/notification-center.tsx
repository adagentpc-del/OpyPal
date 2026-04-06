import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X, Check, CheckCheck, Trash2, Mail, MousePointerClick, AlertTriangle, UserX, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL + "api";

const EVENT_ICONS: Record<string, any> = {
  replied: MessageSquare,
  clicked: MousePointerClick,
  bounced: AlertTriangle,
  unsubscribed: UserX,
  opened: Mail,
  failed: AlertTriangle,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-l-4 border-l-red-500 bg-red-50/50",
  normal: "border-l-4 border-l-blue-500 bg-blue-50/30",
  low: "border-l-4 border-l-gray-300",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const [nRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/notifications?limit=30`),
        fetch(`${API_BASE}/notifications/unread-count`),
      ]);
      if (nRes.ok) setNotifications(await nRes.json());
      if (cRes.ok) { const d = await cRes.json(); setUnreadCount(d.count || 0); }
    } catch {}
  };

  useEffect(() => { fetchNotifications(); const i = setInterval(fetchNotifications, 30000); return () => clearInterval(i); }, []);

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
          <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
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
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 text-border mx-auto mb-2" />
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n: any) => {
                  const Icon = EVENT_ICONS[n.type] || Bell;
                  return (
                    <div key={n.id} className={`group px-4 py-3 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer ${!n.isRead ? PRIORITY_COLORS[n.priority || "normal"] : "opacity-60"}`}
                      onClick={() => { if (!n.isRead) markRead(n.id); }}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${n.priority === "high" ? "bg-red-100 text-red-600" : "bg-primary/10 text-primary"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.isRead ? "font-semibold" : ""}`}>{n.title}</p>
                          {n.description && <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>}
                          <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.createdAt), "MMM d, h:mm a")}</p>
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
