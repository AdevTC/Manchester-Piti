// «Vidrio» · the match's signature: a ring of concentric lines drawn round the clock face (kick-off at the top,
// clockwise to the final whistle), pushed out by our goals and our woodwork, pulled in by theirs and by our
// saves, with a mark at each one. Built from the match's real plays (the plays that stand, at their shown
// minute) for a played match and for a live one up to its minute (the rest as a faint arc, a needle at now).
// Pure geometry: SVG path strings in a −104…104 box, deterministic (seeded noise), no DOM.
import type { ClubMatch } from "../../clubData";
import { eventMetaOf, settled } from "../../eventMeta";
import { shownMinute } from "../../partidos";
import { eventMinute } from "../../../../functions/src/matchEngine";
import { stripStateOf } from "./strip";

/** g our goal · r theirs · a our card · p our woodwork · s our save. */
export type SigKind = "gol" | "rival" | "tarjeta" | "palo" | "parada";
const CODE: Record<SigKind, "g" | "r" | "a" | "p" | "s"> = { gol: "g", rival: "r", tarjeta: "a", palo: "p", parada: "s" };

export interface SigMark {
  eventId: string;
  minute: number;
  kind: SigKind;
  /** On the outer rim, in the box's units. */
  x: number;
  y: number;
  /** Radians, 0 = 3 o'clock (kick-off is −π/2). */
  angle: number;
}
export interface SigRing {
  d: string;
  /** The outer lines (drawn lighter) or the inner ones. */
  outer: boolean;
  opacity: number;
  strokeWidth: number;
}
export interface MatchSignature {
  viewBox: "-104 -104 208 208";
  duration: number;
  /** The minute it is drawn up to (the duration once played). */
  upto: number;
  live: boolean;
  /** Played: the lines close on themselves. */
  closed: boolean;
  /** Outer first. */
  rings: SigRing[];
  /** What is still to be played, as faint arcs (live only). */
  future: string[];
  /** The minute scale round the rim (size «b»); null otherwise. */
  ticks: string | null;
  /** Kick-off and half-time strokes (size «b»). */
  halfMarks: string[];
  /** Goals, cards, woodwork and saves (sizes «s» and «b»). */
  marks: SigMark[];
  /** The hand at the live minute. */
  needle: { d: string; x: number; y: number } | null;
}

/** s small (the ribbon), m medium (no marks), b big (the acta, with its scale), p poster (lines only). */
export type SigSize = "s" | "m" | "b" | "p";
const SIZE: Record<SigSize, { N: number; step: number; lw: number; scale: boolean; marks: boolean; head: boolean }> = {
  s: { N: 7, step: 0.5, lw: 1.6, scale: false, marks: true, head: true },
  m: { N: 6, step: 1, lw: 1.6, scale: false, marks: false, head: true },
  b: { N: 15, step: 0.25, lw: 1.1, scale: true, marks: true, head: true },
  p: { N: 9, step: 0.5, lw: 1.5, scale: false, marks: false, head: false },
};

/** The angle of `minute` in a match of `duration` minutes: −π/2 at kick-off, clockwise. */
export const signatureAngle = (minute: number, duration = 50): number => -Math.PI / 2 + (minute / duration) * Math.PI * 2;

/** Where `minute` falls at `radius` (a fraction of the box's half-width) as percentages of the box, for a
 *  label laid over the drawing. */
export function signaturePoint(minute: number, duration = 50, radius = 0.548): { x: number; y: number; left: boolean } {
  const a = signatureAngle(minute, duration);
  return { x: 50 + Math.cos(a) * radius * 100, y: 50 + Math.sin(a) * radius * 100, left: Math.cos(a) < 0 };
}

function noise(seed: number) {
  const r: number[] = [];
  let s = seed;
  for (let i = 0; i < 64; i++) {
    s = (s * 16807) % 2147483647;
    r.push((s / 2147483647) * 2 - 1);
  }
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = r[((i % 64) + 64) % 64];
    const b = r[(((i + 1) % 64) + 64) % 64];
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };
}
const N3 = noise(3);
const gauss = (x: number, w: number) => Math.exp(-(x * x) / (2 * w * w));
const spike = (x: number, w: number) => Math.exp(-Math.abs(x) / w) * (1 - Math.min(1, Math.abs(x) / (w * 9)));
const f1 = (n: number) => Math.round(n * 10) / 10;

type Ev = readonly [number, "g" | "r" | "a" | "p" | "s"];
function pressure(evs: readonly Ev[], m: number) {
  let p = 0.22 * Math.sin(m * 0.42 + 1.3) + 0.14 * Math.sin(m * 1.07 + 0.4) + 0.08 * N3(m * 0.9);
  for (const [at, k] of evs) {
    if (k === "g") p += 0.95 * gauss(m - (at - 1.3), 2.2);
    else if (k === "p") p += 0.7 * gauss(m - (at - 0.8), 1.8);
    else if (k === "r") p -= 0.95 * gauss(m - (at - 1.2), 2.1);
    else if (k === "s") p -= 0.75 * gauss(m - (at - 0.6), 1.7);
  }
  return Math.max(-1, Math.min(1, p));
}

/** The signature's kind of a play, or null when it doesn't mark it. */
export function signatureKind(e: Parameters<typeof eventMetaOf>[0]): SigKind | null {
  const m = eventMetaOf(e);
  if (m.goal === "for") return "gol";
  if (m.goal === "against") return "rival";
  if (m.side !== "us") return null;
  if (m.card) return "tarjeta";
  if (m.glyph === "palo") return "palo";
  if (m.glyph === "parada") return "parada";
  return null;
}

/** The marked plays of a match: minute (capped at `duration`), kind and id, in order of play. */
export function signatureEvents(match: Pick<ClubMatch, "events">, duration = 50): { id: string; minute: number; kind: SigKind }[] {
  const out: { id: string; minute: number; kind: SigKind }[] = [];
  for (const e of settled(match.events)) {
    const kind = signatureKind(e);
    const minute = eventMinute(e);
    if (!kind || minute === null) continue;
    out.push({ id: e.id, minute: Math.max(0, Math.min(duration, minute)), kind });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

/** The ring drawn from `events` up to minute `upto` of `duration` (the drawing of v4-b draw.js, any length). */
export function signatureRing(events: readonly { id: string; minute: number; kind: SigKind }[], upto: number, duration = 50, size: SigSize = "s", live = upto < duration): MatchSignature {
  const o = SIZE[size];
  const R = 100;
  const r0 = R * 0.36;
  const r1 = R * 0.8;
  const dr = (r1 - r0) / (o.N - 1);
  const D = duration;
  // (the drawing is tuned on a 50-minute face: minutes are read on that scale)
  const k50 = 50 / D;
  const th = (m: number) => signatureAngle(m, D);
  const shown = events.filter((e) => e.minute <= upto);
  const evs: Ev[] = shown.map((e) => [e.minute * k50, CODE[e.kind]]);
  const end = upto * k50;

  const future: string[] = [];
  if (live && upto < D)
    for (let k = 0; k < o.N; k += 3) {
      const rr = r0 + k * dr;
      const a0 = th(upto + 0.6 / k50);
      const a1 = th(D);
      future.push(`M${f1(rr * Math.cos(a0))} ${f1(rr * Math.sin(a0))} A${f1(rr)} ${f1(rr)} 0 ${upto < D / 2 ? 1 : 0} 1 ${f1(rr * Math.cos(a1))} ${f1(rr * Math.sin(a1))}`);
    }
  const rings: SigRing[] = [];
  for (let k = o.N - 1; k >= 0; k--) {
    const u = k / (o.N - 1);
    const rk = r0 + k * dr;
    const amp = Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 1.35);
    const inner = Math.pow(1 - u, 1.6);
    const alpha = 0.22 + 0.7 * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * u)), 0.9);
    const nz = noise(11 + k);
    const nz2 = noise(91 + k);
    const pts: string[] = [];
    for (let m = 0; m <= end + 1e-6; m += o.step) {
      const mm = Math.min(m, end);
      let d = R * 0.012 * (nz(mm * 0.55 + k * 1.7) * 0.7 + nz2(mm * 2) * 0.08) * (0.35 + amp) + R * 0.03 * pressure(evs, mm) * (0.5 + 0.5 * u);
      for (const [at, t] of evs) {
        const x = mm - at;
        if (t === "g") d += R * 0.2 * amp * (spike(x, 0.3) + 0.3 * spike(x - 0.75, 0.22) + 0.2 * spike(x + 0.9, 0.3));
        else if (t === "p") d += R * 0.1 * amp * Math.min(1, gauss(x, 0.45) * 1.6);
        else if (t === "r") d -= R * 0.13 * inner * spike(x, 0.4);
        else if (t === "s") d -= R * 0.075 * inner * gauss(x, 0.5);
      }
      const r = rk + d;
      const a = th(mm / k50);
      pts.push(`${f1(r * Math.cos(a))} ${f1(r * Math.sin(a))}`);
    }
    rings.push({ d: `M${pts.join(" L")}${live ? "" : " Z"}`, outer: u > 0.62, opacity: Math.round(alpha * 100) / 100, strokeWidth: o.lw });
  }
  let ticks: string | null = null;
  const halfMarks: string[] = [];
  if (o.scale) {
    const rt = R * 0.9;
    const t: string[] = [];
    for (let mi = 1; mi < D; mi++) {
      if (mi * 2 === D) continue;
      const a = th(mi);
      const l = mi % 5 === 0 ? 3.6 : 1.6;
      t.push(`M${f1(rt * Math.cos(a))} ${f1(rt * Math.sin(a))} L${f1((rt - l) * Math.cos(a))} ${f1((rt - l) * Math.sin(a))}`);
    }
    ticks = t.join(" ");
    for (const mk of [0, D / 2]) {
      const a = th(mk);
      halfMarks.push(`M${f1((rt + 6) * Math.cos(a))} ${f1((rt + 6) * Math.sin(a))} L${f1((rt - 6) * Math.cos(a))} ${f1((rt - 6) * Math.sin(a))}`);
    }
  }
  const marks: SigMark[] = o.marks
    ? shown.map((e) => {
        const a = th(e.minute);
        return { eventId: e.id, minute: e.minute, kind: e.kind, x: f1(R * 0.96 * Math.cos(a)), y: f1(R * 0.96 * Math.sin(a)), angle: a };
      })
    : [];
  let needle: MatchSignature["needle"] = null;
  if (live && o.head) {
    const ah = th(upto);
    const rh = R * 0.9 + 3;
    needle = { d: `M${f1((r0 - 6) * Math.cos(ah))} ${f1((r0 - 6) * Math.sin(ah))} L${f1(rh * Math.cos(ah))} ${f1(rh * Math.sin(ah))}`, x: f1(rh * Math.cos(ah)), y: f1(rh * Math.sin(ah)) };
  }
  return { viewBox: "-104 -104 208 208", duration: D, upto, live, closed: !live, rings, future, ticks, halfMarks, marks, needle };
}

/**
 * The signature of `match` at `now`: played (its acta, or a clock that ran to the end) drawn whole; live drawn
 * up to its minute. Null for anything not played yet, postponed, cancelled or «pendiente» (nothing to draw).
 */
export function matchSignature(match: ClubMatch, now: number, size: SigSize = "s"): MatchSignature | null {
  const state = stripStateOf(match, now);
  const duration = match.duration && match.duration > 0 ? match.duration : 50;
  if (state === "jugado") return signatureRing(signatureEvents(match, duration), duration, duration, size);
  if (state !== "directo") return null;
  const minute = shownMinute(match, now) ?? 0;
  return signatureRing(signatureEvents(match, duration), Math.max(0, Math.min(duration, minute)), duration, size, true);
}
