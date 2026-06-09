// Outlook compose helpers for the "Send via Outlook" CRM action.
//
// The email is composed and SENT inside Outlook (web deep link or the desktop
// mail client via mailto:) so it stays visible in the rep's Outlook — it is
// never sent silently from the CRM. These are pure functions (no React, no
// network) so they're easy to unit-test and reuse.

export type ComposeMode = "web" | "mailto";

export interface MergeContact {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  email?: string | null;
}

export interface MergeOpportunity {
  name?: string | null;
  opportunityName?: string | null;
}

export interface MergeRep {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

// The four named templates from the spec plus a blank "Custom" option. All use
// {{variables}} resolved by mergeTemplate(). Saved workspace templates are
// merged into the selector separately (see SendViaOutlook component).
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "intro",
    name: "Intro email",
    subject: "Quick intro — {{company}}",
    body:
      "Hi {{firstName}},\n\n" +
      "I'm {{repName}} with A3 Visual. I came across {{company}} and wanted to introduce myself — we help teams like yours bring spaces and events to life with large-format graphics, fabrication, and immersive installs.\n\n" +
      "Would you be open to a quick call to see if there's a fit?\n\n" +
      "Best,\n{{repName}}\n{{repEmail}}\n{{repPhone}}",
  },
  {
    id: "follow_up",
    name: "Follow-up email",
    subject: "Following up — {{company}}",
    body:
      "Hi {{firstName}},\n\n" +
      "Just floating this back to the top of your inbox. I'd love to find time to talk through how we could support {{company}}.\n\n" +
      "Are you free for 15 minutes this week?\n\n" +
      "Thanks,\n{{repName}}\n{{repEmail}}\n{{repPhone}}",
  },
  {
    id: "meeting_request",
    name: "Meeting request",
    subject: "15 minutes this week, {{firstName}}?",
    body:
      "Hi {{firstName}},\n\n" +
      "I'd like to set up a short call to walk through what we could do for {{company}}. Would Tuesday or Thursday work for a quick 15-minute conversation?\n\n" +
      "Let me know a time that suits you and I'll send an invite.\n\n" +
      "Best,\n{{repName}}\n{{repEmail}}\n{{repPhone}}",
  },
  {
    id: "proposal_follow_up",
    name: "Proposal follow-up",
    subject: "Following up on the {{opportunityName}} proposal",
    body:
      "Hi {{firstName}},\n\n" +
      "I wanted to follow up on the proposal we sent over for {{opportunityName}}. Happy to answer any questions or adjust scope and pricing to fit your budget and timeline.\n\n" +
      "What would be the best next step on your end?\n\n" +
      "Best,\n{{repName}}\n{{repEmail}}\n{{repPhone}}",
  },
  {
    id: "custom",
    name: "Custom",
    subject: "",
    body: "",
  },
];

// Resolve {{firstName}} {{lastName}} {{company}} {{opportunityName}} {{repName}}
// {{repPhone}} {{repEmail}} (plus a couple of friendly aliases) against the
// supplied records. Unknown variables resolve to an empty string.
export function mergeTemplate(
  template: string,
  contact: MergeContact,
  opportunity?: MergeOpportunity | null,
  rep?: MergeRep | null,
): string {
  const firstName =
    contact.firstName || (contact.fullName || "").split(" ")[0] || "";
  const lastName =
    contact.lastName ||
    (contact.fullName || "").split(" ").slice(1).join(" ") ||
    "";
  const fullName =
    contact.fullName || [firstName, lastName].filter(Boolean).join(" ") || "";
  const opportunityName =
    opportunity?.opportunityName ||
    opportunity?.name ||
    contact.company ||
    "";

  const vars: Record<string, string> = {
    "{{firstName}}": firstName,
    "{{lastName}}": lastName,
    "{{fullName}}": fullName,
    "{{company}}": contact.company || "",
    "{{opportunityName}}": opportunityName,
    "{{repName}}": rep?.name || "",
    "{{repPhone}}": rep?.phone || "",
    "{{repEmail}}": rep?.email || "",
  };

  let out = template || "";
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(key).join(value);
  }
  return out;
}

// Build a compose URL. Every value is URL-encoded. "web" opens the Outlook on
// the web compose pane; "mailto" hands off to the OS default mail client
// (typically desktop Outlook).
export function buildOutlookComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
  mode?: ComposeMode;
}): string {
  const { to, subject, body, mode = "web" } = params;
  const enc = encodeURIComponent;

  if (mode === "mailto") {
    const qs = `subject=${enc(subject)}&body=${enc(body)}`;
    return `mailto:${enc(to)}?${qs}`;
  }

  const qs = `to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
  return `https://outlook.office.com/mail/deeplink/compose?${qs}`;
}

// Add `n` business days (Mon–Fri) to a date, skipping weekends. Used for the
// default follow-up date (+3 business days).
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

// Format a Date as `yyyy-mm-dd` for a native <input type="date">.
export function toDateInputValue(d: Date): string {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}
