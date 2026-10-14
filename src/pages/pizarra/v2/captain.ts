// La pizarra · Bloque 5 — el capitán rotativo: who has worn the brazalete in the season's played matches
// (the official board of each one, the captain it named) and, among the seven on the board, who should
// wear it next: the fewest brazaletes, then the longest without one, then the best form. Pure.
import type { Lineup } from "../formations";
import type { LineupDoc } from "../lineupDoc";
import type { CalMatch } from "./boards";
import type { Squad } from "./model";
import { toggleRole } from "./ops";

/** One brazalete worn: who and in which jornada (null when the match has none: it counts, without a «J…»). */
export interface Armband {
  id: string;
  j: number | null;
  matchId: string;
}

/**
 * The brazaletes of the played matches: each match's official board (the newest, if there were several
 * over time) and the captain it named. Matches not played yet, or whose official named nobody, count none.
 */
export function armbands(officials: readonly LineupDoc[], calendar: readonly CalMatch[]): Armband[] {
  const byMatch = new Map<string, LineupDoc>();
  officials.forEach((d) => {
    if (!d.isOfficial || !d.matchId) return;
    const prev = byMatch.get(d.matchId);
    if (!prev || (d.updatedAt ?? 0) > (prev.updatedAt ?? 0)) byMatch.set(d.matchId, d);
  });
  const out: { band: Armband; at: number }[] = [];
  byMatch.forEach((d, mid) => {
    const m = calendar.find((x) => x.id === mid);
    const cap = d.roles.captainId;
    if (m?.played && cap) out.push({ band: { id: cap, j: m.j ?? null, matchId: mid }, at: m.dateMs });
  });
  // (in calendar order: a match without a jornada still has its date)
  return out.sort((a, b) => a.at - b.at).map((x) => x.band);
}

export interface CaptainRow {
  id: string;
  /** Brazaletes worn this season. */
  n: number;
  /** The last jornada he wore it (null = never, or only in matches without a jornada). */
  last: number | null;
}

export interface CaptainPick {
  /** The suggestion (null = nobody on the pitch can wear it). */
  id: string | null;
  /** Everyone of the seven, in the order of the suggestion. */
  rows: CaptainRow[];
  /** The board already has the suggested one as captain. */
  already: boolean;
  /** Played matches whose captain is known (0 = the rotation has nothing to go on yet). */
  known: number;
}

/** Who should wear the brazalete next among the seven on the board (bajas and «no va» left out). */
export function nextCaptain(L: Lineup, sq: Squad, bands: readonly Armband[]): CaptainPick {
  const seven = L.slots.map((s) => s.playerId).filter((x): x is string => !!x && sq.byId.has(x));
  const ok = seven.filter((id) => {
    const c = sq.byId.get(id);
    return !!c && !c.baja && c.cv !== "no";
  });
  const rows: CaptainRow[] = ok.map((id) => {
    const mine = bands.filter((b) => b.id === id);
    const js = mine.flatMap((b) => (b.j == null ? [] : [b.j]));
    return { id, n: mine.length, last: js.length ? Math.max(...js) : null };
  });
  const rt = (id: string) => sq.byId.get(id)?.rt ?? 0;
  const name = (id: string) => sq.byId.get(id)?.name ?? id;
  rows.sort((a, b) => a.n - b.n || (a.last ?? -1) - (b.last ?? -1) || rt(b.id) - rt(a.id) || name(a.id).localeCompare(name(b.id), "es"));
  const id = rows[0]?.id ?? null;
  return { id, rows, already: !!id && L.roles.captainId === id, known: bands.length };
}

/** «Ninguno aún» / «1 brazalete (J5)» / «3 brazaletes (el último, J7)»; no «J…» when it isn't known. */
export function rowTxt(r: CaptainRow): string {
  if (!r.n) return "Ninguno aún";
  const when = r.last == null ? "" : r.n === 1 ? " (J" + r.last + ")" : " (el último, J" + r.last + ")";
  return (r.n === 1 ? "1 brazalete" : r.n + " brazaletes") + when;
}

/** Why him, in one line. */
export function whyTxt(p: CaptainPick, name: (id: string) => string): string {
  if (!p.id) return "Pon a tu siete en el campo y te digo a quién le toca el brazalete.";
  const r = p.rows[0];
  if (!p.known) return "Aún no hay capitanes en los oficiales de partidos jugados: empieza por " + name(p.id) + ", el de mejor forma.";
  return r.n ? "Es quien menos lo ha llevado de tu siete: " + rowTxt(r) + "." : "Del siete, nunca ha llevado el brazalete.";
}

/** The board with the suggestion as captain (as it was when he already is one). */
export const applyCaptain = (L: Lineup, id: string): Lineup => (L.roles.captainId === id ? L : toggleRole(L, "captainId", id));
