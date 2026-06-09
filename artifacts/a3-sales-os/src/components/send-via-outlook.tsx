// "Send via Outlook" CRM action.
//
// Opens a pre-filled Outlook compose window (web deep link or desktop mailto:)
// for a contact, so the rep reviews and SENDS the email manually inside Outlook
// — the email is never sent silently from the CRM. After opening, the action is
// logged as CRM activity ("outlook_email_opened"), the contact is marked
// "Outlook draft opened" (never "Sent"), and a follow-up date is seeded
// (+3 business days, editable). The rep manually marks "Sent" / "Needs
// follow-up" here.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, ExternalLink, Send, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  BUILTIN_TEMPLATES,
  buildOutlookComposeUrl,
  mergeTemplate,
  addBusinessDays,
  toDateInputValue,
  type ComposeMode,
  type MergeRep,
} from "@/lib/outlook-compose";

const API_BASE = import.meta.env.BASE_URL + "api";
const REP_STORAGE_KEY = "opypal_outlook_rep";

interface SavedTemplate {
  id: number;
  name: string;
  subject?: string | null;
  body: string;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || res.statusText);
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || res.statusText);
  return res.json() as Promise<T>;
}

const STATUS_LABELS: Record<string, string> = {
  outlook_draft_opened: "Outlook draft opened",
  sent: "Sent",
  needs_follow_up: "Needs follow-up",
};
const STATUS_COLORS: Record<string, string> = {
  outlook_draft_opened: "bg-blue-100 text-blue-700",
  sent: "bg-emerald-100 text-emerald-700",
  needs_follow_up: "bg-amber-100 text-amber-700",
};

function loadRep(fallbackEmail: string): MergeRep {
  try {
    const raw = localStorage.getItem(REP_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const local = (fallbackEmail || "").split("@")[0].replace(/[._]/g, " ");
  const name = local.replace(/\b\w/g, (c) => c.toUpperCase());
  return { name, email: fallbackEmail, phone: "" };
}

export function SendViaOutlook({
  contact,
  opportunity,
  variant = "button",
  onUpdated,
}: {
  contact: any;
  opportunity?: { id?: number; name?: string } | null;
  variant?: "button" | "icon";
  onUpdated?: () => void;
}) {
  const { me } = useWorkspace();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("builtin:intro");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rep, setRep] = useState<MergeRep>({ name: "", email: "", phone: "" });
  const [opening, setOpening] = useState(false);

  // Post-open state (mirrors the contact's saved Outlook status / follow-up date).
  const [status, setStatus] = useState<string | null>(contact.outlookStatus ?? null);
  const [followUp, setFollowUp] = useState<string>(
    contact.followUpDate ? toDateInputValue(new Date(contact.followUpDate)) : "",
  );
  const [savingStatus, setSavingStatus] = useState(false);

  const mergeCtx = useMemo(
    () => ({
      firstName: contact.firstName,
      lastName: contact.lastName,
      fullName: contact.fullName,
      company: contact.company,
      email: contact.email,
    }),
    [contact],
  );
  const opp = useMemo(
    () => ({ name: opportunity?.name ?? contact.company, opportunityName: opportunity?.name }),
    [opportunity, contact.company],
  );

  // Initialize when the dialog opens: rep identity, saved templates, default body.
  useEffect(() => {
    if (!open) return;
    setRep(loadRep(me?.email ?? ""));
    setStatus(contact.outlookStatus ?? null);
    setFollowUp(contact.followUpDate ? toDateInputValue(new Date(contact.followUpDate)) : "");
    fetch(`${API_BASE}/templates?isActive=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SavedTemplate[]) => setSaved(Array.isArray(rows) ? rows : []))
      .catch(() => setSaved([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-merge whenever the chosen template or rep identity changes.
  function applyTemplate(id: string, repNow: MergeRep) {
    if (id.startsWith("builtin:")) {
      const t = BUILTIN_TEMPLATES.find((x) => `builtin:${x.id}` === id);
      if (!t) return;
      setSubject(mergeTemplate(t.subject, mergeCtx, opp, repNow));
      setBody(mergeTemplate(t.body, mergeCtx, opp, repNow));
    } else {
      const sid = Number(id.replace("saved:", ""));
      const t = saved.find((x) => x.id === sid);
      if (!t) return;
      setSubject(mergeTemplate(t.subject || "", mergeCtx, opp, repNow));
      setBody(mergeTemplate(t.body || "", mergeCtx, opp, repNow));
    }
  }

  useEffect(() => {
    if (open) applyTemplate(templateId, rep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId, saved, rep.name, rep.email, rep.phone]);

  const currentTemplateName = useMemo(() => {
    if (templateId.startsWith("builtin:")) {
      return BUILTIN_TEMPLATES.find((x) => `builtin:${x.id}` === templateId)?.name ?? "Custom";
    }
    return saved.find((x) => `saved:${x.id}` === templateId)?.name ?? "Saved template";
  }, [templateId, saved]);

  async function handleOpen(mode: ComposeMode) {
    if (!contact.email) {
      toast({ title: "No email address", description: "This contact has no email.", variant: "destructive" });
      return;
    }
    setOpening(true);
    try {
      // Persist rep identity for next time.
      try {
        localStorage.setItem(REP_STORAGE_KEY, JSON.stringify(rep));
      } catch {
        /* ignore */
      }

      const url = buildOutlookComposeUrl({ to: contact.email, subject, body, mode });
      window.open(url, "_blank", "noopener");

      const updated: any = await apiPost(`/contacts/${contact.id}/outlook-opened`, {
        templateName: currentTemplateName,
        subjectPreview: subject.slice(0, 120),
        opportunityId: opportunity?.id ?? null,
      });
      setStatus(updated.outlookStatus ?? "outlook_draft_opened");
      if (updated.followUpDate) setFollowUp(toDateInputValue(new Date(updated.followUpDate)));
      else setFollowUp(toDateInputValue(addBusinessDays(new Date(), 3)));
      toast({
        title: "Opened in Outlook",
        description: `Logged the draft for ${contact.fullName}. Review and send inside Outlook.`,
      });
      onUpdated?.();
    } catch (err: any) {
      toast({ title: "Opened, but logging failed", description: err.message, variant: "destructive" });
    } finally {
      setOpening(false);
    }
  }

  async function markStatus(next: "sent" | "needs_follow_up") {
    setSavingStatus(true);
    try {
      const updated: any = await apiPatch(`/contacts/${contact.id}/outlook-status`, { status: next });
      setStatus(updated.outlookStatus ?? next);
      toast({ title: `Marked ${STATUS_LABELS[next]}` });
      onUpdated?.();
    } catch (err: any) {
      toast({ title: "Could not update status", description: err.message, variant: "destructive" });
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveFollowUp(value: string) {
    setFollowUp(value);
    try {
      await apiPatch(`/contacts/${contact.id}/follow-up-date`, {
        followUpDate: value ? new Date(value).toISOString() : null,
      });
      onUpdated?.();
    } catch (err: any) {
      toast({ title: "Could not save follow-up date", description: err.message, variant: "destructive" });
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-sky-600"
          title="Send via Outlook"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Mail className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 border-sky-200 text-sky-700"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Mail className="h-4 w-4" /> Send via Outlook
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-sky-600" /> Send via Outlook
            </DialogTitle>
            <DialogDescription>
              Pick a template, review the merged email, then open it in Outlook to send manually. To:{" "}
              <span className="font-medium text-foreground">{contact.email || "— no email —"}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Built-in</SelectLabel>
                      {BUILTIN_TEMPLATES.map((t) => (
                        <SelectItem key={t.id} value={`builtin:${t.id}`}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {saved.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Your templates</SelectLabel>
                        {saved.map((t) => (
                          <SelectItem key={t.id} value={`saved:${t.id}`}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your name (rep)</Label>
                <Input
                  value={rep.name ?? ""}
                  onChange={(e) => setRep((r) => ({ ...r, name: e.target.value }))}
                  placeholder="Rep name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your email</Label>
                <Input
                  value={rep.email ?? ""}
                  onChange={(e) => setRep((r) => ({ ...r, email: e.target.value }))}
                  placeholder="rep@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your phone</Label>
                <Input
                  value={rep.phone ?? ""}
                  onChange={(e) => setRep((r) => ({ ...r, phone: e.target.value }))}
                  placeholder="(optional)"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} className="font-sans" />
              <p className="text-[11px] text-muted-foreground">
                Variables like {"{{firstName}}"}, {"{{company}}"}, {"{{repName}}"} are filled in automatically. Edit
                freely before sending.
              </p>
            </div>

            {status && (
              <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge className={`${STATUS_COLORS[status] || "bg-gray-100 text-gray-700"} border-0`}>
                    {STATUS_LABELS[status] || status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs">Follow-up</Label>
                  <Input
                    type="date"
                    value={followUp}
                    onChange={(e) => saveFollowUp(e.target.value)}
                    className="h-8 w-[170px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-emerald-200 text-emerald-700"
                    disabled={savingStatus}
                    onClick={() => markStatus("sent")}
                  >
                    <Send className="h-3.5 w-3.5" /> Mark Sent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 border-amber-200 text-amber-700"
                    disabled={savingStatus}
                    onClick={() => markStatus("needs_follow_up")}
                  >
                    <Clock className="h-3.5 w-3.5" /> Needs follow-up
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => handleOpen("mailto")}
              disabled={opening || !contact.email}
              title="Open in your desktop mail client"
            >
              Desktop mail
            </Button>
            <Button
              className="rounded-xl gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
              onClick={() => handleOpen("web")}
              disabled={opening || !contact.email}
            >
              {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Open in Outlook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SendViaOutlook;
