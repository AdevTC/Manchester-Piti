// Turnos del equipo: whose turn it is in a match, for members (the Hoy card, the vestuario, the match's
// Vestuario tab, the admin's Convocar). All live and small: the season's rota (rotas/{seasonId}), the
// season's rotaTurns (one query, ≤ one doc per match: the frozen history and the captains' pins), and for
// the match shown only, its convocatoria answers and the absences that reach its day. Never the history's
// answers nor the whole absences collection. Nothing is read without a rota with jobs (or for a fan).
import { useMemo } from "react";
import { useClock } from "../hooks/useClock";
import { dateMillis, type ClubMatch } from "./clubData";
import { NO_ROTA_TURNS, parseRota, rotaHistory, rotaMatch, turnsFor, type Rota, type RotaTurnsDoc, type Turn } from "./derived/rota";
import { madridDate } from "./derived/madrid";
import { useAbsences, useAvailability, useLiveDoc, useSeasonRotaTurns } from "../pages/vestuario/live";

const NO_TURNS: Turn[] = [];

/** The season's rota (null: none yet). `enabled` false (a fan) opens nothing. */
export function useRota(seasonId: string | undefined, enabled = true) {
  return useLiveDoc<Rota | null>(enabled && seasonId ? `rotas/${seasonId}` : null, "rota", (d) => (d ? parseRota(d) : null), null);
}

/**
 * The turns of `match` (empty while loading, without a rota, or for a fan). `matches`: the club's (the
 * season's played ones before it are the history). Also the rota and the match's rotaTurns, for the admin.
 */
export function useMatchTurns(match: ClubMatch | undefined, matches: readonly ClubMatch[], enabled: boolean) {
  const rota = useRota(match?.seasonId, enabled && !!match);
  const on = enabled && !!match && !!rota.data?.jobs.length;
  const docs = useSeasonRotaTurns(match?.seasonId, on);
  const live = useAvailability(on ? match?.id : undefined);
  // (the absences that reach the match's own Madrid day: only those can cover it; none without a date)
  const kickoff = match ? dateMillis(match.date) : NaN;
  const absences = useAbsences(Number.isFinite(kickoff) ? madridDate(kickoff) : "", on);
  // (a minute clock: a match whose date passes moves the next turn)
  const now = useClock(60_000);
  const all = useMemo(() => matches.map(rotaMatch), [matches]);
  const byId = useMemo(() => Object.fromEntries(docs.data.map((d) => [d.id, d.doc])) as Record<string, RotaTurnsDoc | undefined>, [docs.data]);
  const pins: RotaTurnsDoc = (match && byId[match.id]) || NO_ROTA_TURNS;
  const turns = useMemo(() => {
    if (!on || !match || docs.loading) return NO_TURNS;
    const m = rotaMatch(match);
    const history = rotaHistory(m, all, byId, rota.data, now);
    return turnsFor(m, rota.data, history, live.data, absences.data, byId[match.id]);
  }, [on, match, docs.loading, all, byId, rota.data, now, live.data, absences.data]);
  return { turns, rota: rota.data, pins, loading: rota.loading || (on && docs.loading), error: rota.error || (on && docs.error) };
}
