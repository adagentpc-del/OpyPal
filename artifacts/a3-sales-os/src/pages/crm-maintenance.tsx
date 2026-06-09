import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Wrench, ShieldCheck, Trash2, Loader2, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface Preview {
  preserved: { contacts: number; companies: number; opportunities: number; templates: number; imports: number };
  outreachToRemove: number;
  breakdown: Record<string, number>;
}

export default function CrmMaintenance() {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/crm-maintenance/preview`, { credentials: "include" });
      if (res.ok) setPreview(await res.json());
      else toast({ title: "Could not load preview", description: (await res.json().catch(() => ({})))?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function runReset() {
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/crm-maintenance/reset-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Reset failed");
      toast({ title: "Outreach history reset", description: data.message });
      await load();
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  const preserveRows = preview
    ? [
        ["Contacts", preview.preserved.contacts],
        ["Companies", preview.preserved.companies],
        ["Opportunities", preview.preserved.opportunities],
        ["Templates", preview.preserved.templates],
        ["Imports", preview.preserved.imports],
      ]
    : [];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Wrench className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CRM Maintenance</h1>
            <p className="text-sm text-muted-foreground">
              Reset outreach history to start a clean outbound campaign — without losing CRM data.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : (
          <Card className="p-6 rounded-2xl space-y-5">
            <div className="flex items-center gap-2 text-base font-semibold">
              <RefreshCw className="h-4 w-4 text-sky-600" /> Reset Outreach History
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 mb-2">
                  <ShieldCheck className="h-4 w-4" /> Preserved
                </div>
                <ul className="space-y-1 text-sm">
                  {preserveRows.map(([label, n]) => (
                    <li key={label as string} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{(n as number).toLocaleString()}</span>
                    </li>
                  ))}
                  <li className="flex justify-between text-muted-foreground">
                    <span>Notes, files, tags, segments, custom fields, ownership</span>
                    <span className="font-semibold">kept</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-800 mb-2">
                  <Trash2 className="h-4 w-4" /> Will be removed
                </div>
                <div className="text-3xl font-bold text-rose-700">
                  {preview?.outreachToRemove.toLocaleString() ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  outreach records (email sends, opens/clicks, replies, sequence history, send queue, engagement scores, automation logs)
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              All contacts will be reset to <b>Not Contacted</b> / <b>Ready For Outreach</b>. Opportunities keep their stage.
            </p>

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="rounded-xl gap-1.5 bg-rose-600 text-white hover:bg-rose-700" disabled={resetting || !preview}>
                    {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Reset Outreach History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all outreach history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes {preview?.outreachToRemove.toLocaleString()} outreach records and resets all{" "}
                      {preview?.preserved.contacts.toLocaleString()} contacts to “Not Contacted”. Your contacts, companies,
                      opportunities, notes, files and templates are kept. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={runReset}>
                      Yes, reset outreach
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
