import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetSequenceQueue,
  useProcessSequenceQueue,
  getGetSequenceQueueQueryKey,
  getGetOutboundAnalyticsQueryKey,
  getGetContactsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  paused: "bg-amber-100 text-amber-700",
};

export default function ObQueue() {
  const [filter, setFilter] = useState("scheduled");
  const { data: queue, isLoading } = useGetSequenceQueue({ status: filter || undefined });
  const processMut = useProcessSequenceQueue();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleProcess = () => {
    processMut.mutate(undefined, {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueueQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        toast({ title: data.message || "Processing complete" });
      },
      onError: () => toast({ title: "Processing failed", variant: "destructive" }),
    });
  };

  const scheduled = (queue || []).filter((q: any) => q.status === "scheduled");
  const overdue = scheduled.filter((q: any) => q.scheduledFor && new Date(q.scheduledFor) <= new Date());

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sequence Queue</h1>
            <p className="text-muted-foreground mt-1">Manage scheduled outbound sends.</p>
          </div>
          <Button onClick={handleProcess} disabled={processMut.isPending}
            className="rounded-xl gap-2 bg-primary text-white">
            <Play className="h-4 w-4" />
            {processMut.isPending ? "Processing..." : "Process Queue"}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{scheduled.length}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{overdue.length}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{(queue || []).filter((q: any) => q.status === "sent").length}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{(queue || []).filter((q: any) => q.status === "error").length}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </Card>
        </div>

        <div className="flex gap-2">
          {["scheduled", "sent", "skipped", "error", ""].map(s => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" className="rounded-lg text-xs"
              onClick={() => setFilter(s)}>
              {s || "All"}
            </Button>
          ))}
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Contact</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Step</th>
                <th className="text-left px-4 py-3 font-medium">Subject</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {(queue || []).map((q: any) => (
                <tr key={q.id} className="border-b border-border/30">
                  <td className="px-4 py-3 font-medium">{q.contactName}</td>
                  <td className="px-4 py-3">{q.company}</td>
                  <td className="px-4 py-3">Step {q.stepNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">{q.subject || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[q.status] || "bg-gray-100"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {q.scheduledFor ? format(new Date(q.scheduledFor), "MMM d, h:mm a") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && (!queue || queue.length === 0) && (
            <div className="p-8 text-center text-muted-foreground">No items in queue.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
