// api/purge.js: only the project's Cloud Functions (a Google identity token of their service account, for the
// endpoint's address) may delete the cached pages. Tokens signed here with a key made for the test.
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isGoogleIdToken } from "../api/_googleIdToken.js";
import { POST, PURGE_AUDIENCE, PURGE_CALLER } from "../api/purge.js";
// (the functions' address, read from their source: their build isn't part of this one)
const PURGE_URL = readFileSync("functions/src/htmlCacheLogic.ts", "utf8").match(/export const PURGE_URL = "([^"]+)"/)?.[1];

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Date.now();
function token(claims, { kid = "k1", key = privateKey } = {}) {
  const head = b64({ alg: "RS256", kid, typ: "JWT" });
  const body = b64({ iss: "https://accounts.google.com", aud: PURGE_AUDIENCE, email: PURGE_CALLER, email_verified: true, exp: Math.floor(now / 1000) + 600, ...claims });
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), key).toString("base64url")}`;
}
const check = (t) => isGoogleIdToken(t, { audience: PURGE_AUDIENCE, email: PURGE_CALLER }, now, async (kid) => (kid === "k1" ? jwk : null));

await test("the functions and the endpoint name the same address", () => {
  assert.equal(PURGE_URL, PURGE_AUDIENCE);
});

await test("takes the functions' own token", async () => {
  assert.equal(await check(token({})), true);
});

await test("refuses anyone else's token", async () => {
  assert.equal(await check(token({ email: "someone@other-project.iam.gserviceaccount.com" })), false, "another account");
  assert.equal(await check(token({ aud: "https://elsewhere.example" })), false, "another audience");
  assert.equal(await check(token({ exp: Math.floor(now / 1000) - 1 })), false, "expired");
  assert.equal(await check(token({ email_verified: false })), false, "unverified email");
  assert.equal(await check(token({ iss: "https://evil.example" })), false, "another issuer");
  assert.equal(await check(token({}, { kid: "unknown" })), false, "a key Google doesn't publish");
  assert.equal(await check(token({}, { key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey })), false, "forged signature");
  assert.equal(await check("not.a.jwt"), false);
});

await test("the endpoint refuses a call without a valid token, before touching the cache", async () => {
  for (const headers of [{}, { authorization: "Bearer nonsense" }, { authorization: `Basic ${token({})}` }]) {
    const res = await POST(new Request("https://manchester-piti.vercel.app/api/purge", { method: "POST", headers }));
    assert.equal(res.status, 401);
  }
});
