// La pizarra «Noche de partido» — the química as light: every cromo links to its two nearest neighbours,
// each link scored by fit, goals assisted to each other and minutes on the pitch together (scaled by
// the minutes the team has played); the total (0–100) reads the links, who plays in his place (the
// encaje's logicGrade: in place counts whole, adapted half, an unknown position nothing), the goalkeeper
// and the form. The tiers (and the squad bars' diamonds) come from one table: TIERS. Pure.
import { POSITIONS, type PosCode } from "../../../lib/positions";
import type { Lineup, Zone } from "../formations";
// (`out` is taken: links() keeps its pairs in a local `out`)
import { adapted, hasFitData, homeName, inPlace, logicGrade, out as fuera, slotCode } from "./encaje";
import { slotPos, slotZone, planeDist2 } from "./geometry";
import { pairOf, teamMinutes, type Squad } from "./model";
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
  /** Both in their place (logicGrade ≥ 2). */
  nat: boolean;
  /** Not both in place only because one is adapted (nobody out, nobody unknown). */
  ada: boolean;
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
    const ga = logicGrade(L, sq, a, i);
    const gb = logicGrade(L, sq, b, j);
    const nat = inPlace(ga) && inPlace(gb);
    const ada = !nat && [ga, gb].every((g) => inPlace(g) || adapted(g));
    const { ast, tog, min } = pairOf(sq, a, b);
    const s = (nat ? 1 : 0) + togPoints(min, tm) + Math.min(2, ast);
    return { i, j, a, b, s, t: linkTier(s), ast, tog, min, nat, ada };
  });
}

export interface LineTotals {
  z: Exclude<Zone, "POR">;
  g: number;
  a: number;
  min: number;
}

/** A placed player not in his place, for the química's words. */
export interface OffSpot {
  name: string;
  /** Out of his place (else adapted). */
  out: boolean;
  /** The slot's position. */
  at: PosCode;
  /** Where he is at home, lower-cased (homeName). */
  from: string | null;
}

export interface Chem {
  v: number;
  links: Link[];
  n: number;
  /** A keeper in goal (an unknown position may keep goal: the 7/7 chip). */
  gk: boolean;
  /** A keeper in his place in goal (what the química rewards). */
  gkNat: boolean;
  /** Placed players in their place (logicGrade ≥ 2; unknown positions don't count). */
  natN: number;
  /** Placed players adapted (logicGrade 1): they count half. */
  adaN: number;
  /** Someone placed has an exact outfield position (hasFitData): the words name names. */
  exact: boolean;
  /** The placed players out of their place, then the adapted ones, in slot order. */
  off: OffSpot[];
  /** Placed players nobody knows the position of. */
  unkN: number;
  /** Radar axes (0–100): ataque, defensa, forma (mean rating), experiencia. */
  at: number;
  de: number;
  fo: number;
  ex: number;
  lines: LineTotals[];
  /** Names of the placed players with no match yet (no minutes together: their links are weak). */
  fresh: string[];
}

// The química of a lineup with a squad, worked out once: the board asks for it on every render and for
// the lineup a change is about to commit (the scoreboard's flip), which is the next render's lineup.
const chemCache = new WeakMap<Squad, WeakMap<Lineup, Chem>>();
/** chem(), remembered per (squad, lineup) object: both are immutable values. */
export function chemOf(L: Lineup, sq: Squad): Chem {
  let byL = chemCache.get(sq);
  if (!byL) chemCache.set(sq, (byL = new WeakMap()));
  let c = byL.get(L);
  if (!c) byL.set(L, (c = chem(L, sq)));
  return c;
}

export function chem(L: Lineup, sq: Squad): Chem {
  const placed = L.slots.map((s, i) => ({ id: s.playerId, i })).filter((x): x is { id: string; i: number } => !!x.id && sq.byId.has(x.id));
  const n = placed.length;
  const lines: LineTotals[] = (["DEF", "MED", "DEL"] as const).map((z) => ({ z, g: 0, a: 0, min: 0 }));
  if (!n) return { v: 0, links: [], n: 0, gk: false, gkNat: false, natN: 0, adaN: 0, exact: false, off: [], unkN: 0, at: 0, de: 0, fo: 0, ex: 0, lines, fresh: [] };
  const ls = links(L, sq);
  const grades = placed.map((p) => logicGrade(L, sq, p.id, p.i));
  const k0 = placed.findIndex((p) => p.i === 0);
  const gk = k0 >= 0 && (grades[k0] == null || inPlace(grades[k0]));
  const gkNat = k0 >= 0 && inPlace(grades[k0]);
  const natN = grades.filter(inPlace).length;
  const adaN = grades.filter(adapted).length;
  const offOf = (bad: (g: (typeof grades)[number]) => boolean, isOut: boolean): OffSpot[] =>
    placed
      .filter((_, k) => bad(grades[k]))
      .map((p) => ({ name: sq.byId.get(p.id)?.name ?? "Jugador", out: isOut, at: slotCode(L, p.i), from: homeName(L, sq, p.id) }));
  const off = [...offOf(fuera, true), ...offOf(adapted, false)];
  const unkN = grades.filter((g) => g == null).length;
  const la = ls.length ? ls.reduce((a, l) => a + l.s, 0) / ls.length / 5 : 0;
  const cs = placed.map((p) => sq.byId.get(p.id)!);
  // the form of those who have played (a debutant has no form yet: he neither adds nor takes)
  const rated = cs.filter((c) => !c.unrated);
  const fa = rated.length ? rated.reduce((a, c) => a + c.rt, 0) / rated.length : 0;
  const v = Math.round((la * 50 + ((natN + 0.5 * adaN) / n) * 28 + (gkNat ? 12 : 0) + (fa / 99) * 10) * (n / 7));
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
    adaN,
    exact: hasFitData(placed.map((p) => p.id), sq),
    off,
    unkN,
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

const offTxt = (o: OffSpot): string => {
  const at = POSITIONS[o.at].name.toLowerCase();
  return o.out ? o.name + " fuera de su sitio (" + (o.from ? "de " + o.from + " " : "") + "en " + at + ")" : o.name + " adaptado de " + at;
};

/** Why the química is what it is, in one line. With exact positions it names who is adapted or out
 *  («6 en su sitio · PABLO adaptado de interior izquierdo»: those out first, two at most, then «y N
 *  más»); a squad known only by lines keeps the old words. */
export function chemWhy(ch: Chem): string {
  if (ch.n < 7) return "Faltan cromos: la química sube al completar el siete.";
  if (!ch.gkNat) return "Sin portero natural la química se resiente.";
  if (!ch.exact) {
    const off = 7 - ch.natN;
    return off ? off + " fuera de su posición natural: recoloca para sumar." : "Todos en su sitio natural.";
  }
  if (ch.natN === 7) return "Todos en su sitio.";
  const named = ch.off.slice(0, 2).map(offTxt);
  const more = ch.off.length - named.length;
  const parts = [ch.natN + " en su sitio", ...named];
  let txt = parts.join(" · ") + (more > 0 ? " y " + more + " más" : "");
  if (ch.unkN) txt += " · " + ch.unkN + " sin posición conocida";
  return txt + ".";
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
      why: [l.ast ? plural(l.ast, "gol", "goles") + " juntos" : "", togTxt(l.min), l.nat ? "" : l.ada ? "alguno adaptado" : "alguno fuera de sitio"].filter(Boolean).join(" · "),
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
