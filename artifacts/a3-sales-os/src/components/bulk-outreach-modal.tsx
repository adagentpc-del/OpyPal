import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, AlertTriangle, CheckCircle, Loader2, Users, Send, Clock, ChevronDown, ChevronUp, Shield, Ban, MailWarning, Eye, ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useGetTemplates, useGetTemplateSets } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL + "api";

interface BulkRecipient {
  leadId: number;
  companyName: string;
  contactName: string;
  email: string;
  title?: string;
  location?: string;
  industry?: string;
  isUnsubscribed?: boolean;
  isBounced?: boolean;
}

interface BulkOutreachModalProps {
  selectedLeads: any[];
  onClose: () => void;
  onComplete: () => void;
}

type Step = "setup" | "preview" | "confirm" | "sending" | "results";

function personalize(text: string, lead: BulkRecipient): string {
  const firstName = (lead.contactName || "").split(" ")[0] || lead.contactName || "";
  return text
    .replace(/\[First Name\]/gi, firstName)
    .replace(/\[Contact Name\]/gi, lead.contactName || "")
    .replace(/\[Company Name\]/gi, lead.companyName || "")
    .replace(/\[Name\]/gi, lead.contactName || "")
    .replace(/\[venue \/ agency\]/gi, lead.companyName || "")
    .replace(/\[Location\]/gi, lead.location || "")
    .replace(/\[Title\]/gi, lead.title || "")
    .replace(/\{\{first_name\}\}/gi, firstName)
    .replace(/\{\{greeting\}\}/gi, `Hi ${firstName},`)
    .replace(/\{\{company\}\}/gi, lead.companyName || "")
    .replace(/\{\{title\}\}/gi, lead.title || "")
    .replace(/\{\{location\}\}/gi, lead.location || "");
}

export function BulkOutreachModal({ selectedLeads, onClose, onComplete }: BulkOutreachModalProps) {
  const [step, setStep] = useState<Step>("setup");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [mode, setMode] = useState<"send_now" | "schedule">("send_now");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedSequenceId, setSelectedSequenceId] = useState<number | null>(null);
  const [activateSequence, setActivateSequence] = useState(true);
  const [campaignName, setCampaignName] = useState(`Bulk outreach ${new Date().toLocaleDateString()}`);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [resendConnected, setResendConnected] = useState<boolean | null>(null);

  const { data: allTemplates } = useGetTemplates();
  const { data: templateSets } = useGetTemplateSets();

  const emailTemplates = useMemo(() =>
    (allTemplates || []).filter((t: any) => ["Cold Email", "Follow-Up Email"].includes(t.category)),
    [allTemplates]
  );

  const selectedTemplate = useMemo(() =>
    selectedTemplateId ? (allTemplates || []).find((t: any) => t.id === selectedTemplateId) : null,
    [selectedTemplateId, allTemplates]
  );

  const recipients: BulkRecipient[] = useMemo(() =>
    selectedLeads.map(l => ({
      leadId: l.id,
      companyName: l.companyName || "",
      contactName: l.contactName || "",
      email: l.email || "",
      title: l.title || "",
      location: l.location || "",
      industry: l.industry || "",
      isUnsubscribed: l.unsubscribed || false,
      isBounced: l.bounced || false,
    })),
    [selectedLeads]
  );

  useEffect(() => {
    fetch(`${API_BASE}/bulk-send/check-connection`)
      .then(r => r.json())
      .then(d => setResendConnected(d.connected))
      .catch(() => setResendConnected(false));
  }, []);

  const handleTemplateSelect = useCallback((templateId: number) => {
    const t = (allTemplates || []).find((t: any) => t.id === templateId);
    if (t) {
      setSelectedTemplateId(templateId);
      setSubject(t.subject || "");
      setBody(t.body || "");
    }
  }, [allTemplates]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch(`${API_BASE}/bulk-send/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, sequenceId: selectedSequenceId }),
      });
      if (!res.ok) throw new Error("Validation failed");
      const data = await res.json();
      setValidationResult(data);
      setStep("preview");
    } catch (err) {
      console.error(err);
    } finally {
      setValidating(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setStep("sending");
    try {
      const readyRecipients = validationResult?.readyRecipients || recipients;
      const res = await fetch(`${API_BASE}/bulk-send/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: readyRecipients,
          templateId: selectedTemplateId,
          templateName: selectedTemplate?.name,
          subject,
          body,
          sequenceId: selectedSequenceId,
          activateSequence,
          mode,
          scheduledFor: mode === "schedule" ? scheduledFor : undefined,
          campaignName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Send failed");
      }
      const result = await res.json();
      setSendResult(result);
      setStep("results");
    } catch (err: any) {
      setSendResult({ error: err.message });
      setStep("results");
    } finally {
      setSending(false);
    }
  };

  const readyCount = validationResult?.ready || recipients.length;
  const totalSkipped = validationResult?.totalSkipped || 0;

  const previewRecipient = validationResult?.readyRecipients?.[previewIndex] || recipients[previewIndex];
  const personalizedSubject = previewRecipient ? personalize(subject, previewRecipient) : subject;
  const personalizedBody = previewRecipient ? personalize(body, previewRecipient) : body;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 sm:pt-8 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={step === "sending" ? undefined : onClose} />
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-border z-10 flex flex-col">

        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bulk Outreach</h2>
              <p className="text-xs text-muted-foreground">{selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StepIndicator currentStep={step} />
            {step !== "sending" && (
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "setup" && (
            <SetupStep
              subject={subject} setSubject={setSubject}
              body={body} setBody={setBody}
              mode={mode} setMode={setMode}
              scheduledFor={scheduledFor} setScheduledFor={setScheduledFor}
              selectedTemplateId={selectedTemplateId}
              emailTemplates={emailTemplates}
              templateSets={templateSets || []}
              onTemplateSelect={handleTemplateSelect}
              campaignName={campaignName} setCampaignName={setCampaignName}
              resendConnected={resendConnected}
              recipientCount={recipients.length}
            />
          )}

          {step === "preview" && (
            <PreviewStep
              validationResult={validationResult}
              readyCount={readyCount}
              totalSkipped={totalSkipped}
              previewRecipient={previewRecipient}
              previewIndex={previewIndex}
              setPreviewIndex={setPreviewIndex}
              personalizedSubject={personalizedSubject}
              personalizedBody={personalizedBody}
              showSuppressed={showSuppressed}
              setShowSuppressed={setShowSuppressed}
              mode={mode}
            />
          )}

          {step === "confirm" && (
            <ConfirmStep
              readyCount={readyCount}
              totalSkipped={totalSkipped}
              mode={mode}
              scheduledFor={scheduledFor}
              subject={subject}
              campaignName={campaignName}
              templateName={selectedTemplate?.name}
            />
          )}

          {step === "sending" && <SendingStep mode={mode} readyCount={readyCount} />}

          {step === "results" && (
            <ResultsStep sendResult={sendResult} mode={mode} />
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex justify-between rounded-b-2xl">
          <div>
            {step === "preview" && (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep("setup")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            {step === "confirm" && (
              <Button variant="outline" className="rounded-xl" onClick={() => setStep("preview")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {step === "setup" && (
              <Button
                className="bg-primary text-white rounded-xl"
                onClick={handleValidate}
                disabled={!subject || !body || validating || (mode === "send_now" && resendConnected === false)}
              >
                {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                Validate & Preview
              </Button>
            )}
            {step === "preview" && (
              <Button className="bg-primary text-white rounded-xl" onClick={() => setStep("confirm")} disabled={readyCount === 0}>
                <ArrowRight className="h-4 w-4 mr-2" /> Continue
              </Button>
            )}
            {step === "confirm" && (
              <Button
                className="bg-primary text-white rounded-xl"
                onClick={handleSend}
                disabled={sending}
              >
                {mode === "send_now" ? <Send className="h-4 w-4 mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                {mode === "send_now" ? `Send to ${readyCount} recipients` : `Schedule for ${readyCount} recipients`}
              </Button>
            )}
            {step === "results" && (
              <Button className="bg-primary text-white rounded-xl" onClick={() => { onComplete(); onClose(); }}>
                <CheckCircle className="h-4 w-4 mr-2" /> Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "setup", label: "Setup" },
    { key: "preview", label: "Preview" },
    { key: "confirm", label: "Confirm" },
    { key: "sending", label: "Sending" },
    { key: "results", label: "Results" },
  ];
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="hidden sm:flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-border"}`} />
          {i < steps.length - 1 && <div className={`w-3 h-px ${i < currentIdx ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function SetupStep({ subject, setSubject, body, setBody, mode, setMode, scheduledFor, setScheduledFor, selectedTemplateId, emailTemplates, templateSets, onTemplateSelect, campaignName, setCampaignName, resendConnected, recipientCount }: any) {
  const [templateSearch, setTemplateSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return emailTemplates;
    const q = templateSearch.toLowerCase();
    return emailTemplates.filter((t: any) =>
      t.name?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q)
    );
  }, [emailTemplates, templateSearch]);

  return (
    <div className="space-y-5">
      {resendConnected === false && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Resend not connected</p>
            <p className="text-xs text-muted-foreground mt-1">Configure the Resend integration to send emails. You can still schedule emails for later.</p>
          </div>
        </div>
      )}

      {resendConnected === true && (
        <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700">Resend connected — ready to send</span>
        </div>
      )}

      <div>
        <label className="text-sm font-medium mb-1.5 block">Campaign Name</label>
        <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Choose Template</label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search templates..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-border text-xs bg-background" />
        </div>
        <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border/50">
          {filteredTemplates.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground text-center">No templates found</p>
          ) : (
            filteredTemplates.map((t: any) => (
              <button key={t.id} onClick={() => onTemplateSelect(t.id)}
                className={`w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors ${selectedTemplateId === t.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}>
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Subject Line</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter subject..."
          className="w-full px-3 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background" />
        <p className="text-[10px] text-muted-foreground mt-1">Use [First Name], [Company Name], etc. for personalization</p>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Email Body</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Write your email..."
          className="w-full px-3 py-2 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-background resize-none font-mono" />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Send Mode</label>
        <div className="flex gap-3">
          <button onClick={() => setMode("send_now")}
            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${mode === "send_now" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
            <Send className={`h-4 w-4 ${mode === "send_now" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-left">
              <p className={`text-sm font-medium ${mode === "send_now" ? "text-primary" : ""}`}>Send Now</p>
              <p className="text-[10px] text-muted-foreground">Deliver immediately via Resend</p>
            </div>
          </button>
          <button onClick={() => setMode("schedule")}
            className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${mode === "schedule" ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}>
            <Clock className={`h-4 w-4 ${mode === "schedule" ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-left">
              <p className={`text-sm font-medium ${mode === "schedule" ? "text-primary" : ""}`}>Schedule</p>
              <p className="text-[10px] text-muted-foreground">Queue for a specific date/time</p>
            </div>
          </button>
        </div>
        {mode === "schedule" && (
          <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
            className="mt-2 w-full px-3 py-2 rounded-xl border border-border text-sm bg-background" />
        )}
      </div>

      <div className="p-3 rounded-xl bg-muted/50 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          <strong className="text-foreground">{recipientCount}</strong> recipients will be validated for suppressions before sending
        </span>
      </div>
    </div>
  );
}

function PreviewStep({ validationResult, readyCount, totalSkipped, previewRecipient, previewIndex, setPreviewIndex, personalizedSubject, personalizedBody, showSuppressed, setShowSuppressed, mode }: any) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
          <p className="text-2xl font-bold text-emerald-700">{readyCount}</p>
          <p className="text-xs text-emerald-600">Ready to {mode === "send_now" ? "send" : "schedule"}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
          <p className="text-2xl font-bold text-amber-700">{totalSkipped}</p>
          <p className="text-xs text-amber-600">Suppressed</p>
        </div>
        <div className="p-3 rounded-xl bg-muted border border-border text-center sm:col-span-1 col-span-2">
          <p className="text-2xl font-bold">{readyCount + totalSkipped}</p>
          <p className="text-xs text-muted-foreground">Total selected</p>
        </div>
      </div>

      {totalSkipped > 0 && (
        <div>
          <button onClick={() => setShowSuppressed(!showSuppressed)}
            className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800">
            <Shield className="h-4 w-4" />
            Suppression details
            {showSuppressed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showSuppressed && validationResult && (
            <div className="mt-2 space-y-2 text-xs">
              {validationResult.skippedNoEmail > 0 && (
                <SuppressionRow icon={<MailWarning className="h-3.5 w-3.5" />} label="No email address" count={validationResult.skippedNoEmail}
                  details={validationResult.skippedDetails?.noEmail} />
              )}
              {validationResult.skippedInvalidEmail > 0 && (
                <SuppressionRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Invalid email" count={validationResult.skippedInvalidEmail}
                  details={validationResult.skippedDetails?.invalidEmail} />
              )}
              {validationResult.skippedUnsubscribed > 0 && (
                <SuppressionRow icon={<Ban className="h-3.5 w-3.5" />} label="Unsubscribed" count={validationResult.skippedUnsubscribed}
                  details={validationResult.skippedDetails?.unsubscribed} />
              )}
              {validationResult.skippedBounced > 0 && (
                <SuppressionRow icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Bounced" count={validationResult.skippedBounced}
                  details={validationResult.skippedDetails?.bounced} />
              )}
              {validationResult.skippedDuplicateEmail > 0 && (
                <SuppressionRow icon={<Users className="h-3.5 w-3.5" />} label="Duplicate email" count={validationResult.skippedDuplicateEmail}
                  details={validationResult.skippedDetails?.duplicateEmail} />
              )}
              {validationResult.skippedDuplicateEnrollment > 0 && (
                <SuppressionRow icon={<Ban className="h-3.5 w-3.5" />} label="Already enrolled" count={validationResult.skippedDuplicateEnrollment}
                  details={validationResult.skippedDetails?.duplicateEnrollment} />
              )}
            </div>
          )}
        </div>
      )}

      {readyCount > 0 && previewRecipient && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Personalization Preview
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button variant="outline" size="icon" className="h-6 w-6 rounded-lg"
                disabled={previewIndex === 0} onClick={() => setPreviewIndex(previewIndex - 1)}>
                <ArrowLeft className="h-3 w-3" />
              </Button>
              <span>{previewIndex + 1} / {readyCount}</span>
              <Button variant="outline" size="icon" className="h-6 w-6 rounded-lg"
                disabled={previewIndex >= readyCount - 1} onClick={() => setPreviewIndex(previewIndex + 1)}>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">To: <span className="text-foreground font-medium">{previewRecipient.contactName}</span> &lt;{previewRecipient.email}&gt;</p>
                <p className="text-xs text-muted-foreground">Company: {previewRecipient.companyName}</p>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold mb-2">{personalizedSubject}</p>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border/50 pt-2">{personalizedBody}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SuppressionRow({ icon, label, count, details }: { icon: React.ReactNode; label: string; count: number; details?: any[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-2 hover:bg-amber-50">
        <div className="flex items-center gap-2 text-amber-700">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-semibold text-amber-700">{count}</span>
      </button>
      {expanded && details?.length > 0 && (
        <div className="px-3 pb-2 space-y-0.5">
          {details.slice(0, 10).map((d: any, i: number) => (
            <p key={i} className="text-muted-foreground">{d.companyName}{d.email ? ` (${d.email})` : ""}</p>
          ))}
          {details.length > 10 && <p className="text-muted-foreground italic">...and {details.length - 10} more</p>}
        </div>
      )}
    </div>
  );
}

function ConfirmStep({ readyCount, totalSkipped, mode, scheduledFor, subject, campaignName, templateName }: any) {
  return (
    <div className="space-y-5">
      <div className="text-center py-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          {mode === "send_now" ? <Send className="h-8 w-8 text-primary" /> : <Clock className="h-8 w-8 text-primary" />}
        </div>
        <h3 className="text-xl font-bold">
          {mode === "send_now" ? "Ready to send" : "Ready to schedule"}
        </h3>
        <p className="text-muted-foreground mt-1">Please review the details below</p>
      </div>

      <div className="rounded-xl border border-border divide-y divide-border/50">
        <div className="px-4 py-3 flex justify-between">
          <span className="text-sm text-muted-foreground">Campaign</span>
          <span className="text-sm font-medium">{campaignName}</span>
        </div>
        {templateName && (
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-muted-foreground">Template</span>
            <span className="text-sm font-medium">{templateName}</span>
          </div>
        )}
        <div className="px-4 py-3 flex justify-between">
          <span className="text-sm text-muted-foreground">Subject</span>
          <span className="text-sm font-medium truncate ml-4">{subject}</span>
        </div>
        <div className="px-4 py-3 flex justify-between">
          <span className="text-sm text-muted-foreground">Recipients</span>
          <span className="text-sm font-bold text-emerald-600">{readyCount}</span>
        </div>
        {totalSkipped > 0 && (
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-muted-foreground">Suppressed</span>
            <span className="text-sm font-medium text-amber-600">{totalSkipped}</span>
          </div>
        )}
        <div className="px-4 py-3 flex justify-between">
          <span className="text-sm text-muted-foreground">Delivery</span>
          <span className="text-sm font-medium">
            {mode === "send_now" ? "Immediately via Resend" : `Scheduled: ${scheduledFor ? new Date(scheduledFor).toLocaleString() : "—"}`}
          </span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          {mode === "send_now"
            ? "Emails will be sent immediately and cannot be recalled. Delivery is throttled at 10 emails per second."
            : "Emails will be queued for the selected date/time. You can cancel them from the Scheduled Emails page."}
        </p>
      </div>
    </div>
  );
}

function SendingStep({ mode, readyCount }: { mode: string; readyCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <h3 className="text-lg font-bold">{mode === "send_now" ? "Sending emails..." : "Scheduling emails..."}</h3>
      <p className="text-sm text-muted-foreground mt-1">Processing {readyCount} recipients. Please don't close this window.</p>
    </div>
  );
}

function ResultsStep({ sendResult, mode }: { sendResult: any; mode: string }) {
  if (sendResult?.error) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h3 className="text-lg font-bold text-destructive">Send failed</h3>
        <p className="text-sm text-muted-foreground mt-1">{sendResult.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center py-4">
        <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold">
          {mode === "send_now" ? "Emails sent!" : "Emails scheduled!"}
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {sendResult?.totalSent > 0 && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-2xl font-bold text-emerald-700">{sendResult.totalSent}</p>
            <p className="text-xs text-emerald-600">Sent</p>
          </div>
        )}
        {sendResult?.totalScheduled > 0 && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
            <p className="text-2xl font-bold text-blue-700">{sendResult.totalScheduled}</p>
            <p className="text-xs text-blue-600">Scheduled</p>
          </div>
        )}
        {sendResult?.totalFailed > 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
            <p className="text-2xl font-bold text-red-700">{sendResult.totalFailed}</p>
            <p className="text-xs text-red-600">Failed</p>
          </div>
        )}
      </div>

      {sendResult?.results?.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Results by recipient</p>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border/50">
            {sendResult.results.map((r: any, i: number) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-foreground">{r.companyName}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  r.status === "sent" ? "bg-emerald-100 text-emerald-700" :
                  r.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                  "bg-red-100 text-red-700"
                }`}>{r.status}{r.error ? `: ${r.error}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
