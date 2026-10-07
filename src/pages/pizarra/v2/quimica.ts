// La pizarra «Noche de partido» — the química as light: every cromo links to its two nearest neighbours,
// each link scored by fit, goals assisted to each other and matches together; the total (0–100) reads
// the links, who plays in his natural zone, the goalkeeper and the form. Pure.
import type { Lineup, Zone } from "../formations";
import { slotPos, slotZone, planeDist2 } from "./geometry";
import { fits, pairOf, type Squad } from "./model";

export interface Link {
  /** Slot indexes (i < j) and their players. */
  i: number;
  j: number;
  a: string;
  b: string;
  /** 1 + fit + assists (≤ 2) + 5 matches together. */
  s: number;
  /** 3 = ++ (oro), 2 = + (cielo), 1 = – (discontinua). */
  t: 1 | 2 | 3;
  ast: number;
  tog: number;
  nat: boolean;
}

const MAX_LINK = 66;

export function links(L: Lineup, sq: Squad): Link[] {
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
    const nat = fits(L, sq, a, slotZone(L, i)) && fits(L, sq, b, slotZone(L, j));
    const { ast, tog } = pairOf(sq, a, b);
    const s = 1 + (nat ? 1 : 0) + Math.min(2, ast) + (tog >= 5 ? 1 : 0);
    return { i, j, a, b, s, t: s >= 4 ? 3 : s >= 2 ? 2 : 1, ast, tog, nat };
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
  gk: boolean;
  natN: number;
  /** Radar axes (0–100): ataque, defensa, forma (mean rating), experiencia. */
  at: number;
  de: number;
  fo: number;
  ex: number;
  lines: LineTotals[];
  /** Names of the placed players with no match yet (their química counts as neutral). */
  fresh: string[];
}

export function chem(L: Lineup, sq: Squad): Chem {
  const placed = L.slots.map((s, i) => ({ id: s.playerId, i })).filter((x): x is { id: string; i: number } => !!x.id && sq.byId.has(x.id));
  const n = placed.length;
  const lines: LineTotals[] = (["DEF", "MED", "DEL"] as const).map((z) => ({ z, g: 0, a: 0, min: 0 }));
  if (!n) return { v: 0, links: [], n: 0, gk: false, natN: 0, at: 0, de: 0, fo: 0, ex: 0, lines, fresh: [] };
  const ls = links(L, sq);
  const g0 = L.slots[0]?.playerId;
  const gk = !!g0 && sq.byId.has(g0) && fits(L, sq, g0, "POR");
  const natN = placed.filter((p) => fits(L, sq, p.id, slotZone(L, p.i))).length;
  const la = ls.length ? ls.reduce((a, l) => a + l.s, 0) / ls.length / 5 : 0;
  const cs = placed.map((p) => sq.byId.get(p.id)!);
  const fa = cs.reduce((a, c) => a + c.rt, 0) / n;
  const v = Math.round((la * 50 + (natN / n) * 28 + (gk ? 12 : 0) + (fa / 99) * 10) * (n / 7));
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
  return {
    v: Math.max(0, Math.min(100, v)),
    links: ls,
    n,
    gk,
    natN,
    at: Math.min(100, Math.round((ga / 40) * 100)),
    de: Math.min(100, Math.round((gk ? 30 : 0) + Math.min(70, (defMin / 1050) * 70))),
    fo: Math.round(fa),
    ex: Math.min(100, Math.round((played / 49) * 100)),
    lines,
    fresh: cs.filter((c) => !c.stats.played).map((c) => c.name),
  };
}

export function tierOf(v: number): [label: string, sym: string] {
  return v >= 85 ? ["De campeones", "+++"] : v >= 72 ? ["Muy alta", "++"] : v >= 58 ? ["Buena", "+"] : v >= 40 ? ["Justa", "="] : ["Floja", "–"];
}

export const linkMark = (t: 1 | 2 | 3): string => (t === 3 ? "++" : t === 2 ? "+" : "–");

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
