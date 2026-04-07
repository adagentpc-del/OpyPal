import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { Search, Calendar, Building2, ArrowUpRight } from "lucide-react";

const STATUSES = ["All", "New", "Reviewing", "Waiting for files", "Waiting for dimensions", "Quote prep", "Quote sent", "Follow up", "Closed won", "Closed lost"];

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
  Small: "bg-green-50 text-green-700 border-green-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  High: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [partnerFilter, setPartnerFilter] = useState("All");

  const { data: partners } = useQuery({ queryKey: ["partners"], queryFn: api.partners.list });
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", statusFilter, partnerFilter, search],
    queryFn: () => api.requests.list({
      status: statusFilter !== "All" ? statusFilter : undefined,
      partnerId: partnerFilter !== "All" ? Number(partnerFilter) : undefined,
      search: search || undefined,
    }),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Requests</h2>
          <p className="text-muted-foreground mt-1">Manage partner project requests</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by event, company, or contact..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Partners</SelectItem>
                  {(partners || []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : !requests?.length ? (
              <div className="py-12 text-center text-muted-foreground">No requests found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 font-medium">Event</th>
                      <th className="text-left p-4 font-medium">Partner / Company</th>
                      <th className="text-left p-4 font-medium">Contact</th>
                      <th className="text-left p-4 font-medium">Date</th>
                      <th className="text-left p-4 font-medium">Scope</th>
                      <th className="text-left p-4 font-medium">Status</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r: any) => (
                      <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <p className="font-medium">{r.eventName || "Untitled"}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{r.companyName}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p>{r.contactName}</p>
                          <p className="text-xs text-muted-foreground">{r.email}</p>
                        </td>
                        <td className="p-4">
                          {r.eventDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{new Date(r.eventDate).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">TBD</span>
                          )}
                        </td>
                        <td className="p-4">
                          {r.estimatedScopeLevel && (
                            <Badge variant="outline" className={SCOPE_COLORS[r.estimatedScopeLevel] || ""}>
                              {r.estimatedScopeLevel}
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge className={STATUS_COLORS[r.status] || "bg-gray-100"} variant="secondary">
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Link href={`/admin/requests/${r.id}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
