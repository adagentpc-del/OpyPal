import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import {
  Activity as ActivityIcon,
  Mail,
  Phone,
  CalendarCheck,
  FileText,
  Briefcase,
  Clock,
  MessageCircle,
  ClipboardList,
  DollarSign,
  Loader2,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface DashboardData {
  today: {
    emailsSent: number;
    callsMade: number;
    meetingsBooked: number;
    proposalsSent: number;
    opportunitiesCreated: number;
    followUpsDue: number;
  };
  week: {
    emailsSent: number;
    replies: number;
    meetings: number;
    siteSurveys: number;
    quotesRequested: number;
    revenuePipeline: number;
  };
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="p-4 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export default function OutreachDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/activity-dashboard`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fmt = (n: number) => n.toLocaleString();
  const money = (n: number) => "$" + n.toLocaleString();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ActivityIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Outreach Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Activity-based reporting for the Outlook outbound workflow.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : !data ? (
          <Card className="p-8 text-center text-muted-foreground rounded-2xl">No data yet.</Card>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Today's Activity</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Stat icon={Mail} label="Emails Sent" value={fmt(data.today.emailsSent)} accent="bg-sky-100 text-sky-700" />
                <Stat icon={Phone} label="Calls Made" value={fmt(data.today.callsMade)} accent="bg-violet-100 text-violet-700" />
                <Stat icon={CalendarCheck} label="Meetings Booked" value={fmt(data.today.meetingsBooked)} accent="bg-emerald-100 text-emerald-700" />
                <Stat icon={FileText} label="Proposals Sent" value={fmt(data.today.proposalsSent)} accent="bg-amber-100 text-amber-700" />
                <Stat icon={Briefcase} label="Opportunities Created" value={fmt(data.today.opportunitiesCreated)} accent="bg-indigo-100 text-indigo-700" />
                <Stat icon={Clock} label="Follow-Ups Due" value={fmt(data.today.followUpsDue)} accent="bg-rose-100 text-rose-700" />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">This Week</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <Stat icon={Mail} label="Emails Sent" value={fmt(data.week.emailsSent)} accent="bg-sky-100 text-sky-700" />
                <Stat icon={MessageCircle} label="Replies" value={fmt(data.week.replies)} accent="bg-blue-100 text-blue-700" />
                <Stat icon={CalendarCheck} label="Meetings" value={fmt(data.week.meetings)} accent="bg-emerald-100 text-emerald-700" />
                <Stat icon={ClipboardList} label="Site Surveys" value={fmt(data.week.siteSurveys)} accent="bg-teal-100 text-teal-700" />
                <Stat icon={FileText} label="Quotes Requested" value={fmt(data.week.quotesRequested)} accent="bg-amber-100 text-amber-700" />
                <Stat icon={DollarSign} label="Revenue Pipeline" value={money(data.week.revenuePipeline)} accent="bg-green-100 text-green-700" />
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
