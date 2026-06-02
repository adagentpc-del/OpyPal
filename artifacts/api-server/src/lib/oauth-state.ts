import crypto from "crypto";

// Signed OAuth `state` for provider connect flows. The public callback endpoints
// trust nothing from the query string except what this module can verify, which
// prevents an attacker from binding their own mailbox to an arbitrary workspace
// by forging the workspace id in `state`.

// Prefer a stable server secret so state survives restarts and multiple
// instances; fall back to a per-process random key (short-lived OAuth flows
// tolerate this in single-instance dev).
const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.CLERK_SECRET_KEY ||
  crypto.randomBytes(32).toString("hex");

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
}

// Produces a tamper-proof state token carrying the workspace id, a nonce, and an
// expiry. Used by the auth-url endpoints.
export function signState(workspaceId: number): string {
  const payload = JSON.stringify({
    ws: workspaceId,
    n: crypto.randomBytes(8).toString("hex"),
    exp: Date.now() + TTL_MS,
  });
  const encoded = b64url(Buffer.from(payload));
  return `${encoded}.${sign(encoded)}`;
}

// Verifies a state token and returns the embedded workspace id, or null if the
// token is missing, malformed, tampered with, or expired.
export function verifyState(state: string | undefined | null): number | null {
  if (!state || typeof state !== "string") return null;
  const [encoded, mac] = state.split(".");
  if (!encoded || !mac) return null;

  const expected = sign(encoded);
  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as {
      ws?: number;
      exp?: number;
    };
    if (!payload.ws || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload.ws;
  } catch {
    return null;
  }
}
