import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { useGetTasks, useGetLeads, useCreateTask, useUpdateTask, useCompleteTask, useDeleteTask, getGetTasksQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, Clock, Plus, Trash2, Edit2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const TASK_TYPES = ["Follow-up", "Call", "Send Deck", "Proposal", "Check-In", "Meeting Prep", "Post-Meeting Follow-Up"];

export default function Tasks() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [newTask, setNewTask] = useState({ leadId: undefined as number | undefined, taskType: "Follow-up", dueDate: "", notes: "", status: "pending" });

  const { data: tasks, isLoading } = useGetTasks({ dueFilter: filter as any });
  const { data: leads } = useGetLeads();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const completeMutation = useCompleteTask();
  const deleteMutation = useDeleteTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  const handleComplete = (id: number) => {
    completeMutation.mutate({ id }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this task?")) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Task deleted" }); } });
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setNewTask({ leadId: task.leadId || undefined, taskType: task.taskType, dueDate: task.dueDate || "", notes: task.notes || "", status: task.status });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!newTask.taskType) return;
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: newTask }, {
        onSuccess: () => {
          invalidate();
          setModalOpen(false);
          setEditingTask(null);
          setNewTask({ leadId: undefined, taskType: "Follow-up", dueDate: "", notes: "", status: "pending" });
          toast({ title: "Task updated" });
        },
      });
    } else {
      createMutation.mutate({ data: newTask }, {
        onSuccess: () => {
          invalidate();
          setModalOpen(false);
          setNewTask({ leadId: undefined, taskType: "Follow-up", dueDate: "", notes: "", status: "pending" });
          toast({ title: "Task created" });
        },
      });
    }
  };

  const filters = [
    { key: undefined, label: "All" },
    { key: "today", label: "Due Today" },
    { key: "overdue", label: "Overdue" },
    { key: "next7days", label: "Next 7 Days" },
  ] as const;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Tasks & Follow-Ups</h1>
            <p className="text-muted-foreground text-sm mt-1">Your action items tied to leads.</p>
          </div>
          <Button onClick={() => { setEditingTask(null); setNewTask({ leadId: undefined, taskType: "Follow-up", dueDate: "", notes: "", status: "pending" }); setModalOpen(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <Button
              key={f.key ?? "all"}
              variant={filter === f.key ? "default" : "outline"}
              className={`rounded-full text-sm ${filter === f.key ? (f.key === "overdue" ? "bg-destructive text-destructive-foreground" : "shadow-md") : f.key === "overdue" ? "text-destructive border-destructive/30 hover:bg-destructive/10" : "bg-card"}`}
              onClick={() => setFilter(f.key as any)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <Card className="bg-card border-border/50 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : tasks?.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
              <h3 className="text-lg font-bold">All caught up!</h3>
              <p className="text-muted-foreground text-sm">No tasks for this view.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasks?.map((task) => {
                const dueDate = task.dueDate ? new Date(task.dueDate + "T12:00:00") : null;
                const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && task.status !== "completed";
                const dueToday = dueDate && isToday(dueDate);
                const completed = task.status === "completed";

                return (
                  <div key={task.id} className={`p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors ${overdue ? "bg-destructive/5" : ""} ${completed ? "opacity-50" : ""}`}>
                    <button onClick={() => !completed && handleComplete(task.id)} className={`mt-1 flex-shrink-0 transition-colors focus:outline-none ${completed ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500"}`}>
                      {completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${completed ? "line-through" : ""}`}>{task.taskType}</span>
                        {task.leadCompanyName && <span className="text-xs text-muted-foreground">&middot; {task.leadCompanyName}</span>}
                      </div>
                      {task.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {dueDate && (
                        <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-md ${overdue ? "bg-destructive/10 text-destructive" : dueToday ? "bg-accent/20 text-yellow-700" : "bg-muted text-muted-foreground"}`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {format(dueDate, "MMM d")}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(task)} title="Edit">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">{editingTask ? "Edit Task" : "New Task"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Task Type</label>
                <select value={newTask.taskType} onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Linked Lead</label>
                <select value={newTask.leadId ?? ""} onChange={(e) => setNewTask({ ...newTask, leadId: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  <option value="">— No lead —</option>
                  {leads?.map((l) => <option key={l.id} value={l.id}>{l.companyName} - {l.contactName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Due Date</label>
                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Notes</label>
                <textarea value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[70px] resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl" disabled={createMutation.isPending || updateMutation.isPending}>{editingTask ? "Save" : "Create Task"}</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
