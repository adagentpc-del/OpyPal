import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  fetchPlatformOverview,
  sumMetric,
  type PlatformOverview,
  type OverviewWorkspace,
} from "@/lib/platform-api";
import {
  Building2,
  Users,
  Contact,
  Target,
  CalendarClock,
  MessageCircle,
  Loader2,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  CircleSlash,
} from "lucide-react";

function ProviderBadge({ status }: { status: OverviewWorkspace["providers"]["status"] }) {
  if (status === "connected") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-red-300 text-red-700 bg-red-50">
        <AlertTriangle className="h-3 w-3" /> Errors
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
      <CircleSlash className="h-3 w-3" /> None
    </Badge>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

export default function PlatformDashboard() {
  const { enterWorkspace } = useWorkspace();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchPlatformOverview());
    } catch {
      toast({ title: "Could not load platform overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const enter = (w: OverviewWorkspace) => {
    enterWorkspace(w.id);
    setLocation("/");
  };

  const workspaces = data?.workspaces ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Every workspace on the platform, with live metrics and health.
            </p>
          </div>
          <Button onClick={() => setLocation("/platform/workspaces")}>
            <Plus className="mr-2 h-4 w-4" /> New workspace
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatTile icon={Building2} label="Workspaces" value={workspaces.length} />
              <StatTile icon={Users} label="Users" value={sumMetric(workspaces, "users")} />
              <StatTile icon={Contact} label="Contacts" value={sumMetric(workspaces, "contacts")} />
              <StatTile icon={Target} label="Campaigns" value={sumMetric(workspaces, "campaigns")} />
              <StatTile icon={CalendarClock} label="Queued" value={sumMetric(workspaces, "queued")} />
              <StatTile icon={MessageCircle} label="Replies" value={sumMetric(workspaces, "replies")} />
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Workspaces
              </h2>
              {workspaces.length === 0 ? (
                <Card className="py-16 text-center text-sm text-muted-foreground">
                  No workspaces yet. Create your first workspace to get started.
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workspaces.map((w) => (
                    <Card key={w.id} className="flex flex-col p-5">
                      <div className="flex items-center gap-3">
                        {w.logoUrl ? (
                          <img src={w.logoUrl} alt={w.name} className="h-10 w-10 rounded-xl object-contain" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                            {w.shortCode ?? w.initials ?? w.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{w.name}</p>
                          <p className="truncate text-xs text-muted-foreground">/{w.slug}</p>
                        </div>
                        <ProviderBadge status={w.providers.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        {([
                          ["Users", w.metrics.users],
                          ["Contacts", w.metrics.contacts],
                          ["Campaigns", w.metrics.campaigns],
                          ["Leads", w.metrics.leads],
                          ["Queued", w.metrics.queued],
                          ["Replies", w.metrics.replies],
                        ] as const).map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-muted/40 py-2">
                            <p className="text-sm font-bold">{value.toLocaleString()}</p>
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        className="mt-4 w-full"
                        onClick={() => enter(w)}
                      >
                        Enter workspace <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recent platform activity
              </h2>
              <Card className="divide-y">
                {(data?.recentActivity ?? []).length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No activity recorded yet.
                  </div>
                ) : (
                  (data?.recentActivity ?? []).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{a.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.workspaceName}
                          {a.createdBy ? ` · ${a.createdBy}` : ""} ·{" "}
                          {new Date(a.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0 text-[10px]">
                        {a.type}
                      </Badge>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
