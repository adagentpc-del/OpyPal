import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Plus, Pencil, ExternalLink, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPartners() {
  const { data: partners, isLoading } = useQuery({ queryKey: ["partners"], queryFn: api.partners.list });
  const qc = useQueryClient();
  const { toast } = useToast();

  const toggleMutation = useMutation({
    mutationFn: (p: any) => api.partners.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner updated" });
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Partners</h2>
            <p className="text-muted-foreground mt-1">Manage partner accounts and portal pages</p>
          </div>
          <Link href="/admin/partners/new">
            <Button><Plus className="w-4 h-4 mr-2" /> New Partner</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : !partners?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No partners yet. Create your first partner to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {partners.map((p: any) => (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{p.companyName}</h3>
                      <p className="text-sm text-muted-foreground">{p.industryFocus || "No industry"}</p>
                    </div>
                    <Badge variant={p.isActive ? "default" : "secondary"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <p><span className="text-muted-foreground">Slug:</span> /partner/{p.slug}</p>
                    <p><span className="text-muted-foreground">Contact:</span> {p.contactName || "N/A"}</p>
                    <p><span className="text-muted-foreground">Email:</span> {p.contactEmail || "N/A"}</p>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Link href={`/admin/partners/${p.id}/edit`}>
                      <Button variant="outline" size="sm"><Pencil className="w-3 h-3 mr-1" /> Edit</Button>
                    </Link>
                    <Link href={`/partner/${p.slug}`}>
                      <Button variant="outline" size="sm"><ExternalLink className="w-3 h-3 mr-1" /> Preview</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(p)}
                      className="ml-auto"
                    >
                      {p.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
