// La pizarra oficial de un partido, con el admin SDK: la usan saveMatchSheet y el relleno de actas
// antiguas (functions/scripts/backfill-positions-played.mjs), así no pueden divergir. Solo la oficial
// del partido cuenta («lineups con matchId + oficial»): la oficial de temporada nunca.
// Sin common.js a propósito: el script la importa compilada y no debe inicializar la app de funciones.
import type { BoardLike } from "./boardCodes.js";

interface Snap {
  id: string;
  exists: boolean;
  get(field: string): unknown;
  data(): Record<string, unknown> | undefined;
  updateTime?: { toMillis(): number };
}
interface Query {
  where(field: string, op: "==", value: unknown): Query;
  get(): Promise<{ docs: Snap[] }>;
}
/** The slice of a Firestore (admin SDK) the lookup uses. */
export interface BoardDb {
  doc(path: string): { get(): Promise<Snap> };
  collection(path: string): Query;
}

export interface OfficialBoard {
  id: string;
  board: BoardLike;
}

/** A document id the lookup will put in a path: letters, digits, «_» and «-» (no «/», never empty). */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const updatedMs = (s: Snap): number => {
  const v = s.get("updatedAt");
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis(): number }).toMillis();
  return -Infinity;
};
/** Newest first: `updatedAt` descending, then the id (ascending) so a tie always picks the same board. */
const newer = (a: Snap, b: Snap): boolean => {
  const ta = updatedMs(a);
  const tb = updatedMs(b);
  return ta !== tb ? ta > tb : a.id < b.id;
};

/**
 * The official board bound to this match: the one `lineupOfficials/{seasonId}__{matchId}` names when
 * that board is still official for the same season and match; otherwise the newest `lineups` doc with
 * this season, `isOfficial` and this `matchId`. Null when there is none. An id that can't go in a path
 * is skipped and reported through `onInvalidId` (what it is, the id). Read errors propagate.
 */
export async function findOfficialBoard(
  db: BoardDb,
  seasonId: string,
  matchId: string,
  opts: { onInvalidId?: (what: "temporada" | "partido" | "pizarra", id: string) => void } = {},
): Promise<OfficialBoard | null> {
  if (!SAFE_ID.test(seasonId)) {
    opts.onInvalidId?.("temporada", seasonId);
    return null;
  }
  if (!SAFE_ID.test(matchId)) {
    opts.onInvalidId?.("partido", matchId);
    return null;
  }
  const lock = await db.doc(`lineupOfficials/${seasonId}__${matchId}`).get();
  const lineupId = lock.exists ? lock.get("lineupId") : null;
  if (typeof lineupId === "string" && !SAFE_ID.test(lineupId)) opts.onInvalidId?.("pizarra", lineupId);
  else if (typeof lineupId === "string") {
    const snap = await db.doc(`lineups/${lineupId}`).get();
    const data = snap.data();
    if (snap.exists && data && snap.get("isOfficial") === true && snap.get("matchId") === matchId && snap.get("seasonId") === seasonId)
      return { id: snap.id, board: data as BoardLike };
  }
  // Only equality filters: served by the single-field indexes, no composite one needed.
  const q = await db.collection("lineups").where("seasonId", "==", seasonId).where("isOfficial", "==", true).where("matchId", "==", matchId).get();
  let best: Snap | null = null;
  for (const s of q.docs) if (!best || newer(s, best)) best = s;
  const data = best?.data();
  return best && data ? { id: best.id, board: data as BoardLike } : null;
}
