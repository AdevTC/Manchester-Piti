// r14 · small board-level data helpers: «Ver la charla» links (PZ-D02), the copies made from la mesa and their
// clean-up (PZ-D22T), duplicating a board with its voices (PZ-D08). Firestore rules: a captain deletes any board;
// the server then deletes its voz, reactions, history and fan view (onLineupR14).
import type { LineupDoc } from "../lineupDoc";
import { deleteBoard } from "../useLineups";
import { copyVoz } from "./voz";

/** /pizarra/charla?tablero=<id>[&season=<id>] — the same link the «Ya está el siete» push opens for the season's
 *  official (functions/src/pushLogic.ts charlaUrl). The match page shows «Ver la charla» to members with the
 *  board useMatchBoard gives it. */
export function charlaHref(boardId: string, seasonId?: string | null): string {
  const season = seasonId && seasonId !== "all" ? "&season=" + encodeURIComponent(seasonId) : "";
  return "/pizarra/charla?tablero=" + encodeURIComponent(boardId) + season;
}

/** «Siete del campo · J7» (v2/mesaLogic fieldCopyName): copies made before r14 have no `fromMesa`. */
const FIELD_COPY = /^Siete del campo(\s·\s|$)/;

/** A copy made from la mesa («De la mesa» in Tableros): marked `fromMesa`, or (before r14) a scorer's
 *  «Siete del campo» bound to a match. */
export const isMesaCopy = (d: Pick<LineupDoc, "fromMesa" | "name" | "matchId">): boolean => d.fromMesa === true || (!!d.matchId && FIELD_COPY.test(d.name));

/** The copies «Borrar las copias de la mesa» deletes: mesa copies that are not official, of matches already played
 *  (`played(matchId)`). */
export const mesaCopiesToClean = (boards: readonly LineupDoc[], played: (matchId: string) => boolean): LineupDoc[] =>
  boards.filter((b) => isMesaCopy(b) && !b.isOfficial && !!b.matchId && played(b.matchId));

/** Deletes them (captains: the rules let a captain delete anyone's board). Returns the ids that could not go. */
export async function deleteMesaCopies(ids: readonly string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await deleteBoard(id);
    } catch (err) {
      console.error("No se pudo borrar la copia de la mesa", id, err);
      failed.push(id);
    }
  }
  return failed;
}

/** After duplicating board `from` into `to` (useLineups.create), copy its voices too. Never throws: returns how many
 *  voices were copied, or null when they could not be (say «La voz no se ha copiado»). */
export async function copyBoardVoices(from: string, to: string, uid: string): Promise<number | null> {
  try {
    return await copyVoz(from, to, uid);
  } catch (err) {
    console.error("No se pudo copiar la voz del tablero", err);
    return null;
  }
}
