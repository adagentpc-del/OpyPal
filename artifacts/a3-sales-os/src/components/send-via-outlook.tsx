// "Send via Outlook" CRM action.
//
// Opens a pre-filled Outlook compose window (web deep link or desktop mailto:)
// for a contact, so the rep reviews and SENDS the email manually inside Outlook
// — the email is never sent silently from the CRM. After opening:
//   • the draft-open is logged as activity ("outlook_draft_opened"),
//   • the rep chooses [Mark Sent] / [Save Draft] / [Cancel],
//   • only Mark Sent records an "email_sent" activity, advances the contact to
//     "Email Sent", and (after picking a follow-up date) auto-creates a task.

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
import { Mail, ExternalLink, Send, Clock, Loader2, Save, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  BUILTIN_TEMPLATES,
  buildOutlookComposeUrl,
  mergeTemplate,
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

// Follow-up presets offered after "Mark Sent".
const FOLLOWUP_PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "tomorrow", label: "Tomorrow", days: 1 },
  { key: "3d", label: "3 Days", days: 3 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "14d", label: "14 Days", days: 14 },
  { key: "custom", label: "Custom", days: null },
];

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const STATUS_COLORS: Record<string, string> = {
  "Not Contacted": "bg-gray-100 text-gray-700",
  "Email Sent": "bg-emerald-100 text-emerald-700",
  "Follow-Up Needed": "bg-amber-100 text-amber-700",
  "Replied": "bg-blue-100 text-blue-700",
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

type Step = "compose" | "opened" | "followup" | "done";

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
  const [step, setStep] = useState<Step>("compose");
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("builtin:intro");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [rep, setRep] = useState<MergeRep>({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);

  const [followKey, setFollowKey] = useState<string>("3d");
  const [customDate, setCustomDate] = useState<string>(toDateInputValue(addDays(new Date(), 3)));

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

  useEffect(() => {
    if (!open) return;
    setStep("compose");
    setRep(loadRep(me?.email ?? ""));
    fetch(`${API_BASE}/templates?isActive=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: SavedTemplate[]) => setSaved(Array.isArray(rows) ? rows : []))
      .catch(() => setSaved([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    if (open && step === "compose") applyTemplate(templateId, rep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, templateId, saved, rep.name, rep.email, rep.phone]);

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
    setBusy(true);
    try {
      try {
        localStorage.setItem(REP_STORAGE_KEY, JSON.stringify(rep));
      } catch {
        /* ignore */
      }
      const url = buildOutlookComposeUrl({ to: contact.email, subject, body, mode });
      window.open(url, "_blank", "noopener");

      await apiPost(`/contacts/${contact.id}/outlook-opened`, {
        templateName: currentTemplateName,
        subjectPreview: subject.slice(0, 120),
        opportunityId: opportunity?.id ?? null,
      });
      setStep("opened");
      onUpdated?.();
    } catch (err: any) {
      toast({ title: "Opened, but logging failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  // One-click: merge the chosen template synchronously and open Outlook in the
  // SAME user gesture (popup-safe), then log the draft. No extra clicks.
  function openTemplate(id: string, mode: ComposeMode) {
    if (!contact.email) {
      toast({ title: "No email address", description: "This contact has no email.", variant: "destructive" });
      return;
    }
    let subj = "";
    let bod = "";
    let name = "Custom";
    if (id.startsWith("builtin:")) {
      const t = BUILTIN_TEMPLATES.find((x) => `builtin:${x.id}` === id);
      if (!t) return;
      name = t.name;
      subj = mergeTemplate(t.subject, mergeCtx, opp, rep);
      bod = mergeTemplate(t.body, mergeCtx, opp, rep);
    } else {
      const sid = Number(id.replace("saved:", ""));
      const t = saved.find((x) => x.id === sid);
      if (!t) return;
      name = t.name;
      subj = mergeTemplate(t.subject || "", mergeCtx, opp, rep);
      bod = mergeTemplate(t.body || "", mergeCtx, opp, rep);
    }
    try {
      localStorage.setItem(REP_STORAGE_KEY, JSON.stringify(rep));
    } catch {
      /* ignore */
    }
    // Open Outlook FIRST, synchronously, so the browser keeps the popup.
    const url = buildOutlookComposeUrl({ to: contact.email, subject: subj, body: bod, mode });
    window.open(url, "_blank", "noopener");
    setTemplateId(id);
    setSubject(subj);
    setBody(bod);
    setBusy(true);
    apiPost(`/contacts/${contact.id}/outlook-opened`, {
      templateName: name,
      subjectPreview: subj.slice(0, 120),
      opportunityId: opportunity?.id ?? null,
    })
      .then(() => {
        setStep("opened");
        onUpdated?.();
      })
      .catch((err: any) =>
        toast({ title: "Opened, but logging failed", description: err.message, variant: "destructive" }),
      )
      .finally(() => setBusy(false));
  }

  async function confirmSent() {
    setBusy(true);
    try {
      const preset = FOLLOWUP_PRESETS.find((p) => p.key === followKey)!;
      const dueDate =
        preset.days === null ? new Date(customDate) : addDays(new Date(), preset.days);
      await apiPost(`/contacts/${contact.id}/mark-sent`, {
        templateName: currentTemplateName,
        subjectPreview: subject.slice(0, 120),
        opportunityId: opportunity?.id ?? null,
        followUpDate: dueDate.toISOString(),
        followUpLabel: preset.label,
      });
      setStep("done");
      toast({ title: "Marked Sent", description: `Follow-up task created for ${preset.label.toLowerCase()}.` });
      onUpdated?.();
    } catch (err: any) {
      toast({ title: "Could not mark sent", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
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
              To: <span className="font-medium text-foreground">{contact.email || "— no email —"}</span>
              {contact.outreachStatus && (
                <Badge className={`ml-2 border-0 ${STATUS_COLORS[contact.outreachStatus] || "bg-gray-100 text-gray-700"}`}>
                  {contact.outreachStatus}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {step === "compose" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                <p className="text-xs font-semibold text-sky-900 mb-2">
                  One click — open Outlook instantly with a template:
                </p>
                <div className="flex flex-wrap gap-2">
                  {BUILTIN_TEMPLATES.map((t) => (
                    <Button
                      key={`quick-${t.id}`}
                      type="button"
                      size="sm"
                      className="rounded-xl gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
                      disabled={busy || !contact.email}
                      onClick={() => openTemplate(`builtin:${t.id}`, "web")}
                      title={`Open Outlook with "${t.name}"`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {t.name}
                    </Button>
                  ))}
                  {saved.map((t) => (
                    <Button
                      key={`quick-saved-${t.id}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5"
                      disabled={busy || !contact.email}
                      onClick={() => openTemplate(`saved:${t.id}`, "web")}
                      title={`Open Outlook with "${t.name}"`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {t.name}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-sky-800/70 mt-2">
                  Or customize the subject/body below, then click Open in Outlook.
                </p>
              </div>
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
                  <Input value={rep.name ?? ""} onChange={(e) => setRep((r) => ({ ...r, name: e.target.value }))} placeholder="Rep name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your email</Label>
                  <Input value={rep.email ?? ""} onChange={(e) => setRep((r) => ({ ...r, email: e.target.value }))} placeholder="rep@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Your phone</Label>
                  <Input value={rep.phone ?? ""} onChange={(e) => setRep((r) => ({ ...r, phone: e.target.value }))} placeholder="(optional)" />
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
                  Variables like {"{{firstName}}"}, {"{{company}}"}, {"{{repName}}"} are filled in automatically. Edit freely before sending.
                </p>
              </div>
            </div>
          )}

          {step === "opened" && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-sky-50/60 p-4 text-sm">
                <p className="font-medium text-sky-900">Outlook draft opened in a new tab.</p>
                <p className="text-sky-800/80 mt-1">
                  Review and send it inside Outlook. Then tell the CRM what happened — only <b>Mark Sent</b> records a send.
                </p>
              </div>
            </div>
          )}

          {step === "followup" && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4 text-amber-600" /> When should we follow up?
                </div>
                <div className="flex flex-wrap gap-2">
                  {FOLLOWUP_PRESETS.map((p) => (
                    <Button
                      key={p.key}
                      type="button"
                      size="sm"
                      variant={followKey === p.key ? "default" : "outline"}
                      className="rounded-xl"
                      onClick={() => setFollowKey(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {followKey === "custom" && (
                  <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-8 w-[180px]" />
                )}
                <p className="text-[11px] text-muted-foreground">A follow-up task will be created automatically.</p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-3 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <p className="font-medium">Email logged as Sent.</p>
              <p className="text-sm text-muted-foreground">{contact.fullName} is now “Email Sent” and a follow-up task was created.</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {step === "compose" && (
              <>
                <Button variant="ghost" className="rounded-xl" onClick={() => handleOpen("mailto")} disabled={busy || !contact.email} title="Open in your desktop mail client">
                  Desktop mail
                </Button>
                <Button className="rounded-xl gap-1.5 bg-sky-600 text-white hover:bg-sky-700" onClick={() => handleOpen("web")} disabled={busy || !contact.email}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Open in Outlook
                </Button>
              </>
            )}
            {step === "opened" && (
              <>
                <Button variant="ghost" className="rounded-xl gap-1.5" onClick={() => setOpen(false)} disabled={busy}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button variant="outline" className="rounded-xl gap-1.5" onClick={() => setOpen(false)} disabled={busy} title="Keep as an opened draft; status stays 'Outlook draft opened'">
                  <Save className="h-4 w-4" /> Save Draft
                </Button>
                <Button className="rounded-xl gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setStep("followup")} disabled={busy}>
                  <Send className="h-4 w-4" /> Mark Sent
                </Button>
              </>
            )}
            {step === "followup" && (
              <>
                <Button variant="ghost" className="rounded-xl" onClick={() => setStep("opened")} disabled={busy}>
                  Back
                </Button>
                <Button className="rounded-xl gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={confirmSent} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm Sent + Create Task
                </Button>
              </>
            )}
            {step === "done" && (
              <Button className="rounded-xl" onClick={() => setOpen(false)}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SendViaOutlook;
