// Where each one stands on the Campo's pitch (C3). After the acta: each starter at the code he played
// most (the acta's ledger[pid].positionsPlayed), on the spot the system played (match.system) gives that
// code; a substitute who played somewhere other than the slot he took gets his own «sub» dot. Before the
// acta (members): the pizarra's official seven at its slots' codes. With no codes at all, the orientative
// 1-3-2-1 of always (F7_SPOTS). Two dots never sit on each other's name. Pure.
import { F7_SPOTS } from "../../lib/ficha";
import { isFormationName, systemDef } from "../../lib/formations";
import { POSITIONS, type PosCode } from "../../lib/positions";
import { topPlayedCode } from "../../lib/playedSummary";
import type { Participation } from "../../lib/clubData";

export interface CampoDot {
  id: string;
  /** % of the pitch box: x 0→100 left→right, y 0 = the rival's goal (top) … 100 = ours. */
  x: number;
  y: number;
  /** The position he is drawn at (null: placed without one). */
  code: PosCode | null;
  /** A substitute drawn where he played (a ring), not a starter. */
  sub: boolean;
  /** His code came from his preferida, not the official board. */
  estimated: boolean;
}

/** Where the codes come from: the official board, the preferidas, both, none (orientative), or only some
 *  starters have one (partial: the others stand on a free spot or their orientative place). */
export type CampoSource = "board" | "estimated" | "mixed" | "partial" | "orientative";

export interface CampoLayout {
  dots: CampoDot[];
  source: CampoSource;
}

export const SOURCE_TEXT: Record<CampoSource, string> = {
  board: "Posiciones de la pizarra oficial",
  estimated: "Posiciones estimadas por su preferida",
  mixed: "Posiciones de la pizarra oficial; algunas, estimadas por su preferida",
  partial: "Algunas posiciones, orientativas",
  orientative: "Posiciones orientativas",
};

/** «2-3-1 · Clásico», «Libre · sin sistema fijo», or null (no official board when the acta was saved). */
export function systemText(system: unknown): string | null {
  if (system === "libre") return "Libre · sin sistema fijo";
  if (!isFormationName(system)) return null;
  const s = systemDef(system);
  return `${s.label} · ${s.name}`;
}

/** The short system for the grass («2-3-1», «Libre»), or null. */
export function systemMark(system: unknown): string | null {
  if (system === "libre") return "Libre";
  return isFormationName(system) ? systemDef(system).label : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
/** A point in the positions' space (POSITIONS, a system's spots: x 0→100, y 0 = rival goal … 100 = ours)
 *  on the Campo's pitch box: inset so the name and badges under a dot stay on the grass (the keeper at
 *  95 lands at 87 %, the punta at 14 at 17 %, as the orientative 1-3-2-1 has them). */
export const toPitch = (x: number, y: number): [number, number] => [round1(6 + x * 0.88), round1(5 + y * 0.86)];

/** A dot with its name and badges: ~77 × 65 px on a 350 px-wide phone pitch (closer, they touch). Every
 *  system's spots stand at least this far apart (the 4-1-1's lateral and central are 22.9 % apart). */
export const GAP_X = 22;
export const GAP_Y = 14;
const BOUNDS = { x0: 9, x1: 91, y0: 8, y1: 88 };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const inBounds = (x: number, y: number) => x >= BOUNDS.x0 && x <= BOUNDS.x1 && y >= BOUNDS.y0 && y <= BOUNDS.y1;

type Row = Pick<Participation, "played" | "started" | "exchanges" | "positionsPlayed" | "positionsEstimated">;

export interface CampoInput {
  /** The seven on the pitch, in slot order (an empty slot keeps its place: the orientative spots go by it). */
  field: readonly (string | null | undefined)[];
  /** The acta's ledger (after the acta): the codes and who came on. */
  ledger?: Record<string, Row> | null;
  /** match.system, or the official board's (before the acta). */
  system?: unknown;
  /** Before the acta: the official board's code per player (its slots). */
  codes?: Record<string, PosCode> | null;
}

/** Spreads dots that share one point side by side, centred on it and kept on the pitch. */
function spreadSame(dots: CampoDot[]): void {
  const groups = new Map<string, CampoDot[]>();
  for (const d of dots) {
    const k = `${d.x}|${d.y}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  for (const all of groups.values()) {
    // (three fit across the pitch; a fourth at the same point is left to settle)
    const g = all.slice(0, 3);
    if (g.length < 2) continue;
    const width = (g.length - 1) * GAP_X;
    const left = clamp(g[0].x - width / 2, BOUNDS.x0, BOUNDS.x1 - width);
    g.forEach((d, i) => (d.x = round1(left + i * GAP_X)));
  }
}

/** How much two dots' boxes overlap (0 = apart). */
const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(0, GAP_X - Math.abs(a.x - b.x)) * Math.max(0, GAP_Y - Math.abs(a.y - b.y));

/** The places tried around a dot, nearest first (in dot sizes); at one distance, sideways before up or down. */
const NEAR: readonly [number, number][] = (() => {
  const out: [number, number][] = [];
  for (const i of [0, 1, -1, 2, -2, 3, -3]) for (const j of [0, -1, 1, -2, 2, -3, 3]) out.push([(i * GAP_X) / 2, (j * GAP_Y) / 2]);
  const dist = ([dx, dy]: [number, number]) => Math.hypot(dx / GAP_X, dy / GAP_Y);
  return out.sort((p, q) => dist(p) - dist(q) || Math.abs(p[1]) - Math.abs(q[1]));
})();

/**
 * Moves `d` to the nearest place where it touches none of the dots already placed (a starter and his
 * replacement at one code end up side by side), on the pitch; when the pitch is that full around him, the
 * nearest place that overlaps them least — never one of their points.
 */
function settle(d: CampoDot, placed: readonly CampoDot[]): void {
  let best: { x: number; y: number; cost: number } | null = null;
  for (const [dx, dy] of NEAR) {
    const x = round1(d.x + dx);
    const y = round1(d.y + dy);
    if (!inBounds(x, y)) continue;
    const cost = placed.reduce((sum, p) => sum + overlap({ x, y }, p), 0);
    if (cost === 0) {
      d.x = x;
      d.y = y;
      return;
    }
    if (!best || cost < best.cost) best = { x, y, cost };
  }
  if (best) {
    d.x = best.x;
    d.y = best.y;
  }
}

/** The dots of the Campo and where their codes come from. */
export function campoLayout({ field, ledger, system, codes }: CampoInput): CampoLayout {
  const seven = field
    .slice(0, 7)
    .map((id, i) => ({ id: id ?? "", i }))
    .filter((s) => !!s.id);
  const codeOf = (id: string): PosCode | null => (codes ? (codes[id] ?? null) : topPlayedCode(ledger?.[id]?.positionsPlayed));
  const estimatedOf = (id: string) => !codes && ledger?.[id]?.positionsEstimated === true;

  if (!seven.some((s) => codeOf(s.id))) {
    const dots = seven.map(({ id, i }) => {
      const [x, y] = F7_SPOTS[i] ?? [50, 50];
      return { id, x, y, code: null, sub: false, estimated: false };
    });
    return { dots, source: "orientative" };
  }

  // the system's spots, each taken once (two DFC in a 2-3-1 are its left and right central)
  const spots = isFormationName(system) ? systemDef(system).spots.map(([code, u, v]) => ({ code, u, v, used: false })) : [];
  const takeSpot = (code: PosCode) => {
    const s = spots.find((x) => !x.used && x.code === code);
    if (s) s.used = true;
    return s;
  };
  const pointOf = (code: PosCode, take: boolean): [number, number] => {
    const s = take ? takeSpot(code) : spots.find((x) => x.code === code);
    return s ? toPitch(s.u, s.v) : toPitch(POSITIONS[code].x, POSITIONS[code].y);
  };

  const starters: CampoDot[] = [];
  const uncoded: { id: string; i: number }[] = [];
  for (const { id, i } of seven) {
    const code = codeOf(id);
    if (!code) {
      uncoded.push({ id, i });
      continue;
    }
    const [x, y] = pointOf(code, true);
    starters.push({ id, x, y, code, sub: false, estimated: estimatedOf(id) });
  }
  // one without a code: a spot the system left free, else his orientative place
  for (const { id, i } of uncoded) {
    const s = spots.find((x) => !x.used);
    if (s) s.used = true;
    const [x, y] = s ? toPitch(s.u, s.v) : (F7_SPOTS[i] ?? [50, 50]);
    starters.push({ id, x, y, code: null, sub: false, estimated: false });
  }
  spreadSame(starters);
  const placed: CampoDot[] = [];
  for (const d of starters) {
    settle(d, placed);
    placed.push(d);
  }

  // who came on, in the order they did: on the pitch only when he played elsewhere than the slot he took
  const onField = new Set(seven.map((s) => s.id));
  const drawnCode = new Map(starters.map((d) => [d.id, d.code]));
  const firstIn = (r: Row) => (Array.isArray(r.exchanges) ? r.exchanges.find((x) => x.direction === "in") : undefined);
  const subs = codes
    ? []
    : Object.entries(ledger ?? {})
        .filter(([id, r]) => r && r.played === true && r.started !== true && !onField.has(id))
        .sort((a, b) => (firstIn(a[1])?.minute ?? Infinity) - (firstIn(b[1])?.minute ?? Infinity) || a[0].localeCompare(b[0]));
  for (const [id, r] of subs) {
    const code = topPlayedCode(r.positionsPlayed);
    if (!code) continue;
    const replaced = firstIn(r)?.with;
    const slot = replaced ? (drawnCode.has(replaced) ? drawnCode.get(replaced)! : topPlayedCode(ledger?.[replaced]?.positionsPlayed)) : null;
    if (slot === code) continue;
    const [x, y] = pointOf(code, false);
    const d: CampoDot = { id, x, y, code, sub: true, estimated: r.positionsEstimated === true };
    settle(d, placed);
    placed.push(d);
  }

  const coded = placed.filter((d) => d.code);
  const est = coded.filter((d) => d.estimated).length;
  // («de la pizarra oficial» only when every starter drawn has his code)
  const source: CampoSource = uncoded.length ? "partial" : est === 0 ? "board" : est === coded.length ? "estimated" : "mixed";
  return { dots: placed, source };
}
