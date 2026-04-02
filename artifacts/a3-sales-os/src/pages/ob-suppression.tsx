import { useState } from "react";
import { AppLayout } from "@/components/layout";
import {
  useGetSuppressionList,
  useAddToSuppressionList,
  useRemoveFromSuppressionList,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ShieldX, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function ObSuppression() {
  const { data: list, isLoading, refetch } = useGetSuppressionList();
  const addMut = useAddToSuppressionList();
  const removeMut = useRemoveFromSuppressionList();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const handleAdd = () => {
    if (!email.trim()) return toast({ title: "Email is required", variant: "destructive" });
    addMut.mutate({
      data: { email: email.trim().toLowerCase(), reason: reason || undefined },
    }, {
      onSuccess: () => {
        refetch();
        setEmail("");
        setReason("");
        setShowAdd(false);
        toast({ title: "Added to suppression list" });
      },
      onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleRemove = (id: number) => {
    removeMut.mutate({ id }, {
      onSuccess: () => { refetch(); toast({ title: "Removed from suppression list" }); },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    });
  };

  const filtered = (list || []).filter((item: any) =>
    !search || item.email.toLowerCase().includes(search.toLowerCase()) ||
    (item.reason && item.reason.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Suppression List</h1>
            <p className="text-muted-foreground mt-1">Emails blocked from all outbound sequences.</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} className="rounded-xl gap-2 bg-primary text-white">
            <Plus className="h-4 w-4" /> Add Email
          </Button>
        </div>

        {showAdd && (
          <Card className="p-5">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Email Address *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background">
                  <option value="">Select reason</option>
                  <option value="bounce">Bounced</option>
                  <option value="unsubscribe">Unsubscribed</option>
                  <option value="complaint">Complaint</option>
                  <option value="manual">Manual</option>
                  <option value="dnc">Do Not Contact</option>
                </select>
              </div>
              <Button onClick={handleAdd} disabled={addMut.isPending} className="rounded-xl bg-primary text-white">
                {addMut.isPending ? "Adding..." : "Add"}
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)} className="rounded-xl">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emails..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl text-sm bg-background" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldX className="h-4 w-4" />
            {filtered.length} suppressed
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                <th className="text-left px-4 py-3 font-medium">Added</th>
                <th className="text-left px-4 py-3 font-medium w-16">Remove</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => (
                <tr key={item.id} className="border-b border-border/30">
                  <td className="px-4 py-3 font-medium">{item.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.reason === "bounce" ? "bg-red-100 text-red-700" :
                      item.reason === "unsubscribe" ? "bg-amber-100 text-amber-700" :
                      item.reason === "complaint" ? "bg-orange-100 text-orange-700" :
                      item.reason === "dnc" ? "bg-red-100 text-red-600" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {item.reason || "manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.createdAt ? format(new Date(item.createdAt), "MMM d, yyyy h:mm a") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => handleRemove(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isLoading && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <ShieldX className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No suppressed emails.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
