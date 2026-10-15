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
import {
  ABSENCE_MAX_DAYS,
  ABSENCE_NOTE_MAX,
  absenceDays,
  absenceUntilText,
  covers,
  isDay,
  madridDate,
  matchesInRange,
  type Absence,
  type MatchSlot,
} from "../../../functions/src/absencesLogic";

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

// ── The vestuario's form and the «Ausente» badges ──

/**
 * Why the «Mis ausencias» form can't save this range (null = it can), in the words the member reads.
 * `today` is the Madrid date (madridDate(now)): a range that ended before it answers nothing, so it is
 * refused here (the rules can't know the Madrid «today»). One already under way is fine.
 */
export function absenceFormProblem(from: string, to: string, today: string): string | null {
  if (!isDay(from) || !isDay(to)) return "Elige las dos fechas.";
  if (to < from) return "La fecha final va después de la inicial.";
  if (absenceDays(from, to) > ABSENCE_MAX_DAYS) return `Como mucho ${ABSENCE_MAX_DAYS} días.`;
  if (to < today) return "Esa fecha ya pasó.";
  return null;
}

/** The club's matches as the absence rules see them (kick-off in ms; null without a date). */
export const absenceSlots = <T extends { id: string; status?: unknown; date?: unknown }>(matches: readonly T[], millis: (d: unknown) => number): MatchSlot[] =>
  matches.map((m) => {
    const at = millis(m.date);
    return { id: m.id, status: m.status, date: Number.isFinite(at) ? at : null };
  });

/** How many matches an absence answers «No puedo» for right now: the answerable ones in its dates (a
 *  fresh absence overwrites the answers there, so each of them ends up «No puedo»). */
export const absenceMatchCount = (slots: readonly MatchSlot[], range: Pick<Absence, "from" | "to">, now: number): number => matchesInRange(slots, range, now).length;

/** What the member reads once it is saved (none yet: what happens when one is published). */
export function absenceSavedText(count: number): string {
  if (!count) return "Guardada. No hay partidos en esas fechas todavía: si se publica alguno, contestamos «No puedo» por ti.";
  return `Guardada. Contestamos «No puedo» en ${count === 1 ? "1 partido" : `${count} partidos`}.`;
}

/** What the badges look at in an answer (vestuario/live Availability): `absenceId` only on the ones an
 *  absence wrote (`source: "absence"`). */
export interface AnswerLike {
  uid?: string | null;
  playerId?: string | null;
  response: string;
  absenceId?: string;
}

/**
 * «Ausente · hasta 19 oct» on a «No puedo» that an absence wrote, or that an absence of the member (or his
 * ficha) covers on the match's Madrid day (`day`); plain «Ausente» when an absence wrote it but is no longer
 * at hand. Null for any other answer: a «Voy» or «Duda» by hand over an absence is just that.
 */
export function absentBadge(answer: AnswerLike | null | undefined, absences: readonly Absence[], day: string): string | null {
  if (!answer || answer.response !== "no") return null;
  const own = answer.absenceId ? absences.find((a) => a.id === answer.absenceId) : undefined;
  const a = own ?? (day ? absenceOn(absences, { uid: answer.uid, playerId: answer.playerId }, day) : null);
  if (a) return `Ausente · ${absenceUntilText(a.to)}`;
  return answer.absenceId !== undefined ? "Ausente" : null;
}

/** The Madrid day of a kick-off ("" without a date: no absence covers it). */
export const matchDay = (at: number): string => (Number.isFinite(at) ? madridDate(at) : "");
