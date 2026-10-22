// «La moviola» and «La tarde», pure: the ribbon's pressure paths, its marks folded by the room the track really
// has, the playhead's tip, and before the whistle the evening over the ground hour by hour (the sun from sun.ts).
import { sunPosition, sunTimes } from "../../../lib/derived/sun";
import { madridTime } from "../../../lib/derived/madrid";
import type { Play, PlayK } from "./model";

/** Catmull-rom through the points as cubic béziers: the ribbon's soft pressure line. */
export function smooth(pts: readonly [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The two pressure areas (ours above the axis, theirs under it) up to minute `upto`, in the 500 × 74 box. */
export function ribbonPaths(pulse: readonly number[], upto: number, duration: number): { us: string; them: string } {
  const us: [number, number][] = [[0, 37]];
  const them: [number, number][] = [[0, 37]];
  const step = 500 / duration;
  for (let i = 0; i <= upto; i++) {
    const v = pulse[i] ?? 0;
    const x = i * step;
    us.push([x, 37 - Math.max(0, v) * 3.3]);
    them.push([x, 37 + Math.max(0, -v) * 3.3]);
  }
  us.push([upto * step, 37]);
  them.push([upto * step, 37]);
  return { us: `${smooth(us)} Z`, them: `${smooth(them)} Z` };
}

const RANK: Partial<Record<PlayK, number>> = { gol: 6, rival: 6, penalti: 5, roja: 5, tarjeta: 4, tarjetaRival: 4, parada: 3, palo: 3, cambio: 1 };
const ICON: Partial<Record<PlayK, string>> = { gol: "ball", rival: "ball", palo: "post", parada: "glove", cambio: "swap", penalti: "whistle" };

export interface Mark {
  key: string;
  cls: string;
  left: string;
  top: number;
  /** A card shows as the card, not an icon. */
  icon: string | null;
  n: number;
  label: string;
  /** Where a tap takes the moviola. */
  to: number;
}

/** The ribbon's marks: plays of a lane close together fold into one (its main play's icon and a count), each
 *  fold pushed right so no two marks of a lane touch; one that would pass the edge joins the fold before it. */
export function ribbonMarks(plays: readonly Play[], edge: number, m: number, duration: number, trackW: number): Mark[] {
  const gapMin = 34 / ((trackW || 640) / duration);
  type C = { lane: "us" | "them"; start: number; end: number; items: Play[]; pos: number };
  let clusters: C[] = [];
  for (const p of plays) {
    if (p.m > edge) continue;
    const lane = p.side === "them" ? "them" : "us";
    const last = [...clusters].reverse().find((c) => c.lane === lane);
    if (last && p.m - last.end <= Math.max(3, gapMin) && p.m - last.start <= Math.max(6, gapMin * 1.6)) {
      last.items.push(p);
      last.end = p.m;
    } else clusters.push({ lane, start: p.m, end: p.m, items: [p], pos: 0 });
  }
  const topOf = (c: C) => [...c.items].sort((a, b) => (RANK[b.k] ?? 0) - (RANK[a.k] ?? 0))[0];
  const placed: C[] = [];
  for (const c of clusters) {
    const top = topOf(c);
    const prev = [...placed].reverse().find((x) => x.lane === c.lane);
    const pos = prev ? Math.max(top.m, prev.pos + gapMin) : top.m;
    if (pos > edge + 0.5 && prev) {
      prev.items = prev.items.concat(c.items);
      prev.end = c.end;
      continue;
    }
    c.pos = Math.min(pos, duration);
    placed.push(c);
  }
  clusters = placed;
  return clusters.map((c) => {
    const top = topOf(c);
    const k = top.k;
    const card = k === "tarjeta" || k === "tarjetaRival" || k === "roja";
    let cls = `vd-ribbon__mark--${card ? "card" : k === "gol" || k === "rival" ? "ball" : k === "palo" ? "post" : k === "parada" ? "glove" : "swap"}`;
    if (c.lane === "them") cls += " vd-ribbon__mark--them";
    if (k === "gol" && top.m <= m) cls += " vd-ribbon__mark--gold";
    if (k === "cambio") cls += " is-minor";
    if (c.start > m) cls += " is-later";
    if (m >= c.start && m <= c.end) cls += " is-at";
    const words = c.items.map((x) => (x.k === "cambio" ? "cambio" : x.title.charAt(0).toLowerCase() + x.title.slice(1)));
    const label = `${c.start === c.end ? `Minuto ${c.start}` : `Minutos ${c.start} a ${c.end}`}: ${c.items.length > 2 ? `${c.items.length} jugadas, ` : ""}${words.filter((w, i) => words.indexOf(w) === i).join(", ")}`;
    return { key: `${c.lane}${c.start}`, cls, left: ((c.pos / duration) * 100).toFixed(2), top: c.lane === "them" ? 76 : 24, icon: card ? null : (ICON[k] ?? "swap"), n: c.items.length, label, to: top.m };
  });
}

// ---------- «La tarde»
export interface Tarde {
  sunD: string;
  sunX: string;
  sunY: string;
  winL: string;
  winW: string;
  ticks: string[];
  marks: { left: string; h: string; t: string; cls: string }[];
  top: { left: string; h: string; t: string; cls: string }[];
}
const MIN = 60_000;

/** The evening around the kick-off (2 h 30 before to 1 h 30 after): the sun's height, the match's window, now,
 *  the whistle, the end, and above them the quedada (members), the floodlights and the sunset. */
export function tardeOf(kick: number, duration: number, now: number, opts: { whistle: boolean; member: boolean; meet: number | null }): Tarde {
  const T0 = kick - 150 * MIN;
  const T1 = kick + 90 * MIN;
  const tx = (t: number) => ((t - T0) / (T1 - T0)) * 100;
  const el = (t: number) => sunPosition(t).elevation;
  const y = (t: number) => 56 - Math.max(-12, Math.min(30, el(t))) * 1.9;
  const pts: [number, number][] = [];
  for (let t = T0; t <= T1 + 1; t += 10 * MIN) pts.push([tx(t) * 5, y(t)]);
  const at = Math.max(T0, Math.min(T1, now));
  const end = kick + duration * MIN;
  const sunset = sunTimes(kick).sunset;
  // the floodlights: the first minute the sun is under 3°
  let focos: number | null = null;
  for (let t = T0; t <= T1; t += MIN)
    if (el(t) < 3) {
      focos = t;
      break;
    }
  const mk = (t: number, lab: string, cls: string) => ({ left: tx(t).toFixed(2), h: madridTime(t), t: lab, cls });
  const marks = [mk(at, opts.whistle ? "Ahora, a punto" : "Ahora", `is-now${tx(at) < 12 ? " is-start" : tx(at) > 88 ? " is-end" : ""}`), mk(kick, "Pitido", `is-key${opts.whistle ? " is-hide" : ""}`), mk(end, "Final", "")];
  const top: Tarde["top"] = [];
  if (opts.meet != null && opts.meet >= T0) top.push(mk(opts.meet, "Quedada", opts.member ? "" : "is-hide"));
  if (focos != null && focos > T0 && focos < T1) top.push(mk(focos, "Focos", "is-minor is-end"));
  if (sunset > T0 && sunset < T1) top.push(mk(sunset, "Se pone el sol", "is-minor is-sun is-start"));
  const ticks: string[] = [];
  const h0 = new Date(T0);
  h0.setMinutes(0, 0, 0);
  for (let t = h0.getTime() + 60 * MIN; t < T1; t += 60 * MIN) ticks.push(tx(t).toFixed(2));
  return {
    sunD: smooth(pts),
    sunX: tx(at).toFixed(2),
    sunY: ((y(at) / 74) * 100).toFixed(1),
    winL: tx(kick).toFixed(2),
    winW: (tx(end) - tx(kick)).toFixed(2),
    ticks,
    marks,
    top,
  };
}
