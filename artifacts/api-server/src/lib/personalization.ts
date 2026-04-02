import type OpenAI from "openai";

let _openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (_openaiClient) return _openaiClient;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  try {
    const OpenAIConstructor = require("openai").default || require("openai");
    _openaiClient = new OpenAIConstructor({ apiKey, baseURL });
    return _openaiClient;
  } catch {
    return null;
  }
}

export interface PersonalizationContact {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  industry?: string | null;
  intentSignal?: string | null;
  segmentType?: string | null;
  campaignName?: string | null;
  whySelected?: string | null;
  customLine?: string | null;
  notes?: string | null;
  sourceFileName?: string | null;
}

export type PersonalizationMode = "off" | "safe" | "enhanced";

const SAFE_FALLBACKS = [
  "I thought it made sense to reach out given the type of work your team may be evaluating.",
  "I wanted to reach out as this may be relevant to your team depending on current priorities.",
  "Given the types of projects your team tends to be involved in, this felt like a natural fit to connect.",
  "I thought this might be worth a quick look based on the kind of work your organization handles.",
];

const SEGMENT_CONTEXT: Record<string, string> = {
  hotel: "Focus on guest experience, wayfinding, signage, property presentation, and brand experience. The company A3 Visual provides large-format printing, fabrication, environmental graphics, and experiential installations.",
  agency: "Focus on campaign execution, experiential delivery, production coordination, and brand consistency. A3 Visual provides large-format printing, fabrication, and experiential production.",
  developer: "Focus on sales center experience, signage, fabrication, environmental branding, and project presentation. A3 Visual provides large-format printing, fabrication, and branded environments.",
  venue: "Focus on event execution, guest flow, sponsor visibility, and branded installations. A3 Visual provides large-format printing, fabrication, projection mapping, and experiential installations.",
  general: "Focus on visual execution, fabrication, print, immersive environments, and operational consistency. A3 Visual provides large-format printing, fabrication, and experiential production.",
};

const TITLE_HINTS: Record<string, string> = {
  marketing: "Lean into brand impact, campaign execution, consistency, and visibility.",
  events: "Lean into execution, logistics, on-site experience, and timing.",
  operations: "Lean into wayfinding, implementation, vendor coordination, and consistency.",
  facilities: "Lean into wayfinding, implementation, vendor coordination, and consistency.",
  procurement: "Lean into vendor consolidation, execution quality, and reliability.",
};

function getTitleHint(title?: string | null): string {
  if (!title) return "Use neutral business relevance wording.";
  const lower = title.toLowerCase();
  for (const [keyword, hint] of Object.entries(TITLE_HINTS)) {
    if (lower.includes(keyword)) return hint;
  }
  return "Use neutral business relevance wording.";
}

function getDataQuality(contact: PersonalizationContact): "high" | "medium" | "low" {
  let fields = 0;
  if (contact.company) fields++;
  if (contact.title) fields++;
  if (contact.industry) fields++;
  if (contact.intentSignal) fields++;
  if (contact.segmentType) fields++;
  if (contact.whySelected) fields++;
  if (contact.location) fields++;

  if (fields >= 4) return "high";
  if (fields >= 2) return "medium";
  return "low";
}

function getInputFieldsList(contact: PersonalizationContact): string[] {
  const fields: string[] = [];
  if (contact.fullName) fields.push("fullName");
  if (contact.firstName) fields.push("firstName");
  if (contact.company) fields.push("company");
  if (contact.title) fields.push("title");
  if (contact.location) fields.push("location");
  if (contact.industry) fields.push("industry");
  if (contact.intentSignal) fields.push("intentSignal");
  if (contact.segmentType) fields.push("segmentType");
  if (contact.whySelected) fields.push("whySelected");
  if (contact.campaignName) fields.push("campaignName");
  return fields;
}

function buildPrompt(contact: PersonalizationContact, mode: PersonalizationMode): string {
  const segment = contact.segmentType || "general";
  const segmentCtx = SEGMENT_CONTEXT[segment] || SEGMENT_CONTEXT.general;
  const titleHint = getTitleHint(contact.title);
  const quality = getDataQuality(contact);

  const contactData: string[] = [];
  if (contact.fullName) contactData.push(`Name: ${contact.fullName}`);
  if (contact.company) contactData.push(`Company: ${contact.company}`);
  if (contact.title) contactData.push(`Title: ${contact.title}`);
  if (contact.location) contactData.push(`Location: ${contact.location}`);
  if (contact.industry) contactData.push(`Industry: ${contact.industry}`);
  if (mode === "enhanced") {
    if (contact.intentSignal) contactData.push(`Intent Signal: ${contact.intentSignal}`);
    if (contact.whySelected) contactData.push(`Why Selected: ${contact.whySelected}`);
    if (contact.campaignName) contactData.push(`Campaign: ${contact.campaignName}`);
  }

  const strengthGuidance = quality === "low"
    ? "Data is very limited. Generate a soft, generalized line that is still relevant to the segment."
    : quality === "medium"
    ? "Some data is available. Generate a line that references what is known without fabricating details."
    : "Good data available. Generate a stronger personalized line using the provided fields.";

  return `You are a sales personalization assistant for A3 Visual, a company specializing in large-format printing, fabrication, environmental graphics, projection mapping, and experiential installations.

Generate ONE short custom first line for a cold outreach email to this contact. This line will be inserted into a sales email template.

CONTACT DATA:
${contactData.join("\n")}

SEGMENT CONTEXT: ${segmentCtx}
TITLE GUIDANCE: ${titleHint}
DATA QUALITY: ${strengthGuidance}

STRICT RULES:
1. Output ONLY the single sentence. No quotes, no labels, no extra text.
2. Keep it to one sentence, ideally under 30 words.
3. Sound professional, commercially relevant, and natural.
4. Do NOT fabricate specific facts, news, or company events not in the data.
5. Do NOT invent recent developments or specific metrics.
6. Do NOT use em dashes.
7. Do NOT use excessive flattery or hype.
8. Do NOT use awkward buzzwords.
9. Do NOT mention scraped data or private research.
10. Do NOT start with "I" - vary your sentence openings.
11. Make it feel thoughtful and intentional, not mass-sent.
12. If data is limited, be softer and more generalized while still relevant to the segment.`;
}

function validateCustomLine(line: string, maxLength: number = 200): { valid: boolean; reason?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { valid: false, reason: "empty" };
  if (trimmed.length > maxLength) return { valid: false, reason: "too_long" };
  if (trimmed.includes("\u2014")) return { valid: false, reason: "contains_em_dash" };
  if (trimmed.includes("{{") || trimmed.includes("}}")) return { valid: false, reason: "contains_placeholders" };
  if (/\[.*\]/.test(trimmed) && /\[First|Last|Company|Name\]/.test(trimmed)) return { valid: false, reason: "contains_bracket_vars" };

  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length > 2) return { valid: false, reason: "too_many_sentences" };

  return { valid: true };
}

function getRandomFallback(): string {
  return SAFE_FALLBACKS[Math.floor(Math.random() * SAFE_FALLBACKS.length)];
}

export interface GenerateResult {
  customLine: string;
  status: "generated_safe" | "generated_enhanced" | "failed";
  source: "ai" | "fallback";
  inputFieldsUsed: string[];
  error?: string;
}

export async function generateCustomLine(
  contact: PersonalizationContact,
  mode: PersonalizationMode,
  maxLength: number = 200
): Promise<GenerateResult> {
  if (mode === "off") {
    return {
      customLine: "",
      status: "failed",
      source: "fallback",
      inputFieldsUsed: [],
      error: "personalization_off",
    };
  }

  const inputFields = getInputFieldsList(contact);
  const quality = getDataQuality(contact);

  if (quality === "low" && mode === "safe") {
    return {
      customLine: getRandomFallback(),
      status: "generated_safe",
      source: "fallback",
      inputFieldsUsed: inputFields,
    };
  }

  try {
    const prompt = buildPrompt(contact, mode);

    const client = getOpenAIClient();
    if (!client) {
      return {
        customLine: getRandomFallback(),
        status: mode === "safe" ? "generated_safe" : "generated_enhanced",
        source: "fallback" as const,
        inputFieldsUsed: inputFields,
        error: "openai_not_configured",
      };
    }

    const response = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.7,
    });

    let result = response.choices?.[0]?.message?.content?.trim() || "";

    result = result.replace(/^["']|["']$/g, "").trim();

    const validation = validateCustomLine(result, maxLength);

    if (!validation.valid) {
      if (validation.reason === "too_long") {
        result = result.substring(0, maxLength - 3).trim() + "...";
      } else {
        return {
          customLine: getRandomFallback(),
          status: mode === "safe" ? "generated_safe" : "generated_enhanced",
          source: "fallback",
          inputFieldsUsed: inputFields,
          error: `validation_failed: ${validation.reason}`,
        };
      }
    }

    return {
      customLine: result,
      status: mode === "safe" ? "generated_safe" : "generated_enhanced",
      source: "ai",
      inputFieldsUsed: inputFields,
    };
  } catch (err: any) {
    return {
      customLine: getRandomFallback(),
      status: "failed",
      source: "fallback",
      inputFieldsUsed: inputFields,
      error: err.message || "ai_generation_failed",
    };
  }
}

export async function generateBatch(
  contacts: PersonalizationContact[],
  mode: PersonalizationMode,
  maxLength: number = 200,
  onProgress?: (completed: number, total: number) => void
): Promise<GenerateResult[]> {
  const results: GenerateResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(contact => generateCustomLine(contact, mode, maxLength))
    );
    results.push(...batchResults);
    onProgress?.(results.length, contacts.length);
  }

  return results;
}
