import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useGetTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, getGetTemplatesQueryKey, useGetLeads, useUpdateLead, getGetLeadsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Edit2, Trash2, X, Mail, UserCheck, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["Cold Email", "Follow-Up Email", "LinkedIn Message", "SMS", "Referral / Partner Outreach"];

function getNextBusinessDay(fromDate: Date, daysAhead: number): string {
  const d = new Date(fromDate);
  let added = 0;
  while (added < daysAhead) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split("T")[0];
}

function formatMailtoBody(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
}

export default function Templates() {
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: templates, isLoading } = useGetTemplates({ category: categoryFilter || undefined });
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const updateLeadMutation = useUpdateLead();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: leads } = useGetLeads();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [form, setForm] = useState({ name: "", category: "Cold Email", subject: "", body: "" });

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTemplate, setSendTemplate] = useState<any>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendSearch, setSendSearch] = useState("");
  const [sendLeadId, setSendLeadId] = useState<number | null>(null);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmLeadId, setConfirmLeadId] = useState<number | null>(null);
  const [confirmLeadName, setConfirmLeadName] = useState("");

  const leadEmails = useMemo(() => {
    if (!leads) return [];
    return leads
      .filter((l: any) => l.email)
      .map((l: any) => ({ id: l.id, email: l.email, company: l.companyName, contact: l.contactName }));
  }, [leads]);

  const filteredLeadEmails = useMemo(() => {
    if (!sendSearch) return leadEmails;
    const q = sendSearch.toLowerCase();
    return leadEmails.filter(
      (l) => l.email.toLowerCase().includes(q) || l.company?.toLowerCase().includes(q) || l.contact?.toLowerCase().includes(q)
    );
  }, [leadEmails, sendSearch]);

  const openSendModal = (template: any) => {
    setSendTemplate(template);
    setSendEmail("");
    setSendSearch("");
    setSendLeadId(null);
    setSendModalOpen(true);
  };

  const handleSendViaOutlook = () => {
    if (!sendEmail) {
      toast({ title: "Please enter or select a recipient email", variant: "destructive" });
      return;
    }
    const subject = encodeURIComponent(sendTemplate?.subject || "");
    const body = encodeURIComponent(formatMailtoBody(sendTemplate?.body || ""));
    const mailto = `mailto:${encodeURIComponent(sendEmail)}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
    setSendModalOpen(false);

    const matchedLead = sendLeadId
      ? leads?.find((l: any) => l.id === sendLeadId)
      : leads?.find((l: any) => l.email === sendEmail);

    if (matchedLead) {
      setConfirmLeadId(matchedLead.id);
      setConfirmLeadName(matchedLead.companyName || matchedLead.contactName || sendEmail);
      setTimeout(() => setConfirmModalOpen(true), 800);
    } else {
      toast({ title: "Email client opened" });
    }
  };

  const handleConfirmSent = (didSend: boolean) => {
    if (didSend && confirmLeadId) {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const followUpDate = getNextBusinessDay(today, 2);
      updateLeadMutation.mutate(
        {
          id: confirmLeadId,
          data: {
            status: "Contacted",
            lastContactDate: todayStr,
            nextStep: "Awaiting reply",
            nextFollowUpDate: followUpDate,
          } as any,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetLeadsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
            toast({ title: "Lead updated to Contacted", description: `Follow-up set for ${followUpDate}` });
          },
        }
      );
    }
    setConfirmModalOpen(false);
    setConfirmLeadId(null);
  };

  const handleMarkAsContacted = (template: any) => {
    setSendTemplate(template);
    setSendEmail("");
    setSendSearch("");
    setSendLeadId(null);
    setSendModalOpen(true);
  };

  const handleCopyFullEmail = (template: any) => {
    const parts: string[] = [];
    if (template.subject) parts.push(`Subject: ${template.subject}`);
    parts.push("");
    parts.push(template.body);
    navigator.clipboard.writeText(parts.join("\n"));
    toast({ title: "Email copied to clipboard" });
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTemplatesQueryKey() });

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: "", category: "Cold Email", subject: "", body: "" });
    setModalOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingTemplate(t);
    setForm({ name: t.name, category: t.category, subject: t.subject || "", body: t.body });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.body) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    const payload = { ...form, subject: form.subject || undefined };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template updated" }); } });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: () => { invalidate(); setModalOpen(false); toast({ title: "Template created" }); } });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    deleteMutation.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Template deleted" }); } });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-5 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Message Templates</h1>
            <p className="text-muted-foreground text-sm mt-1">Standardized outreach and follow-up copy.</p>
          </div>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-md self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" /> New Template
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant={categoryFilter === "" ? "default" : "outline"} className="rounded-full text-sm" onClick={() => setCategoryFilter("")}>All</Button>
          {CATEGORIES.map((c) => (
            <Button key={c} variant={categoryFilter === c ? "default" : "outline"} className="rounded-full text-sm" onClick={() => setCategoryFilter(c)}>
              {c}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : templates?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No templates found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {templates?.map((template) => (
              <Card key={template.id} className="bg-card border-border/50 rounded-2xl flex flex-col hover:shadow-md transition-shadow">
                <div className="p-4 sm:p-5 border-b border-border/50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">{template.category}</span>
                    <div className="flex gap-0.5 sm:gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSendModal(template)} title="Send via Outlook"><Mail className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyFullEmail(template)} title="Copy Email"><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(template)} title="Edit"><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(template.id, template.name)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <h3 className="font-bold text-base leading-tight mt-1">{template.name}</h3>
                  {template.subject && (
                    <p className="text-sm mt-1.5 text-muted-foreground"><span className="font-medium text-foreground">Subj:</span> {template.subject}</p>
                  )}
                </div>
                <div className="p-4 sm:p-5 flex-1 bg-muted/20">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{template.body}</p>
                </div>
                <div className="px-4 sm:px-5 py-3 border-t border-border/50 rounded-b-2xl flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5 flex-1 sm:flex-none" onClick={() => openSendModal(template)}>
                    <Mail className="h-3 w-3" /> Send via Outlook
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5 flex-1 sm:flex-none" onClick={() => handleCopyFullEmail(template)}>
                    <Copy className="h-3 w-3" /> Copy Email
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1.5 flex-1 sm:flex-none" onClick={() => handleMarkAsContacted(template)}>
                    <UserCheck className="h-3 w-3" /> Mark as Contacted
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border z-10">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center sticky top-0 bg-card rounded-t-2xl z-10">
              <h2 className="text-lg font-bold">{editingTemplate ? "Edit Template" : "New Template"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Subject (optional)</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Body</label>
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full p-3 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none min-h-[150px] resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSave} className="bg-primary text-white rounded-xl">{editingTemplate ? "Save" : "Create"}</Button>
            </div>
          </div>
        </div>
      )}

      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-16 px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSendModalOpen(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-border z-10">
            <div className="px-5 sm:px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-bold">Send via Outlook</h2>
              <Button variant="ghost" size="icon" onClick={() => setSendModalOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-medium mb-1">Template</p>
                <p className="text-sm font-semibold">{sendTemplate?.name}</p>
                {sendTemplate?.subject && <p className="text-xs text-muted-foreground mt-0.5">Subj: {sendTemplate.subject}</p>}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Recipient Email</label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => { setSendEmail(e.target.value); setSendSearch(e.target.value); setSendLeadId(null); }}
                  placeholder="Enter email or search leads..."
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:border-primary outline-none"
                />
              </div>
              {sendSearch && filteredLeadEmails.length > 0 && (
                <div className="border border-border rounded-xl max-h-40 overflow-y-auto">
                  {filteredLeadEmails.map((lead, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors flex justify-between items-center border-b border-border/30 last:border-0"
                      onClick={() => { setSendEmail(lead.email); setSendSearch(""); setSendLeadId(lead.id); }}
                    >
                      <span className="font-medium truncate">{lead.email}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {lead.contact || lead.company || ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {sendSearch && filteredLeadEmails.length === 0 && sendEmail.includes("@") && (
                <p className="text-xs text-muted-foreground">No matching leads. The entered email will be used.</p>
              )}
            </div>
            <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <Button variant="outline" onClick={() => setSendModalOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={handleSendViaOutlook} className="bg-primary text-white rounded-xl gap-2">
                <Mail className="h-4 w-4" /> Send via Outlook
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm border border-border z-10">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Did you send this email?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  To <span className="font-medium text-foreground">{confirmLeadName}</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                If yes, the lead will be updated to "Contacted" with a follow-up set for 2 business days.
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleConfirmSent(false)}>
                  No
                </Button>
                <Button className="flex-1 rounded-xl bg-primary text-white gap-2" onClick={() => handleConfirmSent(true)}>
                  <Check className="h-4 w-4" /> Yes, I sent it
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
