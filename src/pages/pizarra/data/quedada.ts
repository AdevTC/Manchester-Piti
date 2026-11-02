// r14 · la hora y el sitio de quedar (PZ-D03): quedadas/{matchId} = { at, where, note?, by, setAt }. The team
// reads it (Partido «Antes», the charla's «La quedada» step, Hoy); a captain writes it while the match is active
// (firestore.rules quedadas). Kept apart from the match doc: the match is public and written only by the backend.
import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useLiveDoc } from "../../vestuario/live";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const QUEDADA_LIMITS = { where: 80, note: 140 } as const;

export interface Quedada {
  matchId: string;
  /** When (ms). */
  at: number;
  /** «Puerta del campo». */
  where: string;
  note: string;
  by: string;
}

const schema = z.object({ where: z.string().min(1).max(QUEDADA_LIMITS.where), note: z.string().max(QUEDADA_LIMITS.note).optional(), by: z.string().max(128) });
const millis = (v: unknown): number | null =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null;

export function mapQuedada(matchId: string, data: unknown): Quedada | null {
  if (!data) return null;
  const r = schema.safeParse(data);
  const at = millis((data as { at?: unknown }).at);
  if (!r.success || at === null) {
    reportDroppedDoc("quedadas", matchId, r.success ? [] : r.error.issues);
    return null;
  }
  return { matchId, at, where: r.data.where, note: r.data.note ?? "", by: r.data.by };
}

/** The match's quedada (live; null = none yet). Team-member reads: a fan passes `enabled` false. */
export function useQuedada(matchId: string | null, enabled = true): { quedada: Quedada | null; loading: boolean } {
  const path = enabled && matchId ? `quedadas/${matchId}` : null;
  const live = useLiveDoc(path, "quedada", (d) => (matchId && d ? mapQuedada(matchId, d) : null), null);
  return { quedada: path ? live.data : null, loading: !!path && live.loading };
}

/** What is wrong with a quedada (Spanish), or null. `kickoff` (ms) when known: meeting after it makes no sense. */
export function quedadaError(q: { at: number; where: string }, kickoff?: number | null): string | null {
  if (!Number.isFinite(q.at)) return "Elige la hora.";
  const w = q.where.trim();
  if (!w) return "Di dónde quedáis.";
  if (w.length > QUEDADA_LIMITS.where) return `El sitio cabe en ${QUEDADA_LIMITS.where} letras.`;
  if (kickoff != null && q.at > kickoff) return "La quedada tiene que ser antes del partido.";
  return null;
}

/** Saves the quedada (captains). Throws (Spanish) when it isn't valid. */
export async function saveQuedada(matchId: string, q: { at: number; where: string; note?: string; uid: string }, kickoff?: number | null): Promise<void> {
  const bad = quedadaError(q, kickoff);
  if (bad) throw new Error(bad);
  const note = (q.note ?? "").trim().slice(0, QUEDADA_LIMITS.note);
  await setDoc(doc(db, "quedadas", matchId), { at: Timestamp.fromMillis(q.at), where: q.where.trim(), ...(note ? { note } : {}), by: q.uid, setAt: serverTimestamp() });
}

export async function deleteQuedada(matchId: string): Promise<void> {
  await deleteDoc(doc(db, "quedadas", matchId));
}
