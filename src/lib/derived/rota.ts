// Turnos del equipo on the web: the pure rules are the backend's (functions/src/rotaLogic.ts, re-exported
// here so the «Te toca…» notice and every page agree on whose turn it is).
export {
  DEFAULT_JOBS,
  NO_ROTA_TURNS,
  handoverTurns,
  ROTA_ICONS,
  ROTA_ICON_LABEL,
  ROTA_LIMITS,
  jobApplies,
  jobIdFor,
  jobShort,
  jobTask,
  matchDayText,
  myTurns,
  outOf,
  turnDone,
  doneKeyOf,
  parseRota,
  parseRotaTurns,
  playedEntry,
  playedTurns,
  rotaErrors,
  rotaHistory,
  rotaNotice,
  rotaPast,
  rotaPlayed,
  turnsFor,
  turnsLine,
  type PinnedTurn,
  type PlayedTurns,
  type Rota,
  type RotaAbsence,
  type RotaAnswer,
  type RotaIconId,
  type RotaJob,
  type RotaMatch,
  type RotaTurnsDoc,
  type Turn,
} from "../../../functions/src/rotaLogic";
import { dateMillis } from "../../../functions/src/matchEngine";
import type { ClubMatch } from "../clubData";
import { playedTurns, rotaHistory, turnsFor, type Rota, type RotaAbsence, type RotaMatch, type RotaTurnsDoc, type Turn } from "../../../functions/src/rotaLogic";

/** A club match as the rota reads it. */
export const rotaMatch = (m: Pick<ClubMatch, "id" | "date" | "home" | "status" | "seasonId">): RotaMatch => {
  const t = dateMillis(m.date);
  return { id: m.id, date: Number.isFinite(t) ? t : null, home: m.home, status: m.status, seasonId: m.seasonId };
};

/**
 * The turns of `matches` (the season's next ones, in date order), each one over the played history plus the ones
 * before it as projected (their pins kept) — the way the backend will freeze them one after another, as long as
 * nothing changes: the vestuario's «La rueda» and the Sala de control's «A quién le toca». `first`: the first
 * match's turns when the caller already has them (with that match's answers); `absences`: the ones known today.
 */
export function rotaSchedule(
  matches: readonly RotaMatch[],
  rota: Rota,
  docs: Readonly<Record<string, RotaTurnsDoc | undefined>>,
  all: readonly RotaMatch[],
  now: number,
  o: { first?: readonly Turn[]; absences?: readonly RotaAbsence[] } = {},
): { m: RotaMatch; turns: readonly Turn[] }[] {
  if (!matches.length) return [];
  const history = rotaHistory(matches[0], all, docs, rota, now);
  return matches.map((m, i) => {
    const turns = i === 0 && o.first ? o.first : turnsFor(m, rota, history, [], o.absences ?? [], docs[m.id]);
    history.push({ id: m.id, turns: playedTurns(turns) });
    return { m, turns };
  });
}
