import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  fetchPlatformOverview,
  type OverviewWorkspace,
} from "@/lib/platform-api";
import {
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CircleSlash,
  ArrowRight,
} from "lucide-react";

function StatusCell({ w }: { w: OverviewWorkspace }) {
  if (w.providers.status === "connected") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700 bg-emerald-50">
        <CheckCircle2 className="h-3 w-3" /> Connected
      </Badge>
    );
  }
  if (w.providers.status === "error") {
    return (
      <Badge variant="outline" className="gap-1 border-red-300 text-red-700 bg-red-50">
        <AlertTriangle className="h-3 w-3" /> {w.providers.errored} error{w.providers.errored === 1 ? "" : "s"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
      <CircleSlash className="h-3 w-3" /> Not connected
    </Badge>
  );
}

export default function PlatformProviders() {
  const { enterWorkspace } = useWorkspace();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rows, setRows] = useState<OverviewWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformOverview();
      setRows(data.workspaces);
    } catch {
      toast({ title: "Could not load provider connections", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const enterProviders = (w: OverviewWorkspace) => {
    enterWorkspace(w.id);
    setLocation("/providers");
  };

  const connected = rows.filter((w) => w.providers.status === "connected").length;
  const errored = rows.filter((w) => w.providers.status === "error").length;
  const none = rows.filter((w) => w.providers.status === "none").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Provider Connections</h1>
            <p className="text-sm text-muted-foreground">
              Mailbox connection health across every workspace.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <p className="text-2xl font-bold text-emerald-600">{connected}</p>
                <p className="text-xs text-muted-foreground">Workspaces connected</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-red-600">{errored}</p>
                <p className="text-xs text-muted-foreground">With sync errors</p>
              </Card>
              <Card className="p-4">
                <p className="text-2xl font-bold text-muted-foreground">{none}</p>
                <p className="text-xs text-muted-foreground">Not connected</p>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>Active mailboxes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell>{w.providers.connected}</TableCell>
                      <TableCell><StatusCell w={w} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => enterProviders(w)}>
                          Manage <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
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
