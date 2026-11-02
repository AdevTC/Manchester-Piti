// r14 · la vista de la afición (PZ-D21F): a public, read-only page with a board's cartel and seven by link,
// without full names or notas. The server builds a sanitized snapshot at fanBoards/{token}
// (functions/src/pizarraR14.ts: shirt names and dorsales, the sistema, the captain, the match, the rival's system
// and dorsales when shown, the plan's keys — never full names, notas, notes, reactions or owners) and keeps it in
// step with the board. setBoardFanLink (lib/clubApi) turns it on/off/rotates it (the board's owner or a captain).
// Anyone with the token reads it — no account — and only while the board still carries that token (rules).
import { doc, getDoc } from "firebase/firestore";
import { useQuery } from "@tanstack/react-query";
import { db } from "../../../firebase";
import type { FanBoard } from "../../../../functions/src/pizarraR14Logic";

export type { FanBoard, FanPlayer } from "../../../../functions/src/pizarraR14Logic";

/** The public page's path (a route outside /pizarra: no account needed). BASE owns the route; this is the
 *  agreed address. */
export const fanPath = (token: string): string => "/aficion/" + encodeURIComponent(token);
export const FAN_TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

/** The snapshot as read (shape-checked: anything else reads as «this link no longer works»). */
export function parseFanBoard(d: unknown): FanBoard | null {
  if (!d || typeof d !== "object") return null;
  const x = d as Partial<FanBoard>;
  if (x.v !== 1 || !Array.isArray(x.seven) || typeof x.system !== "string" || typeof x.title !== "string") return null;
  return x as FanBoard;
}

/** Reads a fan board once (null: no such link, revoked, rotated or its board deleted). */
export async function readFanBoard(token: string): Promise<FanBoard | null> {
  if (!FAN_TOKEN_RE.test(token)) return null;
  try {
    const s = await getDoc(doc(db, "fanBoards", token));
    return s.exists() ? parseFanBoard(s.data()) : null;
  } catch (err) {
    // (a revoked link whose stale doc is still there answers permission-denied: the same «ya no funciona»)
    if ((err as { code?: unknown } | null)?.code === "permission-denied") return null;
    throw err;
  }
}

/** The fan page's data (react-query; refetched on focus). */
export function useFanBoard(token: string | null) {
  return useQuery({ queryKey: ["fanBoard", token], queryFn: () => readFanBoard(token ?? ""), enabled: !!token, staleTime: 60_000 });
}
