// Ausencias («no puedo del 12 al 19») on the web: the same rules as the backend (functions/src/
// absencesLogic.ts, re-exported here), plus what the vestuario writes and shows. A member writes
// absences/{id} = absenceFields(…) + `createdAt: serverTimestamp()` (addDoc); the backend then answers
// «No puedo» on the matches in those dates. No edits: «Quitar» deletes it (the captains can delete any).
export {
  ABSENCE_MAX_DAYS,
  ABSENCE_NOTE_MAX,
  ABSENCE_SOURCE,
  absenceAvailabilityPlan,
  absenceDays,
  absenceRangeProblem,
  absenceRangeText,
  absenceUntilText,
  answerable,
  byAbsence,
  covers,
  isDay,
  madridDate,
  matchesInRange,
  parseAbsence,
  type Absence,
  type AbsencePlan,
  type AvailabilityLike,
  type AvailabilityWrite,
  type ExistingAnswer,
  type MatchSlot,
} from "../../../functions/src/absencesLogic";
import { ABSENCE_NOTE_MAX, covers, type Absence } from "../../../functions/src/absencesLogic";

/** Who writes it: the member as the rules check them (users/{uid}: nickname and linked ficha). */
export interface AbsenceAuthor {
  uid: string;
  name: string;
  playerId: string | null;
}

/** The absences doc fields (all but createdAt, the server's time, added by the writer), as firestore.rules
 *  validates them: the note only when there is one (trimmed, at most ABSENCE_NOTE_MAX). */
export function absenceFields(me: AbsenceAuthor, from: string, to: string, note = "") {
  const clean = note.trim().slice(0, ABSENCE_NOTE_MAX);
  return { uid: me.uid, playerId: me.playerId, name: me.name, from, to, ...(clean ? { note: clean } : {}) };
}

/** The absences still to come or under way on `today` (`YYYY-MM-DD`), soonest first. */
export const currentAbsences = (absences: readonly Absence[], today: string): Absence[] =>
  absences.filter((a) => a.to >= today).sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.to < b.to ? -1 : a.to > b.to ? 1 : 0));

/** The absence that covers `day` for this member (by uid) or this ficha (by playerId), the one that ends
 *  last when several do; null when none. For the «Ausente · hasta 19 oct» badges. */
export function absenceOn(absences: readonly Absence[], who: { uid?: string | null; playerId?: string | null }, day: string): Absence | null {
  let best: Absence | null = null;
  for (const a of absences) {
    const mine = (!!who.uid && a.uid === who.uid) || (!!who.playerId && a.playerId === who.playerId);
    if (mine && covers(a, day) && (!best || a.to > best.to)) best = a;
  }
  return best;
}
