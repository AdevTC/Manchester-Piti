// r14 · la pachanga sale de las respuestas del entreno (PZ-D09): «¿Quién ha venido?» starts from who said «voy» to
// the confirmed slot of the training (trainings/{id}/votes, the vestuario's hooks), and saving the pachanga keeps
// who came at trainingAttendance/{trainingId} — that counts as attendance. A captain or whoever proposed the
// training saves it (firestore.rules trainingAttendance). Members without a ficha come as people from outside.
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { z } from "zod";
import { db } from "../../../firebase";
import { useLiveDoc, useOpenTrainings, useTrainingVotes, type Training, type TrainingVote } from "../../vestuario/live";
import { reportDroppedDoc } from "../../../lib/docTelemetry";

export const ATTENDANCE_LIMITS = { present: 40, guests: 12, guest: 40 } as const;

export interface Attendance {
  trainingId: string;
  /** The confirmed slot it was for. */
  slotId: string;
  /** Who came (ficha ids). */
  present: string[];
  /** People from outside (names). */
  guests: string[];
  by: string;
  at: number | null;
}

/** «¿Quién ha venido?» to start from: who answered «voy» to the confirmed slot — their fichas, and the names of
 *  members without one. Empty when the training has no confirmed slot. */
export function comesFromTraining(training: Pick<Training, "confirmed"> | null | undefined, votes: readonly TrainingVote[]): { present: string[]; guests: string[]; slotId: string | null } {
  const slotId = training?.confirmed?.slotId ?? null;
  if (!slotId) return { present: [], guests: [], slotId: null };
  const present: string[] = [];
  const guests: string[] = [];
  votes.forEach((v) => {
    if (!v.slotIds.includes(slotId)) return;
    if (v.playerId) {
      if (!present.includes(v.playerId)) present.push(v.playerId);
    } else if (v.name && !guests.includes(v.name)) guests.push(v.name);
  });
  return { present, guests, slotId };
}

/** The confirmed training a pachanga is for: the soonest confirmed one still to come or played in the last 12 h
 *  (null: none). `now` in ms. */
export function pachangaTraining(trainings: readonly Training[], now: number): Training | null {
  const ok = trainings.filter((t) => t.confirmed && t.confirmed.at >= now - 12 * 3_600_000);
  return ok.sort((a, b) => a.confirmed!.at - b.confirmed!.at)[0] ?? null;
}

const schema = z.object({
  slotId: z.string().min(1).max(8),
  present: z.array(z.string().min(1).max(128)).max(ATTENDANCE_LIMITS.present),
  guests: z.array(z.string().min(1).max(ATTENDANCE_LIMITS.guest)).max(ATTENDANCE_LIMITS.guests).optional(),
  by: z.string().max(128),
});
const millis = (v: unknown): number | null =>
  typeof v === "number" ? v : v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null;

export function mapAttendance(trainingId: string, data: unknown): Attendance | null {
  if (!data) return null;
  const r = schema.safeParse(data);
  if (!r.success) {
    reportDroppedDoc("trainingAttendance", trainingId, r.error.issues);
    return null;
  }
  return { trainingId, slotId: r.data.slotId, present: r.data.present, guests: r.data.guests ?? [], by: r.data.by, at: millis((data as { at?: unknown }).at) };
}

/** The pachanga's training (the next confirmed one), its «voy» and what was saved as attendance (live). */
export function usePachangaSource(now: number): { training: Training | null; comes: ReturnType<typeof comesFromTraining>; attendance: Attendance | null; loading: boolean } {
  const trainings = useOpenTrainings(now);
  const training = pachangaTraining(trainings.data ?? [], now);
  const votes = useTrainingVotes(training?.id);
  const id = training?.id ?? null;
  const att = useLiveDoc(id ? `trainingAttendance/${id}` : null, "attendance", (d) => (id && d ? mapAttendance(id, d) : null), null);
  return { training, comes: comesFromTraining(training, votes.data ?? []), attendance: id ? att.data : null, loading: trainings.loading || (!!id && (votes.loading || att.loading)) };
}

/** Saves who came (a captain or the training's proposer). Throws (Spanish) past the caps. */
export async function saveAttendance(trainingId: string, a: { slotId: string; present: readonly string[]; guests?: readonly string[]; uid: string }): Promise<void> {
  const present = [...new Set(a.present)];
  const guests = [...new Set((a.guests ?? []).map((g) => g.trim().slice(0, ATTENDANCE_LIMITS.guest)).filter(Boolean))];
  if (present.length > ATTENDANCE_LIMITS.present) throw new Error(`Como mucho ${ATTENDANCE_LIMITS.present} jugadores.`);
  if (guests.length > ATTENDANCE_LIMITS.guests) throw new Error(`Como mucho ${ATTENDANCE_LIMITS.guests} de fuera.`);
  await setDoc(doc(db, "trainingAttendance", trainingId), { slotId: a.slotId, present, guests, by: a.uid, at: serverTimestamp() });
}

export async function deleteAttendance(trainingId: string): Promise<void> {
  await deleteDoc(doc(db, "trainingAttendance", trainingId));
}
