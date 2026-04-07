import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Calendar, MapPin, Mail, Phone, Building2,
  FileText, Package, Upload, MessageSquare, Sparkles, TrendingUp, Clock,
} from "lucide-react";

const STATUSES = ["New", "Reviewing", "Waiting for files", "Waiting for dimensions", "Quote prep", "Quote sent", "Follow up", "Closed won", "Closed lost"];

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-100 text-blue-800",
  Reviewing: "bg-yellow-100 text-yellow-800",
  "Quote prep": "bg-purple-100 text-purple-800",
  "Quote sent": "bg-indigo-100 text-indigo-800",
  "Follow up": "bg-orange-100 text-orange-800",
  "Waiting for files": "bg-amber-100 text-amber-800",
  "Waiting for dimensions": "bg-amber-100 text-amber-800",
  "Closed won": "bg-green-100 text-green-800",
  "Closed lost": "bg-gray-100 text-gray-600",
};

const SCOPE_COLORS: Record<string, string> = {
  Small: "border-green-300 text-green-700 bg-green-50",
  Medium: "border-yellow-300 text-yellow-700 bg-yellow-50",
  High: "border-red-300 text-red-700 bg-red-50",
};

export default function AdminRequestDetail() {
  const [, params] = useRoute("/admin/requests/:id");
  const requestId = Number(params?.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");

  const { data: req, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => api.requests.get(requestId),
    enabled: !!requestId,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.requests.updateStatus(requestId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      toast({ title: "Status updated" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) => api.requests.addNote(requestId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      setNoteText("");
      toast({ title: "Note added" });
    },
  });

  if (isLoading) {
    return <AdminLayout><div className="py-12 text-center text-muted-foreground">Loading...</div></AdminLayout>;
  }
  if (!req) {
    return <AdminLayout><div className="py-12 text-center text-muted-foreground">Request not found</div></AdminLayout>;
  }

  const items = req.items || [];
  const uploads = req.uploads || [];
  const notes = req.notes || [];
  const upsells: string[] = req.recommendedUpsellsJson || [];

  const byCategory: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item.category || "Other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/requests")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{req.eventName || "Untitled Request"}</h2>
            <p className="text-muted-foreground">{req.companyName} &middot; #{req.id}</p>
          </div>
          <Badge className={`text-sm px-3 py-1 ${STATUS_COLORS[req.status] || ""}`} variant="secondary">
            {req.status}
          </Badge>
          {req.estimatedScopeLevel && (
            <Badge variant="outline" className={SCOPE_COLORS[req.estimatedScopeLevel] || ""}>
              Scope: {req.estimatedScopeLevel}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Contact & Event</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div><p className="font-medium">{req.contactName}</p><p className="text-muted-foreground">{req.companyName}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${req.email}`} className="text-primary hover:underline">{req.email}</a>
                    </div>
                    {req.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{req.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {req.eventDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>Event: {new Date(req.eventDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {req.venueName && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div><p>{req.venueName}</p><p className="text-muted-foreground">{req.venueAddress}</p></div>
                      </div>
                    )}
                    {req.installDatetime && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>Install: {new Date(req.installDatetime).toLocaleString()}</span>
                      </div>
                    )}
                    {req.postEventDisposition && (
                      <p className="text-muted-foreground">Post-event: {req.postEventDisposition}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Requested Items ({items.length})</CardTitle></CardHeader>
              <CardContent>
                {Object.entries(byCategory).map(([cat, catItems]) => (
                  <div key={cat} className="mb-4 last:mb-0">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">{cat}</h4>
                    <div className="space-y-1">
                      {catItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                          <span>{item.itemName}</span>
                          <div className="flex gap-4 text-muted-foreground text-xs">
                            {item.quantityNote && <span>Qty: {item.quantityNote}</span>}
                            {item.sizeNote && <span>Size: {item.sizeNote}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="text-muted-foreground text-sm">No items selected</p>}
              </CardContent>
            </Card>

            {uploads.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Uploads ({uploads.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {uploads.map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium">{u.fileName}</p>
                          <p className="text-xs text-muted-foreground">{u.uploadType}</p>
                        </div>
                        {u.fileUrl && (
                          <a href={u.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {req.aiSummary && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> AI Summary</CardTitle></CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">{req.aiSummary}</pre>
                </CardContent>
              </Card>
            )}

            {req.internalSummary && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Internal Summary</CardTitle></CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">{req.internalSummary}</pre>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Update Status</CardTitle></CardHeader>
              <CardContent>
                <Select value={req.status} onValueChange={(v) => statusMutation.mutate(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {upsells.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Recommended Upsells</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {upsells.map((u: string) => (
                      <Badge key={u} variant="outline" className="bg-accent/10 border-accent/30 text-accent-foreground">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Internal Notes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add an internal note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    size="sm"
                    onClick={() => noteText.trim() && noteMutation.mutate(noteText.trim())}
                    disabled={!noteText.trim() || noteMutation.isPending}
                  >
                    Add Note
                  </Button>
                </div>
                <Separator />
                {notes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No notes yet</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((n: any) => (
                      <div key={n.id} className="p-3 bg-muted/30 rounded-lg text-sm">
                        <p>{n.noteBody}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
