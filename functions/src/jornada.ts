// The one jornada numbering (pure, shared with the web through src/lib/derived/jornada.ts). A match takes
// a number when it belongs to a season, is published (an admin draft gets none until it is) and is not
// cancelled; the numbers go by date inside each season (undated matches after the dated ones, ties by
// id), so «J5» is the same match on /partidos, the admin, the pizarra and the push, whatever season is
// selected — with «all seasons» a match keeps the number it has in its own season.
import { dateMillis } from "./matchEngine.js";

export interface JornadaMatch {
  id: string;
  seasonId?: string | null;
  date?: unknown;
  status?: string;
  /** false = an admin draft that is not in the public calendar yet (absent = published). */
  published?: boolean;
}

/** Does this match take a jornada number: in a season, published, not cancelled. */
export function hasJornada(m: JornadaMatch): boolean {
  return !!m.seasonId && m.published !== false && m.status !== "cancelled";
}

const when = (m: Pick<JornadaMatch, "date">) => {
  const t = dateMillis(m.date);
  return Number.isFinite(t) ? t : Infinity;
};
/** The calendar's order — by date, undated matches after the dated ones, ties by id: the order the
 *  numbers follow, so every list that shows them reads J1, J2, J3… */
export const calendarOrder = (a: Pick<JornadaMatch, "id" | "date">, b: Pick<JornadaMatch, "id" | "date">): number => {
  const ta = when(a);
  const tb = when(b);
  return ta === tb ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : ta < tb ? -1 : 1;
};

/** Every numbered match's jornada, each one counted inside its own season (match id → 1, 2, 3…). */
export function jornadaNumbers(matches: readonly JornadaMatch[]): Map<string, number> {
  const out = new Map<string, number>();
  const count = new Map<string, number>();
  for (const m of matches.filter(hasJornada).sort(calendarOrder)) {
    const season = m.seasonId as string;
    const n = (count.get(season) ?? 0) + 1;
    count.set(season, n);
    out.set(m.id, n);
  }
  return out;
}

/** The jornadas of one season (match id → number). */
export function jornadas(matches: readonly JornadaMatch[], seasonId: string): Map<string, number> {
  return jornadaNumbers(matches.filter((m) => m.seasonId === seasonId));
}

/** One match's jornada in its season (null: a draft, cancelled, without season, or not in `matches`). */
export function jornadaOf(matches: readonly JornadaMatch[], matchId: string): number | null {
  const m = matches.find((x) => x.id === matchId);
  if (!m || !hasJornada(m)) return null;
  return jornadas(matches, m.seasonId as string).get(matchId) ?? null;
}

/** «J5» (empty without a number). */
export const jornadaLabel = (j: number | null | undefined): string => (j ? `J${j}` : "");
