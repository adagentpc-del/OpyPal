import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { PLATFORM } from "@/config/branding";
import { Settings, Loader2, Crown, Building2, Info } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface AdminUsersResponse {
  superAdmins: string[];
  members: { id: number }[];
}

export default function PlatformSettings() {
  const { me } = useWorkspace();
  const { toast } = useToast();
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settings");
      setData(await res.json());
    } catch {
      toast({ title: "Could not load platform settings", variant: "destructive" });
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
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
            <p className="text-sm text-muted-foreground">
              Platform-level configuration and super administrators.
            </p>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Platform</h2>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt>
              <dd className="text-sm font-medium">{me?.platform?.name ?? PLATFORM.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Foundation</dt>
              <dd className="text-sm font-medium">{me?.platform?.foundation ?? PLATFORM.foundation}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Full name</dt>
              <dd className="text-sm font-medium">{PLATFORM.fullName}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Super administrators</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {(data?.superAdmins ?? []).map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                  </Badge>
                ))}
                {(data?.superAdmins ?? []).length === 0 && (
                  <span className="text-sm text-muted-foreground">None configured.</span>
                )}
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Super admins are configured at the platform level and have full
                access to every workspace. They are managed via platform
                configuration, not from this screen.
              </p>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
