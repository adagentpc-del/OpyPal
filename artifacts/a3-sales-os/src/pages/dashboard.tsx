import { AppLayout } from "@/components/layout";
import { useGetDashboard, useGetActivity, useGetTasks } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell } from "recharts";
import { Users, TrendingUp, DollarSign, CalendarCheck, Clock, ArrowUpRight, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: dashboard, isLoading: dashboardLoading } = useGetDashboard();
  const { data: activities, isLoading: activitiesLoading } = useGetActivity();
  const { data: tasks, isLoading: tasksLoading } = useGetTasks({ dueFilter: "today" });

  if (dashboardLoading || activitiesLoading || tasksLoading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const PIE_COLORS = ['hsl(215, 79%, 28%)', 'hsl(44, 100%, 48%)'];

  return (
    <AppLayout>
      <div className="flex flex-col gap-8 pb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your pipeline today.</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="Total Pipeline Value" 
            value={`$${(dashboard?.totalPipelineValue || 0).toLocaleString()}`} 
            icon={DollarSign} 
            trend="+12%" 
            color="bg-primary/10 text-primary"
          />
          <KpiCard 
            title="Active Leads" 
            value={dashboard?.totalLeads?.toString() || "0"} 
            icon={Users} 
            trend="+4" 
            color="bg-blue-500/10 text-blue-600"
          />
          <KpiCard 
            title="Meetings Booked" 
            value={dashboard?.meetingsBooked?.toString() || "0"} 
            icon={CalendarCheck} 
            trend="This week" 
            trendNeutral
            color="bg-accent/20 text-yellow-700"
          />
          <KpiCard 
            title="Overdue Follow-ups" 
            value={dashboard?.overdueFollowUps?.toString() || "0"} 
            icon={Clock} 
            trend="Action needed"
            trendDown
            color="bg-destructive/10 text-destructive"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts */}
          <Card className="p-6 lg:col-span-2 shadow-sm border-border/50 bg-card rounded-2xl">
            <h3 className="text-lg font-bold mb-6 font-display">Pipeline by Stage</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard?.pipelineByStage || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="stage" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 shadow-sm border-border/50 bg-card rounded-2xl flex flex-col">
            <h3 className="text-lg font-bold mb-2 font-display">Pipeline by Type</h3>
            <div className="flex-1 min-h-[250px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboard?.pipelineByType || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {(dashboard?.pipelineByType || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-2xl font-bold">${((dashboard?.totalPipelineValue || 0) / 1000).toFixed(0)}k</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {(dashboard?.pipelineByType || []).map((entry, i) => (
                <div key={entry.type} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                  <span className="font-medium text-foreground">{entry.type}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks Today */}
          <Card className="p-6 shadow-sm border-border/50 bg-card rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold font-display">Tasks Due Today</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {tasks?.length || 0} remaining
              </span>
            </div>
            <div className="space-y-4">
              {tasks?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No tasks due today!</div>
              ) : (
                tasks?.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 ${task.status === 'completed' ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    <div>
                      <p className="font-semibold text-sm">{task.taskType} - {task.leadCompanyName}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.notes}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Activity Feed */}
          <Card className="p-6 shadow-sm border-border/50 bg-card rounded-2xl">
            <h3 className="text-lg font-bold mb-6 font-display flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Recent Activity
            </h3>
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border">
              {activities?.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center flex-shrink-0 shadow-sm z-10">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </div>
                  <div className="pt-1.5">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                    </p>
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

function KpiCard({ title, value, icon: Icon, trend, trendDown, trendNeutral, color }: any) {
  return (
    <Card className="p-6 rounded-2xl shadow-sm shadow-black/5 border border-border/50 hover:shadow-md transition-shadow group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-display font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-semibold ${trendDown ? 'text-destructive' : trendNeutral ? 'text-muted-foreground' : 'text-emerald-600'}`}>
            {trend}
          </span>
          <span className="text-muted-foreground ml-2">vs last week</span>
        </div>
      )}
    </Card>
  );
}
