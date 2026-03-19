import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetTasks, useCompleteTask, getGetTasksQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, Clock, Plus, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Tasks() {
  const [filter, setFilter] = useState<"today" | "overdue" | "next7days" | undefined>(undefined);
  const { data: tasks, isLoading } = useGetTasks({ dueFilter: filter });
  const completeMutation = useCompleteTask();
  const queryClient = useQueryClient();

  const handleComplete = (id: number) => {
    completeMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tasks</h1>
            <p className="text-muted-foreground mt-1">Your daily action items and follow-ups.</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/25">
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>

        <div className="flex gap-2 pb-2 overflow-x-auto">
          <Button 
            variant={filter === undefined ? "default" : "outline"} 
            className={`rounded-full ${filter === undefined ? 'shadow-md' : 'bg-card'}`}
            onClick={() => setFilter(undefined)}
          >
            All Pending
          </Button>
          <Button 
            variant={filter === "today" ? "default" : "outline"} 
            className={`rounded-full ${filter === "today" ? 'shadow-md' : 'bg-card'}`}
            onClick={() => setFilter("today")}
          >
            Due Today
          </Button>
          <Button 
            variant={filter === "overdue" ? "default" : "outline"} 
            className={`rounded-full ${filter === "overdue" ? 'bg-destructive text-destructive-foreground shadow-md' : 'bg-card text-destructive border-destructive/30 hover:bg-destructive/10'}`}
            onClick={() => setFilter("overdue")}
          >
            Overdue
          </Button>
          <Button 
            variant={filter === "next7days" ? "default" : "outline"} 
            className={`rounded-full ${filter === "next7days" ? 'shadow-md' : 'bg-card'}`}
            onClick={() => setFilter("next7days")}
          >
            Next 7 Days
          </Button>
        </div>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>
          ) : tasks?.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-3" />
              <h3 className="text-lg font-bold">All caught up!</h3>
              <p className="text-muted-foreground">No pending tasks for this view.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasks?.map(task => {
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                const overdue = dueDate && isPast(dueDate) && !isToday(dueDate);
                
                return (
                  <div key={task.id} className={`p-4 flex items-start gap-4 hover:bg-muted/30 transition-colors group ${overdue ? 'bg-destructive/5' : ''}`}>
                    <button 
                      onClick={() => handleComplete(task.id)}
                      className="mt-1 flex-shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors focus:outline-none"
                    >
                      <Circle className="h-6 w-6" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <h4 className="font-semibold text-foreground text-base">
                          {task.taskType} 
                          {task.leadCompanyName && <span className="font-normal text-muted-foreground"> • {task.leadCompanyName}</span>}
                        </h4>
                        {dueDate && (
                          <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-md ${
                            overdue ? 'bg-destructive/10 text-destructive' : 
                            isToday(dueDate) ? 'bg-accent/20 text-yellow-700' : 'bg-muted text-muted-foreground'
                          }`}>
                            <Clock className="h-3 w-3 mr-1" />
                            {format(dueDate, 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      {task.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{task.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
