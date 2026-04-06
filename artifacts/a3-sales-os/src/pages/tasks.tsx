import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, Clock, Plus, Trash2, Edit2, X, AlertTriangle, ArrowUpCircle, Filter, ChevronDown, ExternalLink, XCircle, Zap, PhoneCall, Mail, Eye, Search, RotateCcw, Settings2, ListFilter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL + "api";

const TASK_TYPES = [
  { value: "follow_up_call", label: "Follow-Up Call" },
  { value: "send_manual_email", label: "Send Manual Email" },
  { value: "review_reply", label: "Review Reply" },
  { value: "check_high_intent", label: "Check High Intent Lead" },
  { value: "reschedule_outreach", label: "Reschedule Outreach" },
  { value: "verify_bounced_email", label: "Verify Bounced Email" },
  { value: "pipeline_review", label: "Pipeline Review" },
  { value: "custom", label: "Custom" },
] as const;

const TASK_TYPE_MAP: Record<string, string> = Object.fromEntries(TASK_TYPES.map(t => [t.value, t.label]));

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "medium", label: "Medium", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "high", label: "High", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "urgent", label: "Urgent", color: "bg-red-50 text-red-700 border-red-200" },
];

const PRIORITY_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(PRIORITIES.map(p => [p.value, { label: p.label, color: p.color }]));

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "dismissed", label: "Dismissed" },
];

const STATUS_ICONS: Record<string, any> = {
  open: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  dismissed: XCircle,
};

const TASK_TYPE_ICONS: Record<string, any> = {
  follow_up_call: PhoneCall,
  send_manual_email: Mail,
  review_reply: Eye,
  check_high_intent: Zap,
  verify_bounced_email: AlertTriangle,
  reschedule_outreach: RotateCcw,
};

type TaskFilter = "all" | "open" | "today" | "overdue" | "urgent" | "system" | "completed";

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRules, setAutoRules] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    leadId: undefined as number | undefined,
    taskType: "follow_up_call",
    priority: "medium",
    status: "open",
    dueDate: "",
    notes: "",
    source: "user",
  });

  const fetchData = async () => {
    try {
      const [tasksRes, leadsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/tasks?limit=500`),
        fetch(`${API_BASE}/leads`),
        fetch(`${API_BASE}/tasks/summary`),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const today = new Date().toISOString().split("T")[0];
    if (filter === "open") result = result.filter(t => t.status === "open" || t.status === "in_progress");
    if (filter === "today") result = result.filter(t => t.dueDate === today && t.status !== "completed" && t.status !== "dismissed");
    if (filter === "overdue") result = result.filter(t => t.dueDate && t.dueDate < today && t.status !== "completed" && t.status !== "dismissed");
    if (filter === "urgent") result = result.filter(t => (t.priority === "high" || t.priority === "urgent") && t.status !== "completed" && t.status !== "dismissed");
    if (filter === "system") result = result.filter(t => t.source === "system");
    if (filter === "completed") result = result.filter(t => t.status === "completed" || t.status === "dismissed");
    if (typeFilter) result = result.filter(t => t.taskType === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.leadCompanyName || "").toLowerCase().includes(q) ||
        (t.leadContactName || "").toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
      );
    }

    return result.sort((a: any, b: any) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      if (a.status === "dismissed" && b.status !== "dismissed") return 1;
      if (b.status === "dismissed" && a.status !== "dismissed") return -1;
      const pOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const pa = pOrder[a.priority] ?? 2;
      const pb = pOrder[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, filter, typeFilter, searchQuery]);

  const handleComplete = async (id: number) => {
    await fetch(`${API_BASE}/tasks/${id}/complete`, { method: "PATCH" });
    fetchData();
    toast({ title: "Task completed" });
  };

  const handleDismiss = async (id: number) => {
    await fetch(`${API_BASE}/tasks/${id}/dismiss`, { method: "PATCH" });
    fetchData();
    toast({ title: "Task dismissed" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
    fetchData();
    toast({ title: "Task deleted" });
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setForm({
      title: task.title || "",
      leadId: task.leadId || undefined,
      taskType: task.taskType || "custom",
      priority: task.priority || "medium",
      status: task.status || "open",
      dueDate: task.dueDate || "",
      notes: task.notes || "",
      source: task.source || "user",
    });
    setModalOpen(true);
  };

  const openNew = () => {
    setEditingTask(null);
    setForm({ title: "", leadId: undefined, taskType: "follow_up_call", priority: "medium", status: "open", dueDate: "", notes: "", source: "user" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.taskType) return;
    const payload = { ...form, leadId: form.leadId || null };
    if (editingTask) {
      await fetch(`${API_BASE}/tasks/${editingTask.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast({ title: "Task updated" });
    } else {
      await fetch(`${API_BASE}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast({ title: "Task created" });
    }
    setModalOpen(false);
    setEditingTask(null);
    fetchData();
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/auto-rules`);
      if (res.ok) setAutoRules(await res.json());
    } catch {}
  };

  const saveRules = async () => {
    await fetch(`${API_BASE}/tasks/auto-rules`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(autoRules) });
    toast({ title: "Auto-task rules saved" });
    setSettingsOpen(false);
  };

  const filters: { key: TaskFilter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: tasks.length },
    { key: "open", label: "Open", count: summary?.open || 0 },
    { key: "today", label: "Due Today", count: summary?.dueToday || 0 },
    { key: "overdue", label: "Overdue", count: summary?.overdue || 0 },
    { key: "urgent", label: "Urgent", count: summary?.urgent || 0 },
    { key: "system", label: "System", count: tasks.filter(t => t.source === "system").length },
    { key: "completed", label: "Completed" },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto flex flex-col gap-5 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground text-sm mt-1">Sales follow-ups, auto-generated tasks, and action items.</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => { fetchRules(); setSettingsOpen(true); }}>
              <Settings2 className="h-4 w-4" /> Auto Rules
            </Button>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md gap-1.5">
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </div>
        </div>

        {summary && (summary.overdue > 0 || summary.urgent > 0) && (
          <div className="flex gap-3 flex-wrap">
            {summary.overdue > 0 && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg text-sm font-medium">
                <AlertTriangle className="h-3.5 w-3.5" /> {summary.overdue} overdue task{summary.overdue > 1 ? "s" : ""}
              </div>
            )}
            {summary.urgent > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                <ArrowUpCircle className="h-3.5 w-3.5" /> {summary.urgent} urgent/high priority
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap flex-1">
            {filters.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "outline"}
                size="sm"
                className={`rounded-full text-xs ${filter === f.key ? (f.key === "overdue" ? "bg-destructive text-destructive-foreground" : f.key === "urgent" ? "bg-orange-600 text-white" : "shadow-md") : f.key === "overdue" ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "bg-card"}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}{f.count !== undefined ? ` (${f.count})` : ""}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-border rounded-lg text-xs bg-background w-40 focus:border-primary outline-none"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2 py-1.5 border border-border rounded-lg text-xs bg-background focus:border-primary outline-none"
            >
              <option value="">All Types</option>
              {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <Card className="bg-card border-border/50 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
              <h3 className="text-lg font-bold">All caught up!</h3>
              <p className="text-muted-foreground text-sm">No tasks for this view.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[auto_1fr_120px_80px_100px_80px_70px_60px] gap-3 px-4 py-2.5 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="w-6" />
                <div>Task</div>
                <div>Lead</div>
                <div>Type</div>
                <div>Due Date</div>
                <div>Priority</div>
                <div>Source</div>
                <div />
              </div>
              <div className="divide-y divide-border/30">
                {filteredTasks.map((task) => {
                  const dueDate = task.dueDate ? new Date(task.dueDate + "T12:00:00") : null;
                  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && task.status !== "completed" && task.status !== "dismissed";
                  const dueToday = dueDate && isToday(dueDate);
                  const completed = task.status === "completed" || task.status === "dismissed";
                  const priority = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                  const TypeIcon = TASK_TYPE_ICONS[task.taskType] || ListFilter;
                  const StatusIcon = STATUS_ICONS[task.status] || Circle;

                  return (
                    <div key={task.id} className={`group px-4 py-3 hover:bg-muted/20 transition-colors ${overdue ? "bg-destructive/5" : ""} ${completed ? "opacity-50" : ""}`}>
                      <div className="md:grid md:grid-cols-[auto_1fr_120px_80px_100px_80px_70px_60px] md:gap-3 md:items-center flex flex-col gap-2">
                        <button
                          onClick={() => !completed && handleComplete(task.id)}
                          className={`flex-shrink-0 transition-colors focus:outline-none ${completed ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}
                        >
                          {completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className={`font-semibold text-sm truncate ${completed ? "line-through" : ""}`}>
                              {task.title || TASK_TYPE_MAP[task.taskType] || task.taskType}
                            </span>
                          </div>
                          {task.notes && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 ml-5">{task.notes}</p>}
                        </div>

                        <div className="text-xs truncate">
                          {task.leadCompanyName ? (
                            <Link href={`/leads?open=${task.leadId}`} className="text-primary hover:underline flex items-center gap-1">
                              {task.leadCompanyName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>

                        <div className="text-[11px] text-muted-foreground truncate">
                          {TASK_TYPE_MAP[task.taskType] || task.taskType}
                        </div>

                        <div>
                          {dueDate ? (
                            <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md ${overdue ? "bg-destructive/10 text-destructive" : dueToday ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                              <Clock className="h-3 w-3 mr-1" />
                              {format(dueDate, "MMM d")}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </div>

                        <div>
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${priority.color}`}>
                            {priority.label}
                          </span>
                        </div>

                        <div>
                          {task.source === "system" ? (
                            <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">
                              <Zap className="h-2.5 w-2.5 mr-0.5" /> Auto
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Manual</span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100" onClick={() => openEdit(task)} title="Edit">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          {!completed && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-amber-600 opacity-0 group-hover:opacity-100" onClick={() => handleDismiss(task.id)} title="Dismiss">
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDelete(task.id)} title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{editingTask ? "Edit Task" : "New Task"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium block mb-1.5">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Follow up on proposal"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Task Type</label>
                  <select value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                    {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                    {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Linked Lead</label>
                <select value={form.leadId ?? ""} onChange={(e) => setForm({ ...form, leadId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  <option value="">— No lead —</option>
                  {leads?.map((l: any) => <option key={l.id} value={l.id}>{l.companyName} — {l.contactName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
                </div>
                {editingTask && (
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[70px] resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl">{editingTask ? "Save" : "Create Task"}</Button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Auto Task & Alert Rules</h2>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Configure which engagement events automatically create tasks and alerts.</p>
              {[
                { key: "create_task_on_reply", label: "Create task on reply" },
                { key: "create_task_on_click", label: "Create task on click" },
                { key: "create_task_on_bounce", label: "Create task on bounce" },
                { key: "notify_on_reply", label: "Send alert on reply" },
                { key: "notify_on_bounce", label: "Send alert on bounce" },
                { key: "notify_on_click", label: "Send alert on click" },
                { key: "notify_on_unsubscribe", label: "Send alert on unsubscribe" },
              ].map((rule) => (
                <label key={rule.key} className="flex items-center justify-between py-2 border-b border-border/30">
                  <span className="text-sm">{rule.label}</span>
                  <button
                    type="button"
                    className={`relative w-10 h-5 rounded-full transition-colors ${autoRules[rule.key] !== false ? "bg-primary" : "bg-gray-300"}`}
                    onClick={() => setAutoRules({ ...autoRules, [rule.key]: autoRules[rule.key] === false ? true : false })}
                  >
                    <span className={`absolute top-0.5 ${autoRules[rule.key] !== false ? "right-0.5" : "left-0.5"} w-4 h-4 bg-white rounded-full shadow transition-all`} />
                  </button>
                </label>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSettingsOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={saveRules} className="bg-primary text-white rounded-xl">Save Rules</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
