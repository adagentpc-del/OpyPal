import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, CheckCircle2, XCircle, Pause, Eye, RefreshCw, AlertTriangle, User, Clock, ArrowRight, Mail } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL + "api";

interface ReviewItem {
  id: number;
  leadId: number | null;
  inboundEmailId: number | null;
  senderEmail: string | null;
  subject: string | null;
  bodyPreview: string | null;
  classification: string;
  confidenceScore: string | null;
  recommendedAction: string | null;
  reviewDecision: string | null;
  reviewedAt: string | null;
  status: string;
  createdAt: string;
  leadName: string | null;
  companyName: string | null;
  leadEmail: string | null;
  leadStatus: string | null;
}

interface ReviewDetail extends ReviewItem {
  inboundEmail: any;
  thread: any[];
}

export default function ReplyReview() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reply-review?status=${statusFilter}`);
      const data = await res.json();
      setItems(data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter]);

  const loadDetail = async (id: number) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reply-review/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch { }
    setDetailLoading(false);
  };

  const decide = async (id: number, decision: string) => {
    try {
      const res = await fetch(`${API_BASE}/reply-review/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("Failed");

      const labels: Record<string, string> = {
        human_reply: "Marked as human reply — sequences paused",
        auto_reply: "Marked as auto-reply — sequences resumed",
        pause: "Contact paused for further review",
      };
      toast({ title: labels[decision] || "Decision applied" });
      setDetailId(null);
      setDetail(null);
      load();
    } catch {
      toast({ title: "Failed to apply decision", variant: "destructive" });
    }
  };

  const getConfidenceBadge = (score: string | null) => {
    const s = parseFloat(score || "0");
    if (s >= 80) return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{s}%</Badge>;
    if (s >= 60) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{s}%</Badge>;
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{s}%</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reply Review Queue</h1>
            <p className="text-muted-foreground mt-1">Review uncertain replies and decide how to handle them</p>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-xl px-3 py-2 text-sm bg-background"
            >
              <option value="pending">Pending Review</option>
              <option value="reviewed">Already Reviewed</option>
            </select>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{items.filter(i => i.status === "pending").length}</div>
                <div className="text-xs text-muted-foreground">Pending Review</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{items.filter(i => i.reviewDecision === "human_reply").length}</div>
                <div className="text-xs text-muted-foreground">Confirmed Human</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{items.filter(i => i.reviewDecision === "auto_reply").length}</div>
                <div className="text-xs text-muted-foreground">Confirmed Auto</div>
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {statusFilter === "pending"
              ? "No replies pending review. When the system detects an ambiguous reply, it will appear here."
              : "No reviewed items found."}
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{item.leadName || "Unknown"}</span>
                      {item.companyName && <span className="text-sm text-muted-foreground">{item.companyName}</span>}
                      {getConfidenceBadge(item.confidenceScore)}
                      {item.reviewDecision && (
                        <Badge variant="outline" className={item.reviewDecision === "human_reply" ? "text-green-600 border-green-300" : "text-gray-500 border-gray-300"}>
                          {item.reviewDecision === "human_reply" ? "Human" : item.reviewDecision === "auto_reply" ? "Auto" : "Paused"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">From:</span> {item.senderEmail}
                    </div>
                    {item.subject && (
                      <div className="text-sm mt-0.5">
                        <span className="text-muted-foreground">Subject:</span> {item.subject}
                      </div>
                    )}
                    {item.bodyPreview && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.bodyPreview}</p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {item.status === "pending" ? (
                      <>
                        <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => decide(item.id, "human_reply")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Human Reply
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => decide(item.id, "auto_reply")}>
                          <XCircle className="h-3.5 w-3.5" /> Auto Reply
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-amber-600" onClick={() => decide(item.id, "pause")}>
                          <Pause className="h-3.5 w-3.5" /> Pause Contact
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => loadDetail(item.id)}>
                      <Eye className="h-3.5 w-3.5" /> View Thread
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setDetailId(null); setDetail(null); }}>
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Conversation Thread</h2>
                  <Button variant="ghost" size="sm" onClick={() => { setDetailId(null); setDetail(null); }}>✕</Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Contact:</span> {detail.leadName || "Unknown"}</div>
                    <div><span className="text-muted-foreground">Company:</span> {detail.companyName || "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {detail.senderEmail}</div>
                    <div><span className="text-muted-foreground">Confidence:</span> {detail.confidenceScore}%</div>
                  </div>
                </div>

                {detail.inboundEmail && (
                  <div className="border rounded-lg p-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inbound Email</div>
                    <div className="text-sm font-medium mb-1">{detail.inboundEmail.subject || "(no subject)"}</div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.inboundEmail.bodyText || detail.inboundEmail.bodyHtml || "(empty body)"}</div>
                  </div>
                )}

                {detail.thread && detail.thread.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Full Thread ({detail.thread.length} messages)</div>
                    <div className="space-y-2">
                      {detail.thread.map((msg: any, i: number) => (
                        <div key={i} className={`border rounded-lg p-3 ${msg.type === "inbound" ? "bg-blue-50 border-blue-200" : "bg-white"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{msg.type === "inbound" ? "Received" : "Sent"}</Badge>
                            <span className="text-xs text-muted-foreground">{msg.from}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {msg.timestamp ? format(new Date(msg.timestamp), "MMM d, h:mm a") : ""}
                            </span>
                          </div>
                          <div className="text-sm font-medium">{msg.subject}</div>
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-4">{msg.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.status === "pending" && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => decide(detail.id, "human_reply")}>
                      <CheckCircle2 className="h-4 w-4" /> Mark as Human Reply — Stop Sequence
                    </Button>
                    <Button variant="outline" className="flex-1 gap-1.5" onClick={() => decide(detail.id, "auto_reply")}>
                      <XCircle className="h-4 w-4" /> Mark as Auto Reply — Continue
                    </Button>
                    <Button variant="ghost" className="gap-1.5 text-amber-600" onClick={() => decide(detail.id, "pause")}>
                      <Pause className="h-4 w-4" /> Pause
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
