// Pure helpers behind «Mapa de posiciones»: arrow-key navigation between the 13 spots and the texts
// (state of a spot, one-line summary, full description for screen readers).
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../lib/positions";
import { proposalDiff } from "../../lib/positionsEdit";

/** Height / width of the drawn pitch (portrait). The CSS aspect-ratio (4 / 7) must match. */
export const PITCH_ASPECT = 7 / 4;

/** Smallest pitch width (px) the host may give the map at size m and still get ≥ 44 px targets. */
export const MIN_PITCH_WIDTH = 280;
/** Height of every hit area, in % of the pitch height (CSS: 9 % × 7/4 = 15.75cqw of the pitch width). */
export const HIT_BAND = 9;
/** DFC and LIB are only 8 % apart: DFC's hit area moves up 1 % (its dot stays put) so the bands touch, not overlap. */
export const HIT_NUDGE: Partial<Record<PosCode, number>> = { DFC: -1 };
/** Vertical centre of a spot's hit area, in % of the pitch height. */
export const hitCentre = (code: PosCode): number => POSITIONS[code].y + (HIT_NUDGE[code] ?? 0);

export type Direction = "up" | "down" | "left" | "right";
export type SpotState = "preferida" | "también" | "nada";

/** The closest spot in that direction (distances on the real drawing, within a ~63° cone, off-axis drift
 *  weighs double); null at the edge. Every spot stays reachable from every other with the arrows. */
export function nearestSpot(from: PosCode, dir: Direction): PosCode | null {
  const a = POSITIONS[from];
  let best: PosCode | null = null;
  let bestScore = Infinity;
  for (const code of POS_CODES) {
    if (code === from) continue;
    const b = POSITIONS[code];
    const dx = b.x - a.x;
    const dy = (b.y - a.y) * PITCH_ASPECT;
    const [primary, cross] = dir === "up" ? [-dy, dx] : dir === "down" ? [dy, dx] : dir === "left" ? [-dx, dy] : [dx, dy];
    // only spots really in that direction: ED → right must not jump down to LD (2 % to the right)
    if (primary <= 0 || Math.abs(cross) > 2 * primary) continue;
    const score = primary + 2 * Math.abs(cross);
    if (score < bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return best;
}

export function spotState(set: PositionSet, code: PosCode): SpotState {
  return set.main === code ? "preferida" : set.also.includes(code) ? "también" : "nada";
}

/** «sin marcar» reads better than «nada» out loud. */
export const stateWord = (s: SpotState): string => (s === "nada" ? "sin marcar" : s);

export const DEFAULT_EMPTY = "Sin posición";

/** «Pivote (MCD) · también MC, DFC». */
export function summaryText(set: PositionSet, empty: string = DEFAULT_EMPTY): string {
  const also = set.also.join(", ");
  if (set.main) return `${POSITIONS[set.main].name} (${set.main})${also ? ` · también ${also}` : ""}`;
  return also ? `También ${also}` : empty;
}

const spelled = (codes: readonly PosCode[]) => codes.map((c) => `${POSITIONS[c].name} (${c})`).join(", ");

/** Everything the map shows, in words (the read-only map's accessible name). */
export function fullText(set: PositionSet, compare?: PositionSet, empty: string = DEFAULT_EMPTY): string {
  const parts: string[] = [];
  if (set.main) parts.push(`Preferida: ${spelled([set.main])}.`);
  if (set.also.length) parts.push(`También: ${spelled(set.also)}.`);
  if (!parts.length) parts.push(`${empty}.`);
  if (compare) {
    const diff = proposalDiff(compare, set);
    if (diff.added.length) parts.push(`Añadidas: ${spelled(diff.added)}.`);
    if (diff.removed.length) parts.push(`Quitadas: ${spelled(diff.removed)}.`);
    const from = diff.mainChange?.[0];
    if (from) parts.push(`Preferida antes: ${spelled([from])}.`);
  }
  return parts.join(" ");
}

// ── History mode («Ha jugado de») ────────────────────────────────────────────────────────────────

export const PLAYED_EMPTY = "Aún sin minutos con posición";
export const ESTIMATED_TEXT = "Algunos minutos estimados por su posición preferida";

/** The codes he played, by minutes desc (catalogue order on ties): only valid codes that read ≥ 1′. */
export function playedLines(played: Partial<Record<PosCode, number>>): { code: PosCode; minutes: number }[] {
  return POS_CODES.flatMap((code) => {
    const minutes = played[code];
    return typeof minutes === "number" && Number.isFinite(minutes) && Math.round(minutes) >= 1 ? [{ code, minutes }] : [];
  }).sort((a, b) => b.minutes - a.minutes);
}

const minutesWords = (m: number) => `${Math.round(m)} ${Math.round(m) === 1 ? "minuto" : "minutos"}`;

/** Everything the history map shows, in words (its accessible name): minutes by position, the positions
 *  he holds, and the «estimado» warning. */
export function playedText(set: PositionSet, played: Partial<Record<PosCode, number>>, estimated: boolean): string {
  const lines = playedLines(played);
  const parts = [lines.length ? `Ha jugado de ${lines.map((l) => `${POSITIONS[l.code].name} (${l.code}), ${minutesWords(l.minutes)}`).join("; ")}.` : `${PLAYED_EMPTY}.`];
  if (set.main) parts.push(`Preferida: ${spelled([set.main])}.`);
  if (set.also.length) parts.push(`También: ${spelled(set.also)}.`);
  if (estimated && lines.length) parts.push(`${ESTIMATED_TEXT}.`);
  return parts.join(" ");
}

/** Disc diameters, in px at the default 320 px pitch (CSS scales them with the pitch, never under DISC_FLOOR). */
export const DISC_MIN = 28;
export const DISC_MAX = 52;
export const DISC_FLOOR = 24;
const DISC_REF = 320;
/** The narrowest pitch each size is drawn at: the layout is checked there (wider only adds room). */
const NARROWEST: Record<"s" | "m", number> = { s: 240, m: MIN_PITCH_WIDTH };
/** The «320′» pill (CSS .pos-min): ≤ 40 × 14 px, 5 px into the disc's bottom, or 6 px beside it, 2 px low. */
const PILL = { w: 40, h: 14, into: 5, beside: 6, low: 2 };
/** The ★ / ✓ badge (CSS .pos-mark): 13.6 px square, 4.8 px out of the disc's top-right corner. */
const BADGE = { size: 13.6, out: 4.8 };
const AIR = 3;

export interface PlayedDisc {
  /** Diameter in px at a 320 px pitch. */
  d: number;
  /** Where «320′» goes: under the disc, or beside it (inwards) when the spot below leaves no room. */
  label: "below" | "side";
}

type Box = { x0: number; y0: number; x1: number; y1: number };
interface Shape {
  code: PosCode;
  cx: number;
  cy: number;
  r: number;
  boxes: Box[];
}

const boxesTouch = (a: Box, b: Box) => a.x0 < b.x1 + AIR && b.x0 < a.x1 + AIR && a.y0 < b.y1 + AIR && b.y0 < a.y1 + AIR;
function boxTouchesDisc(a: Box, s: Shape): boolean {
  const nx = Math.max(a.x0, Math.min(s.cx, a.x1));
  const ny = Math.max(a.y0, Math.min(s.cy, a.y1));
  return Math.hypot(nx - s.cx, ny - s.cy) < s.r + AIR;
}
const insidePitch = (b: Box, w: number) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= w * PITCH_ASPECT;

function shapeOf(code: PosCode, d: number, label: PlayedDisc["label"] | null, marked: boolean, w: number): Shape {
  const p = POSITIONS[code];
  const cx = (p.x / 100) * w;
  const cy = (p.y / 100) * w * PITCH_ASPECT;
  const r = Math.max(DISC_FLOOR, (d * w) / DISC_REF) / 2;
  const boxes: Box[] = [];
  if (marked) boxes.push({ x0: cx + r + BADGE.out - BADGE.size, y0: cy - r - BADGE.out, x1: cx + r + BADGE.out, y1: cy - r - BADGE.out + BADGE.size });
  if (label === "below") boxes.push({ x0: cx - PILL.w / 2, y0: cy + r - PILL.into, x1: cx + PILL.w / 2, y1: cy + r - PILL.into + PILL.h });
  if (label === "side") {
    const y0 = cy + PILL.low - PILL.h / 2;
    boxes.push(
      p.side === "derecha"
        ? { x0: cx - r - PILL.beside - PILL.w, y0, x1: cx - r - PILL.beside, y1: y0 + PILL.h }
        : { x0: cx + r + PILL.beside, y0, x1: cx + r + PILL.beside + PILL.w, y1: y0 + PILL.h },
    );
  }
  return { code, cx, cy, r, boxes };
}

/** Does `s` stay clear of every other shape (and inside the pitch)? */
function clear(s: Shape, others: Shape[], w: number): boolean {
  if (!s.boxes.every((b) => insidePitch(b, w))) return false;
  return others.every(
    (o) =>
      o.code === s.code ||
      (Math.hypot(o.cx - s.cx, o.cy - s.cy) >= o.r + s.r + AIR &&
        !s.boxes.some((b) => boxTouchesDisc(b, o) || o.boxes.some((ob) => boxesTouch(b, ob))) &&
        !o.boxes.some((ob) => boxTouchesDisc(ob, s))),
  );
}

/**
 * The history map's discs: diameter 28 → 52 px by √(minutes / most minutes), «320′» under each disc (beside
 * it when the spot below leaves no room). One scale for the whole map, so more minutes never draw smaller:
 * when two neighbours would touch at the size's narrowest pitch (DFC / LIB / POR are 8–9 % apart), every
 * disc's growth above 28 px shrinks by the same factor. Spots he never played stay 28 px. `marked` = the
 * codes that carry a ★ / ✓ badge (default: all, the safe guess).
 */
export function playedDiscs(played: Partial<Record<PosCode, number>>, size: "s" | "m" = "m", marked: readonly PosCode[] = POS_CODES): Partial<Record<PosCode, PlayedDisc>> {
  const lines = playedLines(played);
  if (!lines.length) return {};
  const most = lines[0].minutes;
  const w = NARROWEST[size];
  const growth = new Map(lines.map((l) => [l.code, (DISC_MAX - DISC_MIN) * Math.sqrt(l.minutes / most)]));
  const layout = (k: number) => {
    const d = (code: PosCode) => Math.round((DISC_MIN + k * (growth.get(code) ?? 0)) * 10) / 10;
    const shapes = new Map(POS_CODES.map((c) => [c, shapeOf(c, d(c), null, marked.includes(c), w)]));
    const out: Partial<Record<PosCode, PlayedDisc>> = {};
    let ok = true;
    for (const { code } of lines) {
      let label: PlayedDisc["label"] = "below";
      let s = shapeOf(code, d(code), label, marked.includes(code), w);
      if (!clear(s, [...shapes.values()], w)) {
        label = "side";
        s = shapeOf(code, d(code), label, marked.includes(code), w);
        ok &&= clear(s, [...shapes.values()], w);
      }
      shapes.set(code, s);
      out[code] = { d: d(code), label };
    }
    // the discs alone (no labels yet) must be clear too
    ok &&= [...shapes.values()].every((s) => clear(s, [...shapes.values()], w));
    return { out, ok };
  };
  for (let k = 1; k > 0; k = Math.round((k - 0.05) * 100) / 100) {
    const l = layout(k);
    if (l.ok) return l.out;
  }
  return layout(0).out;
}
