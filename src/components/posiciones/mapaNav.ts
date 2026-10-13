// Pure helpers behind «Mapa de posiciones»: arrow-key navigation between the 13 spots and the texts
// (state of a spot, one-line summary, full description for screen readers).
import { POSITIONS, POS_CODES, type PosCode, type PositionSet } from "../../lib/positions";
import { proposalDiff } from "../../lib/positionsEdit";
import { PLAYED_EMPTY } from "../../lib/positionStats";

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

export { PLAYED_EMPTY };
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

/**
 * The map's drawing geometry, single source: the layout below works with these numbers and MapaPosiciones
 * hands them to posiciones.css as inline --_pos-* properties (geometryVars), which the stylesheet reads
 * instead of literals. Px unless noted.
 */
export const GEOMETRY = {
  /** History discs: diameters at a `discRef` px pitch (unitless; CSS scales them with the pitch), never under `discFloor`. */
  discMin: 28,
  discMax: 52,
  discFloor: 24,
  discRef: 320,
  /** The «320′» pill (.pos-min): at most w × h, `into` px into the disc's bottom, or `beside` px off its side and `low` px below its centre. */
  pill: { w: 40, h: 14, into: 5, beside: 6, low: 2 },
  /** The ★ / ✓ badge (.pos-mark; compare's +/− .pos-diff mirrors it on the left): a `size` square, `top` px
   *  above the disc's box and `side` px past its right edge. */
  badge: { size: 14, top: 5, side: 9 },
  /** How far a played disc's ring / halo reaches out of it. */
  ring: 4,
  /** Clear space kept between any two things of different spots. */
  air: 3,
} as const;
export const DISC_MIN = GEOMETRY.discMin;
export const DISC_MAX = GEOMETRY.discMax;
export const DISC_FLOOR = GEOMETRY.discFloor;

/** GEOMETRY as the inline custom properties posiciones.css reads (set on the .pos-map root). */
export function geometryVars(): Record<`--_pos-${string}`, string> {
  const { pill, badge } = GEOMETRY;
  return {
    "--_pos-disc-min": String(GEOMETRY.discMin),
    "--_pos-disc-ref": String(GEOMETRY.discRef),
    "--_pos-disc-floor": `${GEOMETRY.discFloor}px`,
    "--_pos-pill-w": `${pill.w}px`,
    "--_pos-pill-h": `${pill.h}px`,
    "--_pos-pill-into": `${pill.into}px`,
    "--_pos-pill-beside": `${pill.beside}px`,
    "--_pos-pill-low": `${pill.low}px`,
    "--_pos-badge": `${badge.size}px`,
    "--_pos-badge-top": `${badge.top}px`,
    "--_pos-badge-side": `${badge.side}px`,
    "--_pos-ring": `${GEOMETRY.ring}px`,
  };
}
/** The --_pos-* properties the component sets inline (the CSS contract test allows reading them without a fallback). */
export const INLINE_VARS: readonly string[] = [...Object.keys(geometryVars()), "--_pos-d", "--_pos-i", "--_pos-shift"];

/** The narrowest pitch each size is drawn at: the layout is checked there (wider only adds room). */
const NARROWEST: Record<"s" | "m", number> = { s: 240, m: MIN_PITCH_WIDTH };

export interface PlayedDisc {
  /** Diameter in px at a 320 px pitch. */
  d: number;
  /** Where «320′» goes: under the disc, or beside it (inwards) when the spot below leaves no room. */
  label: "below" | "side";
}

/** One spot as drawn on a pitch `w` px wide: its disc (r includes a played disc's ring) and its boxes. */
export type Box = { x0: number; y0: number; x1: number; y1: number };
export interface SpotShape {
  code: PosCode;
  cx: number;
  cy: number;
  r: number;
  boxes: Box[];
}

const AIR = GEOMETRY.air;
const boxesTouch = (a: Box, b: Box) => a.x0 < b.x1 + AIR && b.x0 < a.x1 + AIR && a.y0 < b.y1 + AIR && b.y0 < a.y1 + AIR;
function boxTouchesDisc(a: Box, s: SpotShape): boolean {
  const nx = Math.max(a.x0, Math.min(s.cx, a.x1));
  const ny = Math.max(a.y0, Math.min(s.cy, a.y1));
  return Math.hypot(nx - s.cx, ny - s.cy) < s.r + AIR;
}
const insidePitch = (b: Box, w: number) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= w && b.y1 <= w * PITCH_ASPECT;

/** The drawing of one spot (as posiciones.css draws it): `d` = diameter at the reference pitch, `played`
 *  adds the ring, `label` the «320′» pill, `marked` the ★ / ✓ badge. */
export function spotShape(code: PosCode, d: number, played: boolean, label: PlayedDisc["label"] | null, marked: boolean, w: number): SpotShape {
  const { pill, badge } = GEOMETRY;
  const p = POSITIONS[code];
  const cx = (p.x / 100) * w;
  const cy = (p.y / 100) * w * PITCH_ASPECT;
  const r = Math.max(GEOMETRY.discFloor, (d * w) / GEOMETRY.discRef) / 2;
  const boxes: Box[] = [];
  if (marked) boxes.push({ x0: cx + r + badge.side - badge.size, y0: cy - r - badge.top, x1: cx + r + badge.side, y1: cy - r - badge.top + badge.size });
  if (label === "below") boxes.push({ x0: cx - pill.w / 2, y0: cy + r - pill.into, x1: cx + pill.w / 2, y1: cy + r - pill.into + pill.h });
  if (label === "side") {
    const y0 = cy + pill.low - pill.h / 2;
    boxes.push(
      p.side === "derecha"
        ? { x0: cx - r - pill.beside - pill.w, y0, x1: cx - r - pill.beside, y1: y0 + pill.h }
        : { x0: cx + r + pill.beside, y0, x1: cx + r + pill.beside + pill.w, y1: y0 + pill.h },
    );
  }
  return { code, cx, cy, r: r + (played ? GEOMETRY.ring : 0), boxes };
}

/** Does `s` stay clear of every other shape (and inside the pitch)? */
function clear(s: SpotShape, others: SpotShape[], w: number): boolean {
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
    const shapes = new Map(POS_CODES.map((c) => [c, spotShape(c, d(c), growth.has(c), null, marked.includes(c), w)]));
    const out: Partial<Record<PosCode, PlayedDisc>> = {};
    let ok = true;
    for (const { code } of lines) {
      let label: PlayedDisc["label"] = "below";
      let s = spotShape(code, d(code), true, label, marked.includes(code), w);
      if (!clear(s, [...shapes.values()], w)) {
        label = "side";
        s = spotShape(code, d(code), true, label, marked.includes(code), w);
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
