import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  fetchPlatformOverview,
  type OverviewWorkspace,
} from "@/lib/platform-api";
import { FileText, Loader2, ArrowRight, Info } from "lucide-react";

// Global Templates is a cross-workspace view. Templates are owned per-workspace,
// so this page surfaces every workspace and routes the super admin into that
// workspace's template manager. Aggregate authoring lands in a later pass.
export default function PlatformTemplates() {
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
      toast({ title: "Could not load workspaces", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const manage = (w: OverviewWorkspace) => {
    enterWorkspace(w.id);
    setLocation("/templates");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Global Templates</h1>
            <p className="text-sm text-muted-foreground">
              Email templates across every workspace.
            </p>
          </div>
        </div>

        <Card className="flex items-start gap-3 border-primary/20 bg-primary/5 p-4">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            Templates are managed within each workspace. Choose a workspace below
            to view and edit its templates. Shared platform-wide template
            authoring is planned for a later release.
          </p>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((w) => (
              <Card key={w.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                    {w.shortCode ?? w.initials ?? w.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{w.name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => manage(w)}>
                  Manage <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
