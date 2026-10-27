import { expect, type Page } from "@playwright/test";
export async function enterVestuario(page: Page) {
  await page.goto("/vestuario");
  // No team key any more: the seeded admin is already a member, so Google alone lets them in.
  await page
    .getByRole("button", { name: "Google de prueba · Solo emulador" })
    .click();
  // (inside: the seeded admin is a captain, and the vestuario's «Modo capitán» links to the Sala de control)
  await expect(page.getByRole("link", { name: "Sala de control" })).toBeVisible();
}

// ── Emulator-only fixtures (demo project, loopback): a spec sets up the state it needs itself. ──
const EMULATOR = "demo-manchester-piti";
/** The seeded preview admin as the Auth emulator knows it: its uid and an ID token. */
async function emulatorAdmin(): Promise<{ uid: string; token: string }> {
  const b64 = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const fake = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "preview-admin", email: "admin@piti.test", email_verified: true, name: "Administrador de pruebas", aud: "demo", iss: "https://accounts.google.com" })}.`;
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postBody: new URLSearchParams({ id_token: fake, providerId: "google.com" }).toString(), requestUri: "http://localhost", returnSecureToken: true }),
  });
  const user: unknown = await response.json();
  const { idToken: token, localId: uid } = user as { idToken?: unknown; localId?: unknown };
  if (typeof token !== "string" || typeof uid !== "string") throw new Error("La cuenta del emulador no está disponible.");
  return { uid, token };
}
/** An ID token for the seeded preview admin, from the Auth emulator. */
export async function emulatorAdminToken(): Promise<string> {
  return (await emulatorAdmin()).token;
}
/** Deletes the preview admin's porra for a match (having none is fine): a spec that saves one starts from nothing,
 * and so does its retry, whatever the failed attempt left saved. */
export async function clearAdminPorra(matchId: string): Promise<void> {
  const { uid } = await emulatorAdmin();
  const response = await fetch(`http://127.0.0.1:8080/v1/projects/${EMULATOR}/databases/(default)/documents/matchPrivate/${matchId}/predictions/${uid}`, {
    method: "DELETE", headers: { authorization: "Bearer owner" },
  });
  if (!response.ok && response.status !== 404) throw new Error(`No se ha podido borrar la porra: HTTP ${response.status}`);
}
/** Calls a callable function on the Functions emulator as the given user. */
export async function callFunction(token: string, name: string, data: unknown): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:5001/${EMULATOR}/europe-southwest1/${name}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ data }),
  });
  const body = (await response.json()) as { error?: unknown; result?: unknown };
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}
/** Ids and statuses of the matches of a season, read straight from the Firestore emulator. */
export async function seasonMatches(seasonId: string): Promise<{ id: string; status?: string }[]> {
  const response = await fetch(`http://127.0.0.1:8080/v1/projects/${EMULATOR}/databases/(default)/documents:runQuery`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "matches" }], where: { fieldFilter: { field: { fieldPath: "seasonId" }, op: "EQUAL", value: { stringValue: seasonId } } } } }),
  });
  const rows = (await response.json()) as { document?: { name: string; fields?: { status?: { stringValue?: string } } } }[];
  return rows.flatMap((row) => (row.document ? [{ id: row.document.name.split("/").pop() ?? "", status: row.document.fields?.status?.stringValue }] : []));
}
