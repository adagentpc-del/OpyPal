import { AppLayout } from "@/components/layout";
import { useGetLeads, useUpdateLeadStatus, getGetLeadsQueryKey } from "@workspace/api-client-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { Building2, Calendar, DollarSign, GripVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Lead } from "@workspace/api-client-react/src/generated/api.schemas";

const STAGES = [
  "New Lead", "Contacted", "Replied", "Qualified", 
  "Meeting Booked", "Proposal Sent", "Negotiation"
];

export default function Pipeline() {
  const { data: leads, isLoading } = useGetLeads();
  const updateStatusMutation = useUpdateLeadStatus();
  const queryClient = useQueryClient();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const leadId = parseInt(result.draggableId);
    const newStatus = result.destination.droppableId;
    
    const lead = leads?.find(l => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      // Optimistically update cache
      queryClient.setQueryData(getGetLeadsQueryKey(), (old: Lead[] | undefined) => {
        if (!old) return old;
        return old.map(l => l.id === leadId ? { ...l, status: newStatus } : l);
      });

      updateStatusMutation.mutate(
        { id: leadId, data: { status: newStatus } },
        {
          onError: () => {
            queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
          }
        }
      );
    }
  };

  const getLeadsByStage = (stage: string) => {
    return leads?.filter(l => l.status === stage) || [];
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-display font-bold text-foreground">Pipeline</h1>
          <p className="text-muted-foreground mt-1">Drag and drop leads to progress them through the funnel.</p>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="flex gap-4 h-full items-start px-1 min-w-max">
                {STAGES.map(stage => (
                  <PipelineColumn 
                    key={stage} 
                    title={stage} 
                    leads={getLeadsByStage(stage)} 
                  />
                ))}
              </div>
            </DragDropContext>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PipelineColumn({ title, leads }: { title: string, leads: Lead[] }) {
  const value = leads.reduce((sum, l) => sum + (l.proposalValue || l.dealValueEstimate || 0), 0);

  return (
    <div className="flex flex-col w-[320px] max-w-[320px] h-full bg-muted/40 rounded-2xl border border-border/50">
      <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/50 rounded-t-2xl backdrop-blur-sm">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{leads.length} leads • ${(value/1000).toFixed(0)}k</p>
        </div>
      </div>
      
      <Droppable droppableId={title}>
        {(provided, snapshot) => (
          <div 
            {...provided.droppableProps} 
            ref={provided.innerRef}
            className={`flex-1 overflow-y-auto p-3 space-y-3 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id.toString()} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`
                      bg-card rounded-xl p-4 shadow-sm border
                      ${lead.pipelineType === 'Event' ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-accent'}
                      ${snapshot.isDragging ? 'kanban-dragging border-border' : 'border-border hover:border-primary/50'}
                    `}
                    style={provided.draggableProps.style}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-foreground line-clamp-1 flex-1">{lead.companyName}</h4>
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-30" />
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 mr-1.5" />
                        {lead.contactName}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <DollarSign className="h-3 w-3 mr-1.5" />
                        ${(lead.proposalValue || lead.dealValueEstimate || 0).toLocaleString()}
                      </div>
                      {lead.nextFollowUpDate && (
                        <div className="flex items-center text-xs text-primary font-medium mt-2 pt-2 border-t border-border/50">
                          <Calendar className="h-3 w-3 mr-1.5" />
                          {format(new Date(lead.nextFollowUpDate), 'MMM d')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
