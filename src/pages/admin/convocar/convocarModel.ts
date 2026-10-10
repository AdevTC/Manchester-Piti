// Convocar, pure (tested in convocarModel.test.ts): the matches it offers (the next three to play, plus the
// one asked for), the lead line under the title, the pool grouped by answer (Vienen / En duda / No vienen /
// Sin responder) with where each one hangs, the banquillo, and «Copiar la convocatoria de la Jn».
import { dateMillis, matchPhase } from "../../../../functions/src/matchEngine";
import { copyLineup, previousLineup } from "../acta/convocatoria";
import { clockTime, jLabel, shortDate, type AdminMatch } from "../data/adminLogic";
import { sameLineup, type Lineup, type Rsvp } from "../data/lineup";

/** The matches to call up: the next three still to play (not cancelled), plus the one asked for (`?j=`). */
export function convocables(matches: readonly AdminMatch[], now: number, wanted?: string): AdminMatch[] {
  const playable = (m: AdminMatch) => ["scheduled", "playing"].includes(matchPhase(m, now));
  const next = matches
    .filter(playable)
    .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))
    .slice(0, 3);
  const w = wanted ? matches.find((m) => m.id === wanted && playable(m)) : undefined;
  return w && !next.includes(w) ? [...next, w].sort((a, b) => dateMillis(a.date) - dateMillis(b.date)) : next;
}

/** «J8 · MAD SKY» — the switcher's words (the rival's full name, never cut). */
export const matchTitle = (m: AdminMatch) => `${jLabel(m)} · ${m.rival ?? "Rival"}`;
/** «dom 8 nov · 12:00 · fuera». */
export function matchLead(m: AdminMatch): string {
  const t = dateMillis(m.date);
  return [shortDate(t), clockTime(t), m.home === false ? "fuera" : "en casa"].join(" · ");
}

export interface PoolPlayer {
  id: string;
  name: string;
  number: number | null;
  position: string;
}
export type PoolSlot = "T" | "B" | "";
export interface PoolRow {
  id: string;
  num: string;
  name: string;
  /** «POR · en el siete», «MED · sin colocar». */
  line: string;
  slot: PoolSlot;
}
export interface PoolGroup {
  key: Rsvp;
  title: string;
  rows: PoolRow[];
}
const GROUPS: [Rsvp, string][] = [
  ["si", "Vienen"],
  ["duda", "En duda"],
  ["no", "No vienen"],
  ["sin", "Sin responder"],
];
const PLACE: Record<PoolSlot, string> = { T: "en el siete", B: "en el banquillo", "": "sin colocar" };
export const slotOf = (l: Lineup, id: string): PoolSlot => (l.starters.includes(id) ? "T" : l.bench.includes(id) ? "B" : "");

/** The squad by answer (empty groups left out), roster order kept. */
export function poolGroups(roster: readonly PoolPlayer[], lineup: Lineup, rsvp: ReadonlyMap<string, Rsvp>): PoolGroup[] {
  return GROUPS.map(([key, title]) => ({
    key,
    title,
    rows: roster
      .filter((p) => (rsvp.get(p.id) ?? "sin") === key)
      .map((p): PoolRow => {
        const slot = slotOf(lineup, p.id);
        return { id: p.id, num: p.number != null ? String(p.number) : "", name: p.name, line: [p.position, PLACE[slot]].filter(Boolean).join(" · "), slot };
      }),
  })).filter((g) => g.rows.length);
}

/** The banquillo in the order it was called (players of the squad only). */
export function benchOf(roster: readonly PoolPlayer[], lineup: Lineup): PoolPlayer[] {
  const by = new Map(roster.map((p) => [p.id, p]));
  return lineup.bench.map((id) => by.get(id)).filter((p): p is PoolPlayer => !!p);
}

/**
 * «Copiar la convocatoria de la J7»: the latest earlier match of the season with one, as this squad's
 * siete + banquillo — null when there is none or it would change nothing.
 */
export function copyFrom(matches: readonly AdminMatch[], match: AdminMatch, current: Lineup, squad: readonly string[]): { label: string; lineup: Lineup } | null {
  const prev = previousLineup(matches, match);
  if (!prev) return null;
  const c = copyLineup({ starters: prev.starters ?? [], bench: prev.bench ?? [], notCalled: [] }, squad);
  const lineup = { starters: c.starters, bench: c.bench };
  return sameLineup(lineup, current) ? null : { label: jLabel(prev), lineup };
}
