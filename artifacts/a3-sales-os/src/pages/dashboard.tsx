import { AppLayout } from "@/components/layout";
import { useGetDashboard, useGetActivity, useGetTasks } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, DollarSign, CalendarCheck, Clock, Activity, TrendingUp, Mail, MessageSquare, Handshake, Target, AlertTriangle, CheckCircle2, XCircle, Repeat } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: dashboard, isLoading: dashboardLoading } = useGetDashboard();
  const { data: activities } = useGetActivity();
  const { data: allTasks } = useGetTasks();

  if (dashboardLoading || !dashboard) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  const d = dashboard;
  const activeLeads = d.totalLeads - d.closedWon - d.closedLost;
  const PIE_COLORS = ["hsl(215, 79%, 28%)", "hsl(44, 100%, 48%)"];

  const upcomingTasks = (allTasks || [])
    .filter((t) => t.status !== "completed" && t.dueDate)
    .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1))
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Pipeline overview for A3 Visual sales team.</p>
          </div>
          {(d.overdueFollowUps > 0) && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2 rounded-xl text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {d.overdueFollowUps} overdue follow-up{d.overdueFollowUps > 1 ? "s" : ""}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <MiniKpi label="Total Leads" value={d.totalLeads} />
          <MiniKpi label="Active Leads" value={activeLeads} color="text-primary" icon={<Target className="h-3.5 w-3.5" />} />
          <MiniKpi label="New Leads" value={d.newLeads} color="text-blue-600" />
          <MiniKpi label="Contacted" value={d.contacted} color="text-sky-600" />
          <MiniKpi label="Replied" value={d.replied} color="text-cyan-600" />
          <MiniKpi label="Qualified" value={d.qualified} color="text-teal-600" />
          <MiniKpi label="Meetings Booked" value={d.meetingsBooked} color="text-indigo-600" />
          <MiniKpi label="Meetings Done" value={d.meetingsCompleted} color="text-violet-600" />
          <MiniKpi label="Proposals Sent" value={d.proposalsSent} color="text-purple-600" />
          <MiniKpi label="Negotiation" value={d.negotiation} color="text-orange-600" />
          <MiniKpi label="Closed Won" value={d.closedWon} color="text-emerald-600" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <MiniKpi label="Closed Lost" value={d.closedLost} color="text-red-600" icon={<XCircle className="h-3.5 w-3.5" />} />
          <MiniKpi label="Nurture" value={d.nurture} color="text-amber-600" icon={<Repeat className="h-3.5 w-3.5" />} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <BigKpi label="Pipeline Value" value={`$${formatNum(d.totalPipelineValue)}`} icon={DollarSign} accent="bg-primary/10 text-primary" />
          <BigKpi label="Forecast Value" value={`$${formatNum(d.totalForecastValue)}`} icon={TrendingUp} accent="bg-blue-500/10 text-blue-600" />
          <BigKpi label="Closed Revenue" value={`$${formatNum(d.closedRevenue)}`} icon={Handshake} accent="bg-emerald-500/10 text-emerald-600" />
          <BigKpi label="Follow-Ups Due Today" value={d.followUpsDueToday.toString()} icon={CalendarCheck} accent="bg-accent/20 text-yellow-700" sub={d.overdueFollowUps > 0 ? `${d.overdueFollowUps} overdue` : undefined} subColor="text-destructive" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-5 lg:col-span-2 border-border/50 bg-card rounded-2xl">
            <h3 className="text-base font-bold mb-4">Pipeline by Stage</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.pipelineByStage.filter(s => s.count > 0)} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: 13 }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 border-border/50 bg-card rounded-2xl flex flex-col">
            <h3 className="text-base font-bold mb-2">Pipeline by Type</h3>
            <div className="flex-1 min-h-[200px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.pipelineByType} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                    {d.pipelineByType.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl font-bold">${formatNum(d.totalPipelineValue)}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-1">
              {d.pipelineByType.map((entry, i) => (
                <div key={entry.type} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="font-medium">{entry.type} ({entry.count})</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5 border-border/50 bg-card rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Upcoming Tasks
              </h3>
              <Link href="/tasks" className="text-xs text-primary font-medium hover:underline">View all</Link>
            </div>
            <div className="space-y-3">
              {upcomingTasks.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">No pending tasks</p>
              ) : (
                upcomingTasks.map((task) => {
                  const isOverdue = task.dueDate! < new Date().toISOString().split("T")[0];
                  return (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border ${isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border/50 hover:bg-muted/50"} transition-colors`}>
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isOverdue ? "bg-destructive" : "bg-primary"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{task.taskType}{task.leadCompanyName ? ` - ${task.leadCompanyName}` : ""}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.notes}</p>
                      </div>
                      <span className={`text-xs font-medium flex-shrink-0 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {task.dueDate ? format(new Date(task.dueDate + "T12:00:00"), "MMM d") : ""}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="p-5 border-border/50 bg-card rounded-2xl">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Recent Activity
            </h3>
            <div className="space-y-4 relative before:absolute before:top-0 before:bottom-0 before:left-[15px] before:w-px before:bg-border">
              {(activities || []).slice(0, 6).map((a) => (
                <div key={a.id} className="flex gap-3 relative">
                  <div className="w-8 h-8 rounded-full bg-background border-2 border-primary/40 flex items-center justify-center flex-shrink-0 z-10">
                    <Activity className="h-3 w-3 text-primary" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function formatNum(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toLocaleString();
}

function MiniKpi({ label, value, color, icon }: { label: string; value: number; color?: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-3 rounded-xl border-border/50 bg-card">
      <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {icon}
        <span className={`text-xl font-bold ${color || "text-foreground"}`}>{value}</span>
      </div>
    </Card>
  );
}

function BigKpi({ label, value, icon: Icon, accent, sub, subColor }: { label: string; value: string; icon: any; accent: string; sub?: string; subColor?: string }) {
  return (
    <Card className="p-5 rounded-2xl border-border/50 bg-card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <h3 className="text-2xl font-bold tracking-tight mt-1">{value}</h3>
          {sub && <p className={`text-xs font-semibold mt-1 ${subColor || "text-muted-foreground"}`}>{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
