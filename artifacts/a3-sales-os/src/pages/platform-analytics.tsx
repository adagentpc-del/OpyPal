import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  fetchPlatformOverview,
  sumMetric,
  type OverviewWorkspace,
} from "@/lib/platform-api";
import {
  BarChart2,
  Loader2,
  Users,
  Contact,
  Target,
  Zap,
  CalendarClock,
  MessageCircle,
} from "lucide-react";

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

export default function PlatformAnalytics() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OverviewWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformOverview();
      setRows(data.workspaces);
    } catch {
      toast({ title: "Could not load platform analytics", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <BarChart2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Aggregate metrics across every workspace on the platform.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatTile icon={Users} label="Total users" value={sumMetric(rows, "users")} />
              <StatTile icon={Contact} label="Total contacts" value={sumMetric(rows, "contacts")} />
              <StatTile icon={Target} label="Total campaigns" value={sumMetric(rows, "campaigns")} />
              <StatTile icon={Zap} label="Total leads" value={sumMetric(rows, "leads")} />
              <StatTile icon={CalendarClock} label="Queued sends" value={sumMetric(rows, "queued")} />
              <StatTile icon={MessageCircle} label="Pending replies" value={sumMetric(rows, "replies")} />
            </div>

            <Card className="overflow-hidden">
              <div className="border-b bg-muted/40 px-4 py-2.5">
                <h3 className="text-sm font-semibold">Per-workspace breakdown</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Contacts</TableHead>
                    <TableHead className="text-right">Campaigns</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Queued</TableHead>
                    <TableHead className="text-right">Replies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-right">{w.metrics.users}</TableCell>
                      <TableCell className="text-right">{w.metrics.contacts}</TableCell>
                      <TableCell className="text-right">{w.metrics.campaigns}</TableCell>
                      <TableCell className="text-right">{w.metrics.leads}</TableCell>
                      <TableCell className="text-right">{w.metrics.queued}</TableCell>
                      <TableCell className="text-right">{w.metrics.replies}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
