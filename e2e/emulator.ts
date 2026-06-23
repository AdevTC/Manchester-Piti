// Firebase Emulator Suite helpers for the CRUD E2E (Node side).
//
// These talk DIRECTLY to the running emulators over REST to bootstrap the
// preconditions the browser test needs (an admin auth user + an admin `users`
// doc + a season). They deliberately bypass security rules using the Firestore
// emulator's privileged "owner" bearer token — the rules themselves are still
// exercised by the BROWSER, which writes as a genuinely-authenticated admin.

export const PROJECT_ID = "futbolmanagement-dc6cb";
export const AUTH_HOST = "127.0.0.1:9099";
export const FIRESTORE_HOST = "127.0.0.1:8080";

// A throwaway admin used by the CRUD spec. Created in the Auth emulator during
// global setup; the browser signs in as this user via window.__mpEmulatorSignIn.
export const ADMIN_EMAIL = "e2e-admin@manchester-piti.test";
export const ADMIN_PASSWORD = "e2e-admin-password";

const FS_BASE = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

interface SignUpResponse {
  localId: string;
  idToken: string;
}

/** Create (or reuse) the admin user in the Auth emulator, returning its uid. */
export async function createAuthUser(email: string, password: string): Promise<string> {
  const res = await fetch(
    // The fake API key is accepted by the Auth emulator (tokens are unsigned).
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (res.ok) {
    const data = (await res.json()) as SignUpResponse;
    return data.localId;
  }
  // Already registered from a previous run on a persisted emulator → sign in.
  const signIn = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!signIn.ok) {
    throw new Error(`Auth emulator signUp/signIn failed: ${await res.text()}`);
  }
  const data = (await signIn.json()) as SignUpResponse;
  return data.localId;
}

// ── Privileged Firestore writes (bypass rules via the "owner" bearer token) ──

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { timestampValue: string };

function toFsFields(obj: Record<string, string | number | boolean | Date>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number") fields[k] = { integerValue: String(v) };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
  }
  return fields;
}

/** PATCH (upsert) a document at collection/docId, bypassing rules. */
export async function seedDoc(
  collection: string,
  docId: string,
  data: Record<string, string | number | boolean | Date>,
): Promise<void> {
  const res = await fetch(`${FS_BASE}/${collection}/${docId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields: toFsFields(data) }),
  });
  if (!res.ok) {
    throw new Error(`Firestore emulator seed ${collection}/${docId} failed: ${await res.text()}`);
  }
}

/** Wipe all data in the emulator (best-effort) so each run starts clean. */
export async function clearFirestore(): Promise<void> {
  await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  ).catch(() => {
    /* emulator may not be up yet on the very first call; non-fatal */
  });
}

/** Read a single doc's fields back (verification), bypassing rules. */
export async function readDoc(
  collection: string,
  docId: string,
): Promise<Record<string, FsValue> | null> {
  const res = await fetch(`${FS_BASE}/${collection}/${docId}`, {
    headers: { Authorization: "Bearer owner" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore emulator read failed: ${await res.text()}`);
  const data = (await res.json()) as { fields?: Record<string, FsValue> };
  return data.fields ?? null;
}
