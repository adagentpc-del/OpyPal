import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";

const CATEGORIES = [
  "Printing", "Rentals", "Design and artwork",
  "Custom fabrication", "Immersive experiences", "Promotional items",
];

export default function AdminPricing() {
  const { data: rules, isLoading } = useQuery({ queryKey: ["pricing-rules"], queryFn: api.pricing.list });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ category: "Printing", itemName: "", startingPrice: "", isActive: true });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      editing ? api.pricing.update(editing.id, data) : api.pricing.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      setDialogOpen(false);
      setEditing(null);
      toast({ title: editing ? "Rule updated" : "Rule created" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.pricing.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ category: "Printing", itemName: "", startingPrice: "", isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setForm({
      category: rule.category,
      itemName: rule.itemName,
      startingPrice: rule.startingPrice || "",
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      startingPrice: form.startingPrice || null,
    });
  };

  const grouped: Record<string, any[]> = {};
  for (const r of rules || []) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pricing Rules</h2>
            <p className="text-muted-foreground mt-1">Manage starting-at pricing displayed on partner portals</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> New Rule</Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const catRules = grouped[cat] || [];
              if (catRules.length === 0) return null;
              return (
                <Card key={cat}>
                  <CardHeader>
                    <CardTitle className="text-lg">{cat} ({catRules.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-3 font-medium">Item</th>
                          <th className="text-left p-3 font-medium">Starting Price</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {catRules.map((r: any) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-3">{r.itemName}</td>
                            <td className="p-3">
                              {r.startingPrice ? `$${r.startingPrice}` : <span className="text-muted-foreground">Quote</span>}
                            </td>
                            <td className="p-3">
                              <Badge variant={r.isActive ? "default" : "secondary"}>
                                {r.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(r.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pricing Rule" : "New Pricing Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Item Name</Label>
              <Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Starting Price (leave empty for "Get a Quote")</Label>
              <Input type="number" value={form.startingPrice} onChange={(e) => setForm({ ...form, startingPrice: e.target.value })} placeholder="e.g. 350" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
