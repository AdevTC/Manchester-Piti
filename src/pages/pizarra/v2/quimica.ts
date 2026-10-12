// La pizarra «Noche de partido» — the química as light: every cromo links to its two nearest neighbours,
// each link scored by fit, goals assisted to each other and minutes on the pitch together (scaled by
// the minutes the team has played); the total (0–100) reads the links, who plays in his natural zone
// (an unknown position is not natural), the goalkeeper and the form. The tiers (and the squad bars'
// diamonds) come from one table: TIERS. Pure.
import type { Lineup, Zone } from "../formations";
import { slotPos, slotZone, planeDist2 } from "./geometry";
import { fits, natural, pairOf, teamMinutes, type Squad } from "./model";
import { plural } from "./plural";

export interface Link {
  /** Slot indexes (i < j) and their players. */
  i: number;
  j: number;
  a: string;
  b: string;
  /** fit (1) + minutes together (≤ 2) + assists (≤ 2): 0–5. */
  s: number;
  /** 3 = ++ (oro), 2 = + (cielo), 1 = – (discontinua). */
  t: 1 | 2 | 3;
  ast: number;
  tog: number;
  /** Minutes on the pitch together this season. */
  min: number;
  nat: boolean;
}

/** Minutes together as link points: half the team's minutes or more = 2, a fifth = 1, less = 0. */
export function togPoints(min: number, teamMin: number): 0 | 1 | 2 {
  if (teamMin <= 0 || min <= 0) return 0;
  const share = min / teamMin;
  return share >= 0.5 ? 2 : share >= 0.2 ? 1 : 0;
}
/** A link's tier from its score: ++ (4–5), + (2–3), – (0–1). */
export const linkTier = (s: number): 1 | 2 | 3 => (s >= 4 ? 3 : s >= 2 ? 2 : 1);

const MAX_LINK = 66;

export function links(L: Lineup, sq: Squad): Link[] {
  const tm = teamMinutes(sq);
  const ids = L.slots.map((s) => s.playerId);
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    const pi = slotPos(L, i);
    const ds: { j: number; d: number }[] = [];
    for (let j = 0; j < ids.length; j++) {
      if (j === i || !ids[j]) continue;
      ds.push({ j, d: Math.sqrt(planeDist2(pi, slotPos(L, j))) });
    }
    ds.sort((a, b) => a.d - b.d || a.j - b.j);
    ds.slice(0, 2).forEach((x) => {
      if (x.d > MAX_LINK) return;
      const a = Math.min(i, x.j);
      const b = Math.max(i, x.j);
      const k = a + "-" + b;
      if (!seen.has(k)) {
        seen.add(k);
        out.push([a, b]);
      }
    });
  }
  return out.map(([i, j]) => {
    const a = ids[i] as string;
    const b = ids[j] as string;
    const nat = natural(L, sq, a, slotZone(L, i)) && natural(L, sq, b, slotZone(L, j));
    const { ast, tog, min } = pairOf(sq, a, b);
    const s = (nat ? 1 : 0) + togPoints(min, tm) + Math.min(2, ast);
    return { i, j, a, b, s, t: linkTier(s), ast, tog, min, nat };
  });
}

export interface LineTotals {
  z: Exclude<Zone, "POR">;
  g: number;
  a: number;
  min: number;
}

export interface Chem {
  v: number;
  links: Link[];
  n: number;
  /** A keeper in goal (an unknown position may keep goal: the 7/7 chip). */
  gk: boolean;
  /** A natural keeper in goal (what the química rewards). */
  gkNat: boolean;
  /** Placed players in their natural zone (unknown positions don't count). */
  natN: number;
  /** Radar axes (0–100): ataque, defensa, forma (mean rating), experiencia. */
  at: number;
  de: number;
  fo: number;
  ex: number;
  lines: LineTotals[];
  /** Names of the placed players with no match yet (no minutes together: their links are weak). */
  fresh: string[];
}

export function chem(L: Lineup, sq: Squad): Chem {
  const placed = L.slots.map((s, i) => ({ id: s.playerId, i })).filter((x): x is { id: string; i: number } => !!x.id && sq.byId.has(x.id));
  const n = placed.length;
  const lines: LineTotals[] = (["DEF", "MED", "DEL"] as const).map((z) => ({ z, g: 0, a: 0, min: 0 }));
  if (!n) return { v: 0, links: [], n: 0, gk: false, gkNat: false, natN: 0, at: 0, de: 0, fo: 0, ex: 0, lines, fresh: [] };
  const ls = links(L, sq);
  const g0 = L.slots[0]?.playerId;
  const gk = !!g0 && sq.byId.has(g0) && fits(L, sq, g0, "POR");
  const gkNat = !!g0 && sq.byId.has(g0) && natural(L, sq, g0, "POR");
  const natN = placed.filter((p) => natural(L, sq, p.id, slotZone(L, p.i))).length;
  const la = ls.length ? ls.reduce((a, l) => a + l.s, 0) / ls.length / 5 : 0;
  const cs = placed.map((p) => sq.byId.get(p.id)!);
  // the form of those who have played (a debutant has no form yet: he neither adds nor takes)
  const rated = cs.filter((c) => !c.unrated);
  const fa = rated.length ? rated.reduce((a, c) => a + c.rt, 0) / rated.length : 0;
  const v = Math.round((la * 50 + (natN / n) * 28 + (gkNat ? 12 : 0) + (fa / 99) * 10) * (n / 7));
  let defMin = 0;
  placed.forEach((p, k) => {
    const c = cs[k];
    const z = slotZone(L, p.i);
    if (p.i === 0 || z === "DEF") defMin += c.stats.minutes;
    const line = lines.find((x) => x.z === (z === "POR" ? "DEF" : z));
    if (line) {
      line.g += c.stats.goals;
      line.a += c.stats.assists;
      line.min += c.stats.minutes;
    }
  });
  const ga = cs.reduce((a, c) => a + c.stats.goals + c.stats.assists, 0);
  const played = cs.reduce((a, c) => a + c.stats.played, 0);
  // The bars are scaled by the matches the team has played (full = a strong seven's season so far):
  // ATA 40/7 goals + assists a match, DEF three defenders' minutes, EXP all seven in every match.
  const g = sq.games;
  const tm = teamMinutes(sq);
  const pct = (x: number, full: number) => (full > 0 ? Math.min(100, Math.round((x / full) * 100)) : 0);
  return {
    v: Math.max(0, Math.min(100, v)),
    links: ls,
    n,
    gk,
    gkNat,
    natN,
    at: pct(ga, (g * 40) / 7),
    de: Math.min(100, Math.round((gkNat ? 30 : 0) + (tm > 0 ? Math.min(70, (defMin / (tm * 3)) * 70) : 0))),
    fo: Math.round(fa),
    ex: pct(played, g * 7),
    lines,
    fresh: cs.filter((c) => !c.stats.played).map((c) => c.name),
  };
}

/** The química's tiers, best first: from (inclusive), label, symbol, and the diamonds it lights on the
 *  squad bars. The one source for the scoreboard, the panel and the diamonds. */
export const TIERS: readonly { from: number; label: string; sym: string; dm: 0 | 1 | 2 | 3 }[] = [
  { from: 85, label: "De campeones", sym: "+++", dm: 3 },
  { from: 72, label: "Muy alta", sym: "++", dm: 2 },
  { from: 58, label: "Buena", sym: "+", dm: 1 },
  { from: 40, label: "Justa", sym: "=", dm: 0 },
  { from: 0, label: "Floja", sym: "–", dm: 0 },
];
const tierRow = (v: number) => TIERS.find((t) => v >= t.from) ?? TIERS[TIERS.length - 1];

export function tierOf(v: number): [label: string, sym: string] {
  const t = tierRow(v);
  return [t.label, t.sym];
}
/** How many of the three diamonds the química lights (its tier's). */
export const tierDiamonds = (v: number): 0 | 1 | 2 | 3 => tierRow(v).dm;

export const linkMark = (t: 1 | 2 | 3): string => (t === 3 ? "++" : t === 2 ? "+" : "–");

/** Why the química is what it is, in one line. */
export function chemWhy(ch: Chem): string {
  if (ch.n < 7) return "Faltan cromos: la química sube al completar el siete.";
  if (!ch.gkNat) return "Sin portero natural la química se resiente.";
  const out = 7 - ch.natN;
  return out ? out + " fuera de su posición natural: recoloca para sumar." : "Todos en su sitio natural.";
}

/** «120′ juntos» / «sin minutos juntos». */
export const togTxt = (min: number): string => (min > 0 ? Math.round(min) + "′ juntos" : "sin minutos juntos");

/** «9 luces», «1 luz». */

export const lucesTxt = (n: number): string => plural(n, "luz", "luces");

export interface Luz {
  key: string;
  t: 1 | 2 | 3;
  /** «++», «+», «–». */
  mark: string;
  who: string;
  why: string;
}

/** The strongest links of the seven, best first, as the lists show them. */
export function lucesOf(ch: Chem, sq: Squad, n: number): Luz[] {
  const nm = (id: string) => sq.byId.get(id)?.name ?? "Jugador";
  return ch.links
    .slice()
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((l) => ({
      key: l.a + "|" + l.b,
      t: l.t,
      mark: linkMark(l.t),
      who: nm(l.a) + " · " + nm(l.b),
      why: [l.ast ? plural(l.ast, "gol", "goles") + " juntos" : "", togTxt(l.min), l.nat ? "" : "alguno fuera de sitio"].filter(Boolean).join(" · "),
    }));
}

/** Ripple: hop distance (through the links) from the slots whose player just changed. */
export function hops(L: Lineup, ls: Link[], changed: string[]): Map<number, number> {
  const hop = new Map<number, number>();
  if (!changed.length) return hop;
  const queue: number[] = [];
  L.slots.forEach((s, i) => {
    if (s.playerId && changed.includes(s.playerId)) {
      hop.set(i, 0);
      queue.push(i);
    }
  });
  while (queue.length) {
    const a = queue.shift() as number;
    ls.forEach((l) => {
      const o = l.i === a ? l.j : l.j === a ? l.i : -1;
      if (o >= 0 && !hop.has(o)) {
        hop.set(o, (hop.get(a) as number) + 1);
        queue.push(o);
      }
    });
  }
  return hop;
}
