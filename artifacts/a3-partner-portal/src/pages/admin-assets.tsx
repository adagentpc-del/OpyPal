import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";

export default function AdminAssets() {
  const { data: partners, isLoading } = useQuery({ queryKey: ["partners"], queryFn: api.partners.list });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assets Library</h2>
          <p className="text-muted-foreground mt-1">Partner assets and uploaded files</p>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : !partners?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No partners with assets yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {partners.map((partner: any) => (
              <Card key={partner.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{partner.companyName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {partner.logoUrl ? (
                    <div className="flex items-center gap-4">
                      <img src={partner.logoUrl} alt={partner.companyName} className="h-16 object-contain rounded" />
                      <div className="text-sm text-muted-foreground">
                        <p>Logo uploaded</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-sm">No assets uploaded for this partner.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
