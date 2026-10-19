// The MVP vote's public tally, the server's part (mvpLogic.ts has the rules). While a vote is open
// `mvpResults/{matchId}` holds only the turnout `{ total, eligible, open: true }` (tallyMvp, the acta);
// `closeMvpVotes` publishes the counts once `voteClosesAt` has passed, then tells the winner («MVP de la J5»).
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./common.js";
import { matchActiveTx, runMatchTransaction } from "./matchAccess.js";
import { mvpCloseDue, mvpDoc, tallyVotes } from "./mvpLogic.js";
import { announceMvpWinners, vapidPrivate } from "./push.js";

/** Who can vote (the «de 14» of «9 de 14 votos»): the vestuario's members whose access is current. */
export async function activeMemberCount(now: number): Promise<number> {
  try {
    const snap = await db.collection("teamMembers").where("expiresAt", ">", Timestamp.fromMillis(now)).count().get();
    return snap.data().count;
  } catch (e) {
    console.error("activeMemberCount", e);
    return 0;
  }
}

/** How far back a closed vote is still looked at (a job that was down for a while catches up). */
export const MVP_CLOSE_LOOKBACK_MS = 30 * 86_400_000;

/** Publishes the counts of every vote that closed and still shows only its turnout (idempotent: a closed
 *  doc is left as it is). Returns how many it closed. */
export async function closeDueVotes(now: number): Promise<number> {
  const due = await db.collection("matches").where("voteClosesAt", ">=", now - MVP_CLOSE_LOOKBACK_MS).where("voteClosesAt", "<=", now).get();
  let closed = 0;
  for (const m of due.docs) {
    if (m.get("archived") === true) continue;
    if (!mvpCloseDue((await db.doc(`mvpResults/${m.id}`).get()).data(), m.get("voteClosesAt"), now)) continue;
    const eligible = await activeMemberCount(now);
    const done = await runMatchTransaction(m.id, async (tx, { match }) => {
      const ref = db.doc(`mvpResults/${m.id}`);
      const [votes, stored] = await Promise.all([tx.get(match.ref.collection("votes")), tx.get(ref)]);
      if (!match.exists || !(await matchActiveTx(tx, m.id, match))) return false;
      if (!mvpCloseDue(stored.data(), match.get("voteClosesAt"), now)) return false;
      const tally = tallyVotes(match.get("ledger"), votes.docs.map((v) => v.data()));
      const keep = stored.get("eligible");
      tx.set(ref, mvpDoc(tally, match.get("voteClosesAt"), now, typeof keep === "number" && keep > 0 ? keep : eligible));
      return true;
    });
    if (done) closed++;
  }
  return closed;
}

/** An open vote whose doc still shows its counts (written before this rule, or by an old trigger still
 *  running): rewritten to its turnout only. Idempotent. Returns how many it hid. */
export async function hideOpenCounts(now: number): Promise<number> {
  const open = await db.collection("matches").where("voteClosesAt", ">", now).get();
  let hidden = 0;
  for (const m of open.docs) {
    const stored = (await db.doc(`mvpResults/${m.id}`).get()).data();
    if (!stored || (stored.open === true && !("counts" in stored))) continue;
    const eligible = await activeMemberCount(now);
    const done = await runMatchTransaction(m.id, async (tx, { match }) => {
      const ref = db.doc(`mvpResults/${m.id}`);
      const [votes, snap] = await Promise.all([tx.get(match.ref.collection("votes")), tx.get(ref)]);
      if (!match.exists || !(await matchActiveTx(tx, m.id, match))) return false;
      const keep = snap.get("eligible");
      tx.set(ref, mvpDoc(tallyVotes(match.get("ledger"), votes.docs.map((v) => v.data())), match.get("voteClosesAt"), now, typeof keep === "number" && keep > 0 ? keep : eligible));
      return true;
    });
    if (done) hidden++;
  }
  return hidden;
}

// Cloud Scheduler has no Madrid location: the job lives in Belgium (like pushKickoff); every 10 minutes.
export const closeMvpVotes = onSchedule({ schedule: "every 10 minutes", timeZone: "Europe/Madrid", region: "europe-west1", secrets: [vapidPrivate] }, async () => {
  const now = Date.now();
  await hideOpenCounts(now);
  await closeDueVotes(now);
  // (the winner's notice, once per match: the same step as pushKickoff's, now that the counts are out)
  await announceMvpWinners(now);
});
