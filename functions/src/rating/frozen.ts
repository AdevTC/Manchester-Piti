// The notas an acta freezes (`matches/{id}.notas`): each player's nota of that match as it was rated when the acta
// was published — with the season's matches up to that one and the rival's strength in that day's table — plus
// the model that rated them and that rival factor and, when the table gave it, the rival's normal match (a
// correction keeps both). Only the backend writes them (saveMatchSheet and la mesa's publication, through
// publishSheet; the backfill script); the web reads them (./season). Pure.
import { MODEL_VERSION } from "./constants.js";
import type { Normal } from "./types.js";

export interface StoredNota {
  nota: number;
  minutes: number;
  /** How much the match counts in GLOBAL and FOR (≤ 1). */
  weight: number;
  narrated: boolean;
}
export interface StoredNotas {
  /** The model that rated them (constants MODEL_VERSION): another model's notas are rated again. */
  model: string;
  /** The rival's factor that day (1 = no adjustment). */
  rival: number;
  /** The rival's goals that day as a normal match (only when the table had them; else the season's mean). */
  normal?: Normal;
  /** playerId → his nota (only the players with one: ≥ MIN_RATED_MINUTES). */
  players: Record<string, StoredNota>;
}

const SAFE_PID = /^[A-Za-z0-9_-]{1,128}$/;
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
function normalOf(v: unknown): Normal | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const f = num(o.for, 0, 50);
  const a = num(o.against, 0, 50);
  return f === null || a === null ? null : { for: f, against: a };
}

/** A stored `notas` read back: null when missing or malformed; a malformed player is left out. */
export function parseStoredNotas(v: unknown): StoredNotas | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const rival = num(o.rival, 0.5, 2);
  if (typeof o.model !== "string" || !o.model || rival === null || !o.players || typeof o.players !== "object") return null;
  const players: Record<string, StoredNota> = {};
  for (const [pid, row] of Object.entries(o.players as Record<string, unknown>)) {
    if (!SAFE_PID.test(pid) || !row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const nota = num(r.nota, 0, 10);
    const minutes = num(r.minutes, 0, 150);
    const weight = num(r.weight, 0, 1);
    if (nota === null || minutes === null || weight === null || typeof r.narrated !== "boolean") continue;
    players[pid] = { nota, minutes, weight, narrated: r.narrated };
  }
  const normal = normalOf(o.normal);
  return { model: o.model, rival, ...(normal ? { normal } : {}), players };
}

const memo = new WeakMap<object, StoredNotas | null>();
/** A match's stored notas when this model rated them; null otherwise (they are rated again). Memoised per match. */
export function storedNotasOf(m: { notas?: unknown }): StoredNotas | null {
  let hit = memo.get(m);
  if (hit === undefined) {
    const parsed = parseStoredNotas(m.notas);
    hit = parsed && parsed.model === MODEL_VERSION ? parsed : null;
    memo.set(m, hit);
  }
  return hit;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
/** What the match doc stores: the figures rounded (three decimals), and when they were rated (ms). */
export function notasDoc(n: StoredNotas, at: number): StoredNotas & { at: number } {
  const players: Record<string, StoredNota> = {};
  for (const [pid, p] of Object.entries(n.players)) players[pid] = { nota: r3(p.nota), minutes: r3(p.minutes), weight: r3(p.weight), narrated: p.narrated };
  return { model: n.model, rival: r3(n.rival), ...(n.normal ? { normal: { for: r3(n.normal.for), against: r3(n.normal.against) } } : {}), players, at };
}
