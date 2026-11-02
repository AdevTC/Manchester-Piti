import { expect, type Page } from "@playwright/test";
import { emulatorAdmin, enterVestuario } from "./helpers";

// r14 «La pizarra» end to end: what every pizarra spec shares. The preview seed (functions/test/seed-preview.mjs)
// gives the season «preview-season», ten players (preview-player-0 … 9: 0 keeper, 1–2 defensas, 3–5 medios,
// 6–9 delanteros), the next match «preview-next» (tomorrow, «Atlético Demo», its convocatoria the first seven + 7 and 8
// on the bench) and a finished one. The seeded admin («Google de prueba») is a captain without a ficha. Anything
// else a spec needs it writes itself with the Firestore emulator's owner REST (below) and puts back, so a retry or a
// second run starts from the same place. Emulator only: the demo project on loopback.

export const SEASON = "preview-season";
export const NEXT = "preview-next";
export const PLAYERS = Array.from({ length: 10 }, (_, i) => "preview-player-" + i);

/** Signs in as the seeded captain and opens a pizarra address in the seeded season. */
export async function enterPizarra(page: Page, path = "/pizarra/siete", query: Record<string, string> = {}): Promise<void> {
  await enterVestuario(page);
  await page.goto(pizarraUrl(path, query));
  await expect(page.locator(".pz.pz-s")).toBeVisible();
}
/** A pizarra address in the seeded season. */
export function pizarraUrl(path: string, query: Record<string, string> = {}): string {
  return path + "?" + new URLSearchParams({ season: SEASON, ...query }).toString();
}
/** The seeded admin's uid (the Auth emulator's). */
export async function adminUid(): Promise<string> {
  return (await emulatorAdmin()).uid;
}

// ── the Firestore emulator as its owner (bypasses the rules) ──
const EMULATOR = "demo-manchester-piti";
const DOCS = `http://127.0.0.1:8080/v1/projects/${EMULATOR}/databases/(default)/documents`;
const OWNER = { authorization: "Bearer owner" };
type FsValue = Record<string, unknown>;
function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  throw new Error("Valor no admitido: " + String(v));
}
function toFields(o: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));
}
function fromValue(v: FsValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return new Date(String(v.timestampValue)).getTime();
  if ("arrayValue" in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(fromValue);
  if ("mapValue" in v) return fromFields((v.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  return undefined;
}
function fromFields(f: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));
}
/** A document's data (plain values, timestamps as ms), or null. */
export async function fsGet(path: string): Promise<Record<string, unknown> | null> {
  const r = await fetch(`${DOCS}/${path}`, { headers: OWNER });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`fsGet ${path}: HTTP ${r.status}`);
  const body = (await r.json()) as { fields?: Record<string, FsValue> };
  return fromFields(body.fields ?? {});
}
/** Writes a whole document (replaces it). */
export async function fsSet(path: string, data: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${DOCS}/${path}`, { method: "PATCH", headers: { ...OWNER, "content-type": "application/json" }, body: JSON.stringify({ fields: toFields(data) }) });
  if (!r.ok) throw new Error(`fsSet ${path}: HTTP ${r.status} ${await r.text()}`);
}
/** Changes (or, with undefined, removes) some fields of a document, leaving the rest. */
export async function fsPatch(path: string, data: Record<string, unknown>): Promise<void> {
  const mask = Object.keys(data).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&");
  const r = await fetch(`${DOCS}/${path}?${mask}`, { method: "PATCH", headers: { ...OWNER, "content-type": "application/json" }, body: JSON.stringify({ fields: toFields(data) }) });
  if (!r.ok) throw new Error(`fsPatch ${path}: HTTP ${r.status} ${await r.text()}`);
}
/** Deletes a document (having none is fine). */
export async function fsDelete(path: string): Promise<void> {
  const r = await fetch(`${DOCS}/${path}`, { method: "DELETE", headers: OWNER });
  if (!r.ok && r.status !== 404) throw new Error(`fsDelete ${path}: HTTP ${r.status}`);
}
/** The ids of a collection's documents (a subcollection: «lineups/x/history»). */
export async function fsList(path: string): Promise<string[]> {
  const r = await fetch(`${DOCS}/${path}?pageSize=300`, { headers: OWNER });
  if (!r.ok) return [];
  const body = (await r.json()) as { documents?: { name: string }[] };
  return (body.documents ?? []).map((d) => d.name.split("/").pop() ?? "");
}
/** The documents of a collection whose field equals a value: [{ id, data }]. */
export async function fsWhere(collection: string, field: string, value: string): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const r = await fetch(`${DOCS}:runQuery`, {
    method: "POST",
    headers: { ...OWNER, "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } } } }),
  });
  const rows = (await r.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
  return rows.flatMap((row) => (row.document ? [{ id: row.document.name.split("/").pop() ?? "", data: fromFields(row.document.fields ?? {}) }] : []));
}
/** Deletes every board (lineups) the seeded admin owns in the seeded season, with their subcollections' docs the
 * spec knows of: a spec that needs a clean pizarra starts from nothing. */
export async function clearAdminBoards(): Promise<void> {
  const uid = await adminUid();
  for (const b of await fsWhere("lineups", "ownerUid", uid)) {
    if (b.data.seasonId !== SEASON) continue;
    for (const sub of ["reactions", "history", "voz"]) for (const id of await fsList(`lineups/${b.id}/${sub}`)) await fsDelete(`lineups/${b.id}/${sub}/${id}`);
    await fsDelete(`lineups/${b.id}`);
  }
  await fsDelete(`lineupOfficials/${SEASON}__${NEXT}`);
}
