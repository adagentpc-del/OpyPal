export interface TemplateContact {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  industry?: string | null;
  intentSignal?: string | null;
  customLine?: string | null;
}

export function getGreeting(firstName?: string | null): string {
  if (firstName && firstName.trim().length > 0) {
    return `Hi ${firstName.trim()},`;
  }
  return "Hi there,";
}

export function getIntentLine(company?: string | null, intentSignal?: string | null): string {
  if (!intentSignal || intentSignal.trim().length === 0) return "";
  const companyName = company && company.trim().length > 0 ? company.trim() : "your team";
  return `Saw ${companyName} is currently ${intentSignal.trim()}.`;
}

export function getCompanyLine(company?: string | null): string {
  if (company && company.trim().length > 0) {
    return `I can put together a few relevant ideas specific to ${company.trim()}.`;
  }
  return "I can put together a few relevant ideas based on what you are working on.";
}

export function renderTemplate(contact: TemplateContact, template: string): string {
  const firstName = contact.firstName || (contact.fullName || "").split(" ")[0] || "";
  const lastName = contact.lastName || (contact.fullName || "").split(" ").slice(1).join(" ") || "";
  const fullName = contact.fullName || [firstName, lastName].filter(Boolean).join(" ") || "";
  const company = contact.company || "";

  const greeting = getGreeting(firstName);
  const intentLine = getIntentLine(company, contact.intentSignal);
  const companyLine = getCompanyLine(company);

  const variables: Record<string, string> = {
    "{{first_name}}": firstName,
    "{{last_name}}": lastName,
    "{{full_name}}": fullName,
    "{{company}}": company || "your team",
    "{{title}}": contact.title || "",
    "{{location}}": contact.location || "",
    "{{industry}}": contact.industry || "",
    "{{intent_signal}}": contact.intentSignal || "",
    "{{custom_line}}": contact.customLine || "",
    "{{greeting}}": greeting,
    "{{intent_line}}": intentLine,
    "{{company_line}}": companyLine,
  };

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.split(key).join(value);
  }

  const bracketVars: Record<string, string> = {
    "[First Name]": firstName || "there",
    "[Name]": fullName,
    "[Company Name]": company || "your team",
    "[Company]": company || "your team",
    "[company]": company || "your team",
    "[Title]": contact.title || "",
    "[Location]": contact.location || "",
    "[venue / agency]": company || "your team",
    "[venue]": company || "your team",
  };
  for (const [key, value] of Object.entries(bracketVars)) {
    result = result.split(key).join(value);
  }

  result = result
    .split("\n")
    .filter((line, i, arr) => {
      if (line.trim() === "" && i > 0 && arr[i - 1].trim() === "") return false;
      return true;
    })
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n");

  return result;
}

export function renderSubject(contact: TemplateContact, subject: string): string {
  return renderTemplate(contact, subject);
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

export function calculateEngagementScore(events: { eventType: string }[]): number {
  let score = 0;
  let clickCount = 0;

  for (const event of events) {
    switch (event.eventType) {
      case "open":
        score += 1;
        break;
      case "click":
        score += 3;
        clickCount++;
        break;
      case "reply":
        score += 10;
        break;
      case "bounce":
        score -= 10;
        break;
    }
  }

  if (clickCount > 1) score += 5;

  const sentCount = events.filter(e => e.eventType === "sent").length;
  const engagementCount = events.filter(e => ["open", "click", "reply"].includes(e.eventType)).length;
  if (sentCount >= 3 && engagementCount === 0) score -= 3;

  return Math.max(score, 0);
}

export function getEngagementTier(score: number): string {
  if (score >= 8) return "hot";
  if (score >= 3) return "warm";
  return "cold";
}
