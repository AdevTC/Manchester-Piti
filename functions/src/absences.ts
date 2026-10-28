// Ausencias («no puedo del 12 al 19»): the member writes absences/{id} (the rules check the shape, the
// range and that it is theirs); this trigger answers «No puedo» for them on the matches still to play in
// those dates, and takes those answers back when the absence is deleted (absenceAnswers.ts applies what
// absencesLogic.ts decides). The captains get one notice per absence, never one «Baja» per match
// (pushOnAnswer skips the answers an absence writes). A match published or moved into a range is
// pushOnMatch's step (push.ts → absencesOnMatch).
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./common.js";
import { sendTo, vapidPrivate } from "./push.js";
import { absenceNotice } from "./pushLogic.js";
import { nameFor } from "./names.js";
import { absenceNoticeDue, matchesInRange, parseAbsence, type Absence } from "./absencesLogic.js";
import { applyMemberAbsences, upcomingMatches, type SeasonSlot } from "./absenceAnswers.js";

/** Claims pushLog/<id> (false = it was already there: the notice already went). */
async function once(id: string): Promise<boolean> {
  try {
    await db.doc(`pushLog/${id}`).create({ at: FieldValue.serverTimestamp() });
    return true;
  } catch {
    return false;
  }
}

/** «NOMBRE no puede del 12 al 19 oct (2 partidos)», to the captains (not to the member, if a captain), once. */
async function tellCaptains(a: Absence, matches: readonly SeasonSlot[]): Promise<void> {
  const player = a.playerId ? await db.doc(`players/${a.playerId}`).get() : null;
  // (his shirt name in the season of the first match, like the web; without a ficha, the member's @apodo)
  const who = player?.exists ? nameFor(player.data(), matches[0]?.seasonId) : a.name ? "@" + a.name : "Alguien";
  const notice = absenceNotice(a, who, matches);
  if (!(await once(notice.log!))) return;
  const captains = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
  for (const c of captains.docs) if (c.id !== a.uid) await sendTo(notice, c.id);
}

export const onAbsenceWritten = onDocumentWritten({ document: "absences/{absenceId}", secrets: [vapidPrivate] }, async (event) => {
  const { absenceId } = event.params;
  const before = parseAbsence(absenceId, event.data?.before.data());
  const after = parseAbsence(absenceId, event.data?.after.data());
  const uid = after?.uid ?? before?.uid;
  if (!uid) return;
  const now = Date.now();
  const matches = await upcomingMatches(now);
  // (created: it overwrites the hand answers in its range; deleted: only its own answers go)
  const created = !!after && !event.data?.before.exists;
  const applied = await applyMemberAbsences(uid, created ? absenceId : null, now, matches);
  // (the rules allow no edits; an absence moved to another member by hand: the first one's answers too)
  if (before && after && before.uid !== after.uid) await applyMemberAbsences(before.uid, null, now, matches);
  // (one notice, only for an absence still there when its answers were written, and not all in the past; none for
  // one a captain wrote for him from la Sala — `by`, r12 — whose «No puedo» is applied all the same)
  if (created && absenceNoticeDue(after, applied.freshSeen, now)) await tellCaptains(after, matchesInRange(matches, after, now));
});
