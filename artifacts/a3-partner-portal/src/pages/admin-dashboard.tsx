import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileText, Users, Clock, CheckCircle, ArrowRight, AlertCircle } from "lucide-react";

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

export default function AdminDashboard() {
  const { data: summary } = useQuery({ queryKey: ["request-summary"], queryFn: api.requests.summary });
  const { data: requests } = useQuery({ queryKey: ["requests-recent"], queryFn: () => api.requests.list() });
  const { data: partners } = useQuery({ queryKey: ["partners"], queryFn: api.partners.list });

  const recentRequests = (requests || []).slice(0, 8);
  const stats = [
    { label: "Total Requests", value: summary?.total || 0, icon: FileText, color: "text-primary" },
    { label: "New", value: summary?.byStatus?.New || 0, icon: AlertCircle, color: "text-blue-600" },
    { label: "In Progress", value: (summary?.byStatus?.Reviewing || 0) + (summary?.byStatus?.["Quote prep"] || 0), icon: Clock, color: "text-yellow-600" },
    { label: "Active Partners", value: partners?.filter((p: any) => p.isActive).length || 0, icon: Users, color: "text-green-600" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of partner requests and activity</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-3xl font-bold mt-1">{s.value}</p>
                  </div>
                  <s.icon className={`w-10 h-10 ${s.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Requests</CardTitle>
              <Link href="/admin/requests">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No requests yet</p>
              ) : (
                <div className="space-y-3">
                  {recentRequests.map((r: any) => (
                    <Link key={r.id} href={`/admin/requests/${r.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{r.eventName || "Untitled"}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {r.companyName} &middot; {r.contactName}
                          </p>
                        </div>
                        <Badge className={`ml-3 ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-800"}`} variant="secondary">
                          {r.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Partners</CardTitle>
              <Link href="/admin/partners">
                <Button variant="ghost" size="sm">
                  Manage <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {(!partners || partners.length === 0) ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No partners yet</p>
              ) : (
                <div className="space-y-3">
                  {partners.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{p.companyName}</p>
                        <p className="text-xs text-muted-foreground">/partner/{p.slug}</p>
                      </div>
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
