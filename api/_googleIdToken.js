// Checks a Google-signed identity token (RS256 JWT, Google's published keys): who is calling api/purge.js. The
// project's Cloud Functions mint one for their service account (functions/src/htmlCache.ts), so nothing secret is
// shared between Firebase and Vercel. (The «_» keeps Vercel from serving this file as a function.)
import { createPublicKey, verify } from "node:crypto";

const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const KEYS_FOR_MS = 60 * 60_000;
/** A key the set doesn't have fetches it again at most this often (Google rotates its keys; a made-up one
 *  mustn't make every call fetch them). */
const MISS_REFETCH_MS = 60_000;
let keys = null;

/** Google's key `kid` (as a JWK), from its published set: fetched again when it's an hour old, or (at most once a
 *  minute) when it lacks the one asked for. */
async function googleKey(kid) {
  const now = Date.now();
  const fresh = keys && now - keys.at < KEYS_FOR_MS;
  if (!fresh || (!keys.byKid.has(kid) && now - keys.at >= MISS_REFETCH_MS)) {
    const res = await fetch(CERTS, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`google certs ${res.status}`);
    const { keys: list } = await res.json();
    keys = { at: Date.now(), byKid: new Map(list.map((k) => [k.kid, k])) };
  }
  return keys.byKid.get(kid) ?? null;
}

/** A JWT part's JSON, or null for anything that isn't. */
const part = (s) => {
  try {
    const v = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

/**
 * Whether `token` is a valid Google identity token for `audience`, issued to the service account `email`.
 * `now` and `getKey` are for tests.
 */
export async function isGoogleIdToken(token, { audience, email }, now = Date.now(), getKey = googleKey) {
  const [head, body, sig] = String(token).split(".");
  if (!head || !body || !sig) return false;
  const header = part(head);
  const claims = part(body);
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return false;
  const jwk = await getKey(header.kid);
  if (!jwk) return false;
  const signed = verify("RSA-SHA256", Buffer.from(`${head}.${body}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(sig, "base64url"));
  return (
    signed &&
    ISSUERS.includes(claims.iss) &&
    claims.aud === audience &&
    claims.email === email &&
    claims.email_verified === true &&
    typeof claims.exp === "number" &&
    claims.exp * 1000 > now
  );
}
