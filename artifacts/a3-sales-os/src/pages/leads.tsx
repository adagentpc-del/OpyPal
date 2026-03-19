import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetLeads, useCreateLead, useDeleteLead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Filter, Trash2, Edit2, MoreVertical, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { getGetLeadsQueryKey } from "@workspace/api-client-react";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: leads, isLoading } = useGetLeads({ search: searchTerm });
  const deleteMutation = useDeleteLead();
  const queryClient = useQueryClient();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 h-full pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Leads & CRM</h1>
            <p className="text-muted-foreground mt-1">Manage your active pipeline and client database.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25">
            <Plus className="h-4 w-4 mr-2" /> Add New Lead
          </Button>
        </div>

        <Card className="p-4 bg-card border-border/50 shadow-sm rounded-2xl flex-1 flex flex-col min-h-0">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search by company, contact, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm bg-background"
              />
            </div>
            <Button variant="outline" className="rounded-xl border-border bg-background shadow-sm">
              <Filter className="h-4 w-4 mr-2" /> Filters
            </Button>
          </div>

          <div className="border border-border/50 rounded-xl overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b border-border/50 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Company</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Pipeline Type</th>
                    <th className="px-4 py-3 font-semibold text-right">Value</th>
                    <th className="px-4 py-3 font-semibold">Next Follow-Up</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading leads...</td></tr>
                  ) : leads?.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground flex flex-col items-center justify-center">
                      <Building2 className="h-12 w-12 text-border mb-3" />
                      <p>No leads found.</p>
                    </td></tr>
                  ) : (
                    leads?.map((lead) => (
                      <tr key={lead.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 font-medium text-foreground">{lead.companyName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lead.contactName}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
                            ${lead.status === 'Closed Won' ? 'bg-emerald-100 text-emerald-700' : 
                              lead.status === 'Closed Lost' ? 'bg-destructive/10 text-destructive' : 
                              'bg-primary/10 text-primary'}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${lead.pipelineType === 'Event' ? 'bg-primary' : 'bg-accent'}`} />
                            {lead.pipelineType}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          ${(lead.proposalValue || lead.dealValueEstimate || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {lead.nextFollowUpDate ? format(new Date(lead.nextFollowUpDate), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(lead.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
