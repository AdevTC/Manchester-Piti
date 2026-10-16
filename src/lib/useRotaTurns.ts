// Turnos del equipo: whose turn it is in a match, for members (the Hoy card, the vestuario, the match's
// Vestuario tab, the admin's Convocar). Live: the season's rota (rotas/{seasonId}), the match's overrides
// (rotaTurns/{matchId}), its convocatoria answers and the current absences. Read once (cached): the answers
// of the season's completed matches before it and every absence — the history the rota walks, the same the
// server reads for the «Te toca…» notice. Nothing is read without a rota with jobs (or for a fan).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { dateMillis, type ClubMatch } from "./clubData";
import { parseRota, parseRotaTurns, rotaHistory, rotaMatch, turnsFor, type Rota, type RotaAbsence, type RotaAnswer, type RotaTurnsDoc, type Turn } from "./derived/rota";
import { madridDate } from "./derived/madrid";
import { useAbsences, useAvailability, useLiveDoc } from "../pages/vestuario/live";

const EMPTY_TURNS: RotaTurnsDoc = {};
const NO_TURNS: Turn[] = [];

/** The season's rota (null: none yet). `enabled` false (a fan) opens nothing. */
export function useRota(seasonId: string | undefined, enabled = true) {
  return useLiveDoc<Rota | null>(enabled && seasonId ? `rotas/${seasonId}` : null, "rota", (d) => (d ? parseRota(d) : null), null);
}
/** A match's overrides ({} without any). */
export function useRotaPins(matchId: string | undefined, enabled = true) {
  return useLiveDoc<RotaTurnsDoc>(enabled && matchId ? `rotaTurns/${matchId}` : null, "rotaTurns", parseRotaTurns, EMPTY_TURNS);
}

interface History {
  availability: Record<string, RotaAnswer[]>;
  absences: RotaAbsence[];
}
async function loadHistory(matchIds: readonly string[]): Promise<History> {
  const availability: Record<string, RotaAnswer[]> = {};
  await Promise.all(
    matchIds.map(async (id) => {
      const s = await getDocs(collection(db, "matchPrivate", id, "availability"));
      availability[id] = s.docs.map((d) => ({ playerId: (d.get("playerId") as string | null | undefined) ?? null, response: d.get("response") }));
    }),
  );
  const abs = await getDocs(collection(db, "absences"));
  const absences = abs.docs.map((d) => ({ playerId: (d.get("playerId") as string | null | undefined) ?? null, from: String(d.get("from") ?? ""), to: String(d.get("to") ?? "") }));
  return { availability, absences };
}

/**
 * The turns of `match` (empty while loading, without a rota, or for a fan). `matches`: the club's (the
 * season's completed ones before it count). Also the rota and the overrides, for the admin's panel.
 */
export function useMatchTurns(match: ClubMatch | undefined, matches: readonly ClubMatch[], enabled: boolean) {
  const rota = useRota(match?.seasonId, enabled && !!match);
  const on = enabled && !!match && !!rota.data?.jobs.length;
  const pins = useRotaPins(match?.id, on);
  const live = useAvailability(on ? match?.id : undefined);
  // (the absences that reach the match's own Madrid day: only those can cover it; none without a date)
  const kickoff = match ? dateMillis(match.date) : NaN;
  const absences = useAbsences(Number.isFinite(kickoff) ? madridDate(kickoff) : "", on);
  const all = useMemo(() => matches.map(rotaMatch), [matches]);
  const past = useMemo(() => (match ? rotaHistory(rotaMatch(match), all).map((m) => m.id) : []), [match, all]);
  const history = useQuery({
    queryKey: ["rotaHistory", match?.seasonId ?? "", past.join(",")],
    queryFn: () => loadHistory(past),
    enabled: on,
    staleTime: 10 * 60_000,
  });
  const turns = useMemo(() => {
    if (!on || !match || !history.data) return NO_TURNS;
    const availability = { ...history.data.availability, [match.id]: live.data.map((a) => ({ playerId: a.playerId, response: a.response })) };
    const seen = new Set(history.data.absences.map((a) => `${a.playerId}|${a.from}|${a.to}`));
    const absencesAll = [...history.data.absences, ...absences.data.filter((a) => !seen.has(`${a.playerId}|${a.from}|${a.to}`))];
    return turnsFor(rotaMatch(match), rota.data, all, availability, absencesAll, pins.data);
  }, [on, match, history.data, live.data, absences.data, rota.data, all, pins.data]);
  return { turns, rota: rota.data, pins: pins.data, loading: rota.loading || (on && (history.isPending || pins.loading)), error: rota.error || pins.error || history.isError };
}
