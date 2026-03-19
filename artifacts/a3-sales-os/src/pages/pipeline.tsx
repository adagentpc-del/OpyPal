import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetLeads, useUpdateLeadStatus, useUpdateLead, getGetLeadsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { Building2, Calendar, DollarSign, GripVertical, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const STAGES = [
  "New Lead", "Contacted", "Replied", "Qualified",
  "Meeting Booked", "Meeting Completed", "Proposal Sent",
  "Negotiation", "Closed Won", "Closed Lost", "Nurture",
];

export default function Pipeline() {
  const { data: leads, isLoading } = useGetLeads();
  const updateStatusMutation = useUpdateLeadStatus();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const leadId = parseInt(result.draggableId);
    const newStatus = result.destination.droppableId;
    const lead = leads?.find((l) => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      queryClient.setQueryData(getGetLeadsQueryKey(), (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l));
      });
      updateStatusMutation.mutate(
        { id: leadId, data: { status: newStatus } },
        { onSuccess: invalidate, onError: invalidate }
      );
    }
  };

  const getLeadsByStage = (stage: string) => (leads || []).filter((l) => l.status === stage);
  const today = new Date().toISOString().split("T")[0];

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Drag leads between stages to update status.</p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-3 h-full items-start min-w-max px-1">
                {STAGES.map((stage) => {
                  const stageLeads = getLeadsByStage(stage);
                  const value = stageLeads.reduce((s, l) => s + Number(l.proposalValue || l.dealValueEstimate || 0), 0);
                  return (
                    <div key={stage} className="flex flex-col w-[260px] h-full bg-muted/40 rounded-xl border border-border/50">
                      <div className="p-3 border-b border-border/50 bg-card/50 rounded-t-xl">
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{stage}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{stageLeads.length} lead{stageLeads.length !== 1 ? "s" : ""} &middot; ${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}</p>
                      </div>
                      <Droppable droppableId={stage}>
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors min-h-[60px] ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                          >
                            {stageLeads.map((lead, index) => {
                              const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < today && stage !== "Closed Won" && stage !== "Closed Lost";
                              return (
                                <Draggable key={lead.id} draggableId={lead.id.toString()} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => setSelectedLead(lead)}
                                      className={`bg-card rounded-xl p-3 shadow-sm border cursor-pointer
                                        ${lead.pipelineType === "Event" ? "border-l-[3px] border-l-primary" : "border-l-[3px] border-l-accent"}
                                        ${isOverdue ? "border-t-destructive/50" : ""}
                                        ${snapshot.isDragging ? "shadow-2xl rotate-1 scale-105 z-50" : "border-border hover:border-primary/40"}`}
                                      style={provided.draggableProps.style}
                                    >
                                      <div className="flex justify-between items-start mb-1.5">
                                        <h4 className="font-bold text-xs text-foreground line-clamp-1 flex-1">{lead.companyName}</h4>
                                        <GripVertical className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" />
                                      </div>
                                      <div className="space-y-1">
                                        <div className="flex items-center text-[11px] text-muted-foreground">
                                          <Building2 className="h-3 w-3 mr-1" />
                                          {lead.contactName}
                                        </div>
                                        <div className="flex items-center text-[11px] text-muted-foreground">
                                          <DollarSign className="h-3 w-3 mr-1" />
                                          ${Number(lead.proposalValue || lead.dealValueEstimate || 0).toLocaleString()}
                                        </div>
                                        {lead.nextFollowUpDate && (
                                          <div className={`flex items-center text-[11px] font-medium mt-1 pt-1 border-t border-border/50 ${isOverdue ? "text-destructive" : "text-primary"}`}>
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {format(new Date(lead.nextFollowUpDate + "T12:00:00"), "MMM d")}
                                            {isOverdue && " (overdue)"}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedLead(null)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto border border-border z-10">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h2 className="text-lg font-bold">{selectedLead.companyName}</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedLead(null)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <Row label="Contact" value={selectedLead.contactName} />
              <Row label="Title" value={selectedLead.title} />
              <Row label="Email" value={selectedLead.email} />
              <Row label="Phone" value={selectedLead.phone} />
              <Row label="Pipeline Type" value={selectedLead.pipelineType} />
              <Row label="Status" value={selectedLead.status} />
              <Row label="Project Type" value={selectedLead.projectType} />
              <Row label="Location" value={selectedLead.location} />
              <Row label="Deal Value" value={selectedLead.dealValueEstimate ? `$${Number(selectedLead.dealValueEstimate).toLocaleString()}` : undefined} />
              <Row label="Proposal Value" value={selectedLead.proposalValue ? `$${Number(selectedLead.proposalValue).toLocaleString()}` : undefined} />
              <Row label="Close Probability" value={selectedLead.closeProbability ? `${selectedLead.closeProbability}%` : undefined} />
              <Row label="Forecast" value={selectedLead.forecastValue ? `$${Number(selectedLead.forecastValue).toLocaleString()}` : undefined} />
              <Row label="Next Step" value={selectedLead.nextStep} />
              <Row label="Next Follow-Up" value={selectedLead.nextFollowUpDate} />
              <Row label="Source" value={selectedLead.source} />
              {selectedLead.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap text-foreground">{selectedLead.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
