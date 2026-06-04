import { useState, useEffect, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  fetchPlatformOverview,
  type PlatformActivity,
} from "@/lib/platform-api";
import { Activity, Loader2, Search } from "lucide-react";

export default function PlatformAuditLog() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PlatformActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [workspace, setWorkspace] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformOverview();
      setRows(data.recentActivity);
    } catch {
      toast({ title: "Could not load audit log", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const workspaceNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.workspaceName))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (workspace !== "all" && r.workspaceName !== workspace) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        (r.createdBy ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, workspace]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              Recent activity across every workspace on the platform.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search activity…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={workspace} onValueChange={setWorkspace}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="All workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {workspaceNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Card className="divide-y">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matching activity.
              </div>
            ) : (
              filtered.map((a) => (
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
        )}
      </div>
    </AppLayout>
  );
}
