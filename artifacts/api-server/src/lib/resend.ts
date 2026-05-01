import { Resend } from "resend";

export const DEFAULT_FROM_EMAIL = "A3 Visual <hello@a3visualcontact.com>";
export const DEFAULT_REPLY_TO = "adeltorre@a3visual.com";

let cachedSettings: { apiKey: string; fromEmail: string } | null = null;
let cacheTime = 0;
const CACHE_TTL = 4 * 60 * 1000;

async function getCredentials(): Promise<{ apiKey: string; fromEmail: string }> {
  if (cachedSettings && Date.now() - cacheTime < CACHE_TTL) return cachedSettings;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) throw new Error("Replit identity token not available");

  const res = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
  );
  const data = await res.json();
  const conn = data.items?.[0];

  if (!conn?.settings?.api_key) throw new Error("Resend not connected — please configure the Resend integration");

  cachedSettings = { apiKey: conn.settings.api_key, fromEmail: DEFAULT_FROM_EMAIL };
  cacheTime = Date.now();
  return cachedSettings;
}

export async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  const { apiKey, fromEmail } = await getCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendEmail(params: {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    const result = await client.emails.send({
      from: params.from || fromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo || DEFAULT_REPLY_TO,
    });
    if (result.error) return { id: "", success: false, error: result.error.message };
    return { id: result.data?.id || "", success: true };
  } catch (err: any) {
    return { id: "", success: false, error: err.message };
  }
}

export async function checkResendConnection(): Promise<{ connected: boolean; fromEmail?: string; replyTo?: string; error?: string }> {
  try {
    const { fromEmail } = await getCredentials();
    return { connected: true, fromEmail, replyTo: DEFAULT_REPLY_TO };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}
