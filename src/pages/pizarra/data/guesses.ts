// r14 · «Adivina el siete» (PZ-D04): before a match's official seven is out, each player (a member with a ficha)
// keeps his guess at matchPrivate/{matchId}/guesses/{uid} — seven player ids, keeper first — and may change or
// delete it. Once the official is out (its lineupOfficials/{season}__{match} doc exists) nobody can touch them,
// the team can read them all, and each one sees «Acertaste N de 7» (counted here, against the official seven).
// firestore.rules: matchPrivate/{id}/guesses/{uid}.
import { useMemo } from "react";
import { collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useFirestoreCollection } from "../../../lib/useFirestoreCollection";
import { useLiveDoc } from "../../vestuario/live";
import { reportDroppedDoc } from "../../../lib/docTelemetry";
import { guessHits } from "../../../../functions/src/pizarraR14Logic";

export { guessHits };

export interface SieteGuess {
  /** The member's uid (the doc id). */
  uid: string;
  /** Seven player ids, keeper first. */
  slots: string[];
  at: number | null;
}

const schema = z.object({ slots: z.array(z.string().min(1).max(128)).length(7) });
const millis = (v: unknown): number | null =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null;

export function mapGuess(uid: string, data: unknown): SieteGuess | null {
  const r = schema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("matchPrivate.guesses", uid, r.error.issues);
    return null;
  }
  return { uid, slots: r.data.slots, at: millis((data as { at?: unknown }).at) };
}
const mapOne = (d: Record<string, unknown> | undefined): SieteGuess | null => (d ? mapGuess("me", d) : null);

/** The guess as written (a seven with an empty slot, or someone twice, can't be a guess: Spanish error). */
export function guessWrite(slots: readonly (string | null)[]): { slots: string[]; at: unknown } {
  const ids = slots.filter((x): x is string => typeof x === "string" && x.length > 0);
  if (ids.length !== 7) throw new Error("Pon a los siete para apostar.");
  if (new Set(ids).size !== 7) throw new Error("Hay alguien dos veces en tu siete.");
  return { slots: ids, at: serverTimestamp() };
}

/** Your guess for the match (live; null = none). `uid` null or no match: nothing is read. */
export function useMyGuess(matchId: string | null, uid: string | null): { guess: SieteGuess | null; loading: boolean } {
  const path = matchId && uid ? `matchPrivate/${matchId}/guesses/${uid}` : null;
  const live = useLiveDoc(path, "guess", mapOne, null);
  const g = live.data ? { ...live.data, uid: uid ?? "" } : null;
  return { guess: path ? g : null, loading: !!path && live.loading };
}

/** Everyone's guesses: readable only once the official is out (`out` true), else nothing is read. */
export function useGuesses(matchId: string | null, out: boolean): { guesses: SieteGuess[]; loading: boolean } {
  const on = !!matchId && out;
  const q = useMemo(() => collection(db, "matchPrivate", matchId ?? "-", "guesses"), [matchId]);
  const key = useMemo(() => ["sieteGuesses", matchId ?? "-"], [matchId]);
  const { data, isPending } = useFirestoreCollection(key, q, mapGuess, on);
  return { guesses: on ? (data ?? []) : [], loading: on && isPending };
}

/** Saves (or replaces) your guess. Rejects (rules) once the official is out or the match has started. */
export async function saveGuess(matchId: string, uid: string, slots: readonly (string | null)[]): Promise<void> {
  await setDoc(doc(db, "matchPrivate", matchId, "guesses", uid), guessWrite(slots));
}

/** Takes your guess back (while the official isn't out). */
export async function deleteGuess(matchId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, "matchPrivate", matchId, "guesses", uid));
}

/** «Acertaste 5 de 7» / «Acertaste los 7»; with the exact slots when any. */
export function guessLine(h: { hits: number; exact: number }): string {
  const base = h.hits === 7 ? "Acertaste los 7" : `Acertaste ${h.hits} de 7`;
  return h.exact > 0 ? `${base} · ${h.exact} en su sitio` : base;
}
