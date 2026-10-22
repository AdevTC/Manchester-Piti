// «Vidrio» · the changes of a match by player (F7: rolling substitutions, a player goes in and out several times).
// From the acta's ledger once it is out (its stints), else walked from the plays that stand up to the minute
// given (live) or the end. Pure: the pitch shows each player's minutes from it, and the grown list his stints
// («0′–10′, 18′–35′»). Shared by Inicio's siete, the match page's «Ahora en el campo» and the percha.
import type { ClubMatch, MatchEvent } from "../../clubData";
import { calculateLedger } from "../../../../functions/src/matchEngine";
import { settled } from "../../eventMeta";
import { withGuestNames } from "../guests";

export interface Stint {
  from: number;
  to: number;
}

export interface RotationRow {
  id: string;
  name: string;
  /** Whole minutes on the pitch. */
  minutes: number;
  stints: Stint[];
  /** «0′–10′, 18′–35′». */
  text: string;
  /** For a screen reader: «Del minuto 0 al 10 y del 18 al 35». */
  label: string;
  /** He went in or out at least once. */
  changed: boolean;
}

export interface Rotation {
  /** How many substitutions stand. */
  changes: number;
  /** Everyone who played, grouped by player: the ones who changed first (by when they first stood on the pitch),
   *  then the ones who played throughout. */
  rows: RotationRow[];
  /** Minutes by player (everyone who played). */
  minutes: Map<string, number>;
}

/** A stint's edge as the plays say a minute: 0 at the kick-off, else the minute it happened in (18.2 → 19). */
export const edgeMinute = (m: number): number => (m <= 0 ? 0 : Math.max(1, Math.ceil(m - 1e-6)));

/** «0′–10′, 18′–35′»; a stint inside one minute (in at 49:40, the whistle at 50) is that minute alone, «50′». */
export function stintsText(stints: readonly Stint[]): string {
  return stints.map((s) => (edgeMinute(s.from) === edgeMinute(s.to) ? `${edgeMinute(s.to)}′` : `${edgeMinute(s.from)}′–${edgeMinute(s.to)}′`)).join(", ");
}

/** «Del minuto 0 al 10 y del 18 al 35» («y en el 50» for a stint inside one minute). */
export function stintsLabel(stints: readonly Stint[]): string {
  const parts = stints.map((s, i) => (edgeMinute(s.from) === edgeMinute(s.to) ? `${i === 0 ? "en el minuto" : "en el"} ${edgeMinute(s.to)}` : `${i === 0 ? "del minuto" : "del"} ${edgeMinute(s.from)} al ${edgeMinute(s.to)}`));
  if (!parts.length) return "";
  const line = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : parts[0];
  return line.charAt(0).toLocaleUpperCase("es") + line.slice(1);
}

/** «21 cambios», «1 cambio». */
export const changesWord = (n: number): string => `${n} ${n === 1 ? "cambio" : "cambios"}`;

/** «35 min». */
export const minutesText = (n: number): string => `${n} min`;

/** The changes of `match` up to `until` minutes (undefined: the whole match). `events`: the plays that stand so far. */
export function rotationOf(match: Pick<ClubMatch, "starters" | "bench" | "notCalled" | "duration" | "status" | "ledger" | "guests">, events: readonly MatchEvent[], nameOf: (id: string) => string, until?: number): Rotation {
  const name = withGuestNames(match, nameOf);
  const list = settled([...events]);
  const changes = list.filter((e) => e.type === "substitution" && e.inPlayerId && e.playerId).length;
  // (the published acta's ledger when the whole match is asked for — one saved before stints existed walks its
  // plays instead —; otherwise the plays, walked to `until`)
  const ledger = until === undefined && match.status === "finished" && match.ledger && Object.values(match.ledger).some((p) => p.played) && Object.values(match.ledger).every((p) => !p.played || Array.isArray(p.stints)) ? match.ledger : null;
  let players: Record<string, { played: boolean; minutes: number; stints: Stint[]; subIn: number; subOut: number }>;
  if (ledger) players = ledger;
  else {
    const lastMinute = Math.max(0, ...list.map((e) => e.minute ?? 0));
    const duration = Math.max(match.duration ?? 50, lastMinute, Math.ceil(until ?? 0));
    const starters = match.starters ?? [];
    // (anyone a play names who isn't in the convocatoria still counts: an old acta, a guest)
    const known = new Set([...starters, ...(match.bench ?? []), ...(match.notCalled ?? [])]);
    const extra = [...new Set(list.flatMap((e) => [e.playerId, e.inPlayerId]).filter((id): id is string => !!id && !known.has(id)))];
    players = calculateLedger(
      { starters, bench: [...(match.bench ?? []), ...extra], notCalled: match.notCalled ?? [], events: list as MatchEvent[], duration, guests: match.guests },
      false,
      { until: until ?? duration, allowUnattributedGoals: true },
    ).players;
  }
  const rows: RotationRow[] = Object.entries(players)
    .filter(([, p]) => p.played && (p.stints?.length ?? 0) > 0)
    .map(([id, p]) => {
      const stints = p.stints.map((s) => ({ from: s.from, to: s.to }));
      const minutes = Math.round(stints.reduce((t, s) => t + (s.to - s.from), 0));
      return { id, name: name(id), minutes, stints, text: stintsText(stints), label: stintsLabel(stints), changed: p.subIn + p.subOut > 0 };
    })
    .sort((a, b) => Number(b.changed) - Number(a.changed) || a.stints[0].from - b.stints[0].from || b.minutes - a.minutes || a.name.localeCompare(b.name, "es"));
  return { changes, rows, minutes: new Map(rows.map((r) => [r.id, r.minutes])) };
}
