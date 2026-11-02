// r14 · Jugadas de la temporada (PZ-D05): a play kept outside any board (seasonPlays/{id}), so «la de la J2 sirve
// para la J3 sin copiar el tablero entero». `scope` «mine» = the member's own («Tuyas», ≤ 12 by the client), for
// all his boards; «team» = the team's library («Del equipo»: captains write it). A board names the season plays it
// uses in `seasonPlays` (ids, ≤ 24): adding one there «moves» it onto the board without copying it; editing it
// edits it everywhere. The play itself has the board play's shape (lib/schemas playSchema, with its video and
// its acta moment). firestore.rules: seasonPlays, boardR14Ok.
import { useMemo } from "react";
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { playSchema, type Play } from "../../../lib/schemas";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { playToData } from "../plays";
export { parseSeasonPlayRefs, SEASON_PLAY_LIMITS, withSeasonPlay } from "./seasonPlayRefs";

export const SEASON_PLAY_SCOPES = ["mine", "team"] as const;
export type SeasonPlayScope = (typeof SEASON_PLAY_SCOPES)[number];

export interface SeasonPlay {
  id: string;
  seasonId: string;
  ownerUid: string;
  ownerNickname: string;
  scope: SeasonPlayScope;
  play: Play;
  createdAt: number | null;
  updatedAt: number | null;
}

const millis = (v: unknown): number | null =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null;

const docSchema = z.object({
  seasonId: z.string().min(1).max(128),
  ownerUid: z.string().min(1).max(128),
  ownerNickname: z.string().max(40).catch(""),
  scope: z.enum(SEASON_PLAY_SCOPES),
  play: playSchema,
});

/** One seasonPlays doc, or null (reported) when it is not one. The play's id is the doc's. */
export function mapSeasonPlay(id: string, data: unknown): SeasonPlay | null {
  const r = docSchema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("seasonPlays", id, r.error.issues);
    return null;
  }
  const d = data as { createdAt?: unknown; updatedAt?: unknown };
  return { id, ...r.data, play: { ...r.data.play, id }, createdAt: millis(d.createdAt), updatedAt: millis(d.updatedAt) };
}

/** The season's plays: «Del equipo» and everyone's «Tuyas» (the team reads them all; the UI shows yours). */
export function useSeasonPlays(seasonId: string | null, enabled = true): { plays: SeasonPlay[]; team: SeasonPlay[]; mine: (uid: string) => SeasonPlay[]; loading: boolean; error: boolean } {
  const on = enabled && !!seasonId && seasonId !== "all";
  const q = useMemo(() => query(collection(db, "seasonPlays"), where("seasonId", "==", seasonId ?? "-")), [seasonId]);
  const key = useMemo(() => ["seasonPlays", seasonId ?? "-"], [seasonId]);
  const { data, isPending, error } = useFirestoreCollection(key, q, mapSeasonPlay, on);
  const plays = useMemo(() => (on ? (data ?? []) : []), [on, data]);
  return {
    plays,
    team: plays.filter((p) => p.scope === "team"),
    mine: (uid: string) => plays.filter((p) => p.scope === "mine" && p.ownerUid === uid),
    loading: on && isPending,
    error: on && !!error,
  };
}

/** The plays a board uses, in its order (a ref whose play is gone is skipped: `missing` names it). */
export function boardSeasonPlays(refs: readonly string[] | undefined, all: readonly SeasonPlay[]): { plays: SeasonPlay[]; missing: string[] } {
  const by = new Map(all.map((p) => [p.id, p]));
  const plays: SeasonPlay[] = [];
  const missing: string[] = [];
  (refs ?? []).forEach((id) => {
    const p = by.get(id);
    if (p) plays.push(p);
    else missing.push(id);
  });
  return { plays, missing };
}

/** Keeps a play for the season (yours, or the team's: captains). Returns its id (= the play's new id). */
export async function createSeasonPlay(o: { seasonId: string; uid: string; nickname: string; scope: SeasonPlayScope; play: Play }): Promise<string> {
  const r = playSchema.safeParse(o.play);
  if (!r.success) throw new Error("La jugada no es válida.");
  const ref = await addDoc(collection(db, "seasonPlays"), {
    seasonId: o.seasonId,
    ownerUid: o.uid,
    ownerNickname: o.nickname,
    scope: o.scope,
    play: playToData(o.play),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Saves a season play's new version (its owner, or a captain). `scope` may change («Pasar al equipo»: captains). */
export async function updateSeasonPlay(id: string, play: Play, scope?: SeasonPlayScope): Promise<void> {
  if (!playSchema.safeParse(play).success) throw new Error("La jugada no es válida.");
  await updateDoc(doc(db, "seasonPlays", id), { play: playToData({ ...play, id }), ...(scope ? { scope } : {}), updatedAt: serverTimestamp() });
}

/** Deletes it (its owner, or a captain). The boards that named it skip it from then on. */
export async function deleteSeasonPlay(id: string): Promise<void> {
  await deleteDoc(doc(db, "seasonPlays", id));
}
