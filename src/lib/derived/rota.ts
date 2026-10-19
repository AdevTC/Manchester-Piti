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
import type { RotaMatch } from "../../../functions/src/rotaLogic";

/** A club match as the rota reads it. */
export const rotaMatch = (m: Pick<ClubMatch, "id" | "date" | "home" | "status" | "seasonId">): RotaMatch => {
  const t = dateMillis(m.date);
  return { id: m.id, date: Number.isFinite(t) ? t : null, home: m.home, status: m.status, seasonId: m.seasonId };
};
