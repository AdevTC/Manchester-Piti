// Ausencias: the answers they write. absencesLogic.ts decides what to write and delete; this applies it,
// for one member (an absence created or deleted: onAbsenceWritten, absences.ts) or for one match (a match
// published, moved or rescheduled: pushOnMatch, push.ts). Each plan is read and applied in one transaction
// with the answers it looks at, so a hand answer written meanwhile is never overwritten or deleted by a
// stale plan (the transaction reruns on it). Apart from absences.ts so push.ts can call it without an
// import cycle (absences.ts sends its notice through push.ts). The «No puedo» written here also passes a
// turn of that match on (Turnos): pushOnAnswer sees the write and tells the next member (rota.ts).
import { FieldValue, Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { db } from "./common.js";
import { absenceAvailabilityPlan, answerable, covers, madridDate, parseAbsence, type Absence, type AbsencePlan, type ExistingAnswer, type MatchSlot } from "./absencesLogic.js";

const millis = (v: unknown): number | null => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
};
export type SeasonSlot = MatchSlot & { seasonId?: string };
const slotOf = (d: DocumentSnapshot): SeasonSlot => ({ id: d.id, status: d.get("status"), date: millis(d.get("date")), seasonId: d.get("seasonId") as string | undefined });

/** The matches a member can still answer (the availability rule's upcoming(): scheduled, date ahead). */
export async function upcomingMatches(now: number): Promise<SeasonSlot[]> {
  // (date range only, single-field index; the status is checked here)
  const snap = await db.collection("matches").where("date", ">", Timestamp.fromMillis(now)).get();
  return snap.docs.map(slotOf).filter((m) => answerable(m, now));
}

/** The member signs the answers as the web does (their current nickname and ficha: a rename since the
 *  absence was written still shows right); the absence's own when there is no profile. */
async function signed(tx: Transaction, absences: Absence[]): Promise<Absence[]> {
  const uids = [...new Set(absences.map((a) => a.uid))];
  if (!uids.length) return absences;
  const users = await tx.getAll(...uids.map((uid) => db.doc(`users/${uid}`)));
  const who = new Map(users.map((u) => [u.id, u]));
  return absences.map((a) => {
    const u = who.get(a.uid);
    if (!u?.exists) return a;
    const nickname = u.get("nickname");
    const playerId = u.get("playerId");
    return { ...a, name: typeof nickname === "string" && nickname ? nickname : a.name, playerId: typeof playerId === "string" && playerId ? playerId : null };
  });
}

function apply(tx: Transaction, plan: AbsencePlan): void {
  for (const w of plan.writes) tx.set(db.doc(`matchPrivate/${w.matchId}/availability/${w.uid}`), { ...w.data, at: FieldValue.serverTimestamp() });
  for (const d of plan.deletes) tx.delete(db.doc(`matchPrivate/${d.matchId}/availability/${d.uid}`));
}

/** What applyMemberAbsences did, and whether the absence just created was still there when it did it. */
export interface MemberAbsencesResult extends AbsencePlan {
  /** `fresh` was among the member's absences the transaction read (false without `fresh`, or once it is
   *  deleted: then no notice goes either). */
  freshSeen: boolean;
}

/** Brings one member's answers in line with their absences, on every match still to play. `fresh`: the
 *  absence just created (it overwrites the hand answers in its range given before it). */
export async function applyMemberAbsences(uid: string, fresh: string | null, now: number, matches?: readonly SeasonSlot[]): Promise<MemberAbsencesResult> {
  const list = matches ?? (await upcomingMatches(now));
  if (!list.length) {
    const freshSeen = !!fresh && parseAbsence(fresh, (await db.doc(`absences/${fresh}`).get()).data())?.uid === uid;
    return { writes: [], deletes: [], freshSeen };
  }
  return db.runTransaction(async (tx) => {
    const [mine, answers] = await Promise.all([
      tx.get(db.collection("absences").where("uid", "==", uid)),
      tx.getAll(...list.map((m) => db.doc(`matchPrivate/${m.id}/availability/${uid}`))),
    ]);
    const absences = await signed(tx, mine.docs.map((d) => parseAbsence(d.id, d.data())).filter((a): a is Absence => a !== null && a.uid === uid));
    const existing: ExistingAnswer[] = answers.filter((a) => a.exists).map((a) => ({ matchId: a.ref.parent.parent!.id, uid, doc: a.data() ?? {} }));
    const plan = absenceAvailabilityPlan({ absences, matches: list, existing, fresh, now });
    apply(tx, plan);
    return { ...plan, freshSeen: !!fresh && absences.some((a) => a.id === fresh) };
  });
}

/** A match written: when it was published, moved or (re)scheduled, its answers follow the absences that
 *  cover its day — «No puedo» only for who hasn't answered; an absence's answer it no longer covers goes
 *  (or passes to another absence of that member that covers it). Other writes (goals, the clock…) read nothing. */
export async function absencesOnMatch(matchId: string, before: { status?: string; date?: number } | undefined, after: { status?: string; date?: number } | undefined): Promise<void> {
  if (!after || (before && before.status === after.status && before.date === after.date)) return;
  const now = Date.now();
  const slot: MatchSlot = { id: matchId, status: after.status, date: typeof after.date === "number" ? after.date : null };
  if (!answerable(slot, now)) return;
  const day = madridDate(slot.date as number);
  await db.runTransaction(async (tx) => {
    // (`to` from this day on, single-field index; the start is checked here)
    const [range, answers] = await Promise.all([tx.get(db.collection("absences").where("to", ">=", day)), tx.get(db.collection(`matchPrivate/${matchId}/availability`))]);
    const absences = await signed(tx, range.docs.map((d) => parseAbsence(d.id, d.data())).filter((a): a is Absence => a !== null && covers(a, day)));
    const existing: ExistingAnswer[] = answers.docs.map((a) => ({ matchId, uid: a.id, doc: a.data() }));
    apply(tx, absenceAvailabilityPlan({ absences, matches: [slot], existing, now }));
  });
}
