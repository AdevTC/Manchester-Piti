// La pizarra · Bloque 4 — lo planeado frente a lo jugado: what this seven has done in the season's played
// matches (the ones that started with at least five of these seven: «Con este siete: 3V 1E 0D · 9 GF 4 GC»),
// how the board's seven compares with the seven that played its linked match, and «Copiar el siete del
// último partido» (the starters of the last played match placed on a system by their positions). Pure.
import type { FormationName, Lineup } from "../formations";
import { FORM } from "./geometry";
import { natOf, type Squad } from "./model";
import { hasFitData, inPlace, logicGrade, placeByWeight } from "./encaje";
import type { CalMatch } from "./boards";

/** At least this many of the seven in common for a match to count as «this seven». */
export const SAME_MIN = 5;

const sevenOf = (L: Lineup): string[] => L.slots.map((s) => s.playerId).filter((x): x is string => !!x);
const shared = (a: readonly string[], b: readonly string[]): number => {
  const s = new Set(b);
  return a.filter((x) => s.has(x)).length;
};
const playedWithSeven = (m: CalMatch): boolean => m.played && m.gf != null && m.ga != null && (m.conv?.starters.length ?? 0) > 0;

export interface Record7 {
  /** Matches that count. */
  n: number;
  v: number;
  e: number;
  d: number;
  gf: number;
  gc: number;
}

/** The record of the matches started by ≥ SAME_MIN of the board's seven (none until the seven has that many). */
export function recordWith(L: Lineup, calendar: readonly CalMatch[]): Record7 {
  const r: Record7 = { n: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 };
  const s = sevenOf(L);
  if (s.length < SAME_MIN) return r;
  calendar.forEach((m) => {
    if (!playedWithSeven(m) || shared(s, m.conv?.starters ?? []) < SAME_MIN) return;
    const gf = m.gf as number;
    const ga = m.ga as number;
    r.n++;
    r.gf += gf;
    r.gc += ga;
    if (gf > ga) r.v++;
    else if (gf === ga) r.e++;
    else r.d++;
  });
  return r;
}

/** «Con este siete: 3V 1E 0D · 9 GF 4 GC» (null when no match counts). */
export function recordTxt(r: Record7): string | null {
  if (!r.n) return null;
  return "Con este siete: " + r.v + "V " + r.e + "E " + r.d + "D · " + r.gf + " GF " + r.gc + " GC";
}

export interface PlannedVsPlayed {
  /** How many of the planned seven started. */
  same: number;
  /** Planned but not in the seven that played, and the other way round. */
  out: string[];
  inn: string[];
}

/** The board's seven against the seven that started its (played) match; null when it isn't played or known. */
export function plannedVsPlayed(L: Lineup, m: CalMatch | null): PlannedVsPlayed | null {
  if (!m || !playedWithSeven(m)) return null;
  const s = sevenOf(L);
  const st = m.conv?.starters ?? [];
  return { same: shared(s, st), out: s.filter((x) => !st.includes(x)), inn: st.filter((x) => !s.includes(x)) };
}

/** «Jugaron 5 de los 7 planeados · no jugó TELLO · jugó KEVIN». */
export function pvpTxt(p: PlannedVsPlayed, name: (id: string) => string): string {
  const parts = ["Jugaron " + p.same + " de los 7 planeados"];
  if (p.out.length) parts.push((p.out.length === 1 ? "no salió " : "no salieron ") + p.out.map(name).join(", "));
  if (p.inn.length) parts.push((p.inn.length === 1 ? "salió " : "salieron ") + p.inn.map(name).join(", "));
  return parts.join(" · ");
}

/** The last played match whose seven is known (by date). */
export function lastPlayed(calendar: readonly CalMatch[]): CalMatch | null {
  let best: CalMatch | null = null;
  for (const m of calendar) if (playedWithSeven(m) && (!best || m.dateMs > best.dateMs)) best = m;
  return best;
}

/**
 * A match's starters on a system's slots: first each one in a slot of his own position (the keeper in goal),
 * then the rest in the slots left, in order; unknown players are left out. At most seven. When one of them
 * has an exact position (encaje.hasFitData), by the best encaje instead: in place over adaptado over
 * fuera (encaje.logicGrade, with the board's «Jugar de»), the goal only to a declared keeper while there
 * is one, ties in the order listed.
 */
export function sevenFromStarters(formation: FormationName, starters: readonly string[], sq: Squad, L: Lineup): (string | null)[] {
  const spots = FORM[formation];
  const ids = starters.filter((id, k) => sq.byId.has(id) && starters.indexOf(id) === k).slice(0, spots.length);
  const B: Lineup = { ...L, formation, freeMode: false };
  if (hasFitData(ids, sq, B)) {
    const keeper = ids.some((id) => inPlace(logicGrade(B, sq, id, 0)));
    return placeByWeight(spots.length, ids, (i, id) => {
      const g = logicGrade(B, sq, id, i);
      if (i === 0 && keeper && !inPlace(g)) return null;
      // (1000: every slot filled while there is someone; 100 in place; 10 a grade point, unknown as adaptado)
      return 1000 + (inPlace(g) ? 100 : 0) + 10 * (g ?? 1) + (ids.length - ids.indexOf(id)) / 1e3;
    });
  }
  const out: (string | null)[] = spots.map(() => null);
  const used = new Set<string>();
  spots.forEach((sp, i) => {
    const id = ids.find((x) => !used.has(x) && natOf(L, sq, x) === sp[1]);
    if (id) {
      out[i] = id;
      used.add(id);
    }
  });
  ids.forEach((id) => {
    if (used.has(id)) return;
    // (a keeper's slot only takes a keeper or, failing one, whoever is left last)
    const k = out.findIndex((x, i) => !x && i > 0);
    const at = k >= 0 ? k : out.findIndex((x) => !x);
    if (at >= 0) {
      out[at] = id;
      used.add(id);
    }
  });
  return out;
}
