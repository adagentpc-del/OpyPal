import { AppLayout } from "@/components/layout";
import {
  useGetContacts,
  useResumeContact,
  getGetContactsQueryKey,
  getGetOutboundAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Play, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function ObReplies() {
  const { data: contacts } = useGetContacts({ sequenceStatus: "paused_replied" });
  const resumeMut = useResumeContact();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleResume = (id: number) => {
    resumeMut.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContactsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOutboundAnalyticsQueryKey() });
        toast({ title: "Contact re-enrolled in sequence" });
      },
      onError: (err: any) => toast({ title: "Re-enroll failed", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Replies</h1>
          <p className="text-muted-foreground mt-1">Contacts who replied. Sequences are paused.</p>
        </div>

        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{contacts?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Contacts replied</div>
          </div>
        </Card>

        {contacts && contacts.length > 0 ? (
          <div className="space-y-3">
            {contacts.map((c: any) => (
              <Card key={c.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{c.fullName}</h3>
                    <span className="text-sm text-muted-foreground">{c.company}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{c.email}</span>
                    {c.lastReplyAt && <span>Replied {format(new Date(c.lastReplyAt), "MMM d, yyyy")}</span>}
                    <span>Was on step {c.currentStep}/7</span>
                    {c.campaignName && <span className="px-2 py-0.5 rounded-full bg-muted text-xs">{c.campaignName}</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => handleResume(c.id)}>
                  <Play className="h-3.5 w-3.5" /> Re-enroll
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            No replies yet. When contacts reply, their sequences are automatically paused and they appear here.
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
