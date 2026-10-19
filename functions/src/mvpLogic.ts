// The MVP vote's public tally (`mvpResults/{matchId}`), the pure part: who counts and what may be public.
// While the vote is open nothing public says who is ahead: the doc holds only the turnout
// `{ total, eligible, open: true }`; once `voteClosesAt` has passed it holds the counts too
// `{ counts, total, eligible, open: false }` (closeMvpVotes publishes them, tallyMvp and the acta keep them).
// Apart so the app's tests can run it.

export interface MvpTally {
  counts: Record<string, number>;
  total: number;
}
/** `mvpResults/{id}` while the vote is open: the turnout only («9 de 14 votos»). */
export interface OpenMvpDoc {
  total: number;
  eligible: number;
  open: true;
}
/** `mvpResults/{id}` once the vote has closed (or a match without a vote): the counts are public. */
export interface ClosedMvpDoc {
  counts: Record<string, number>;
  total: number;
  eligible: number;
  open: false;
}
export type MvpDoc = OpenMvpDoc | ClosedMvpDoc;

/** The valid votes: one per member, for someone who played (the ledger's `played`). */
export function tallyVotes(ledger: Readonly<Record<string, { played?: boolean } | undefined>> | null | undefined, votes: readonly { playerId?: unknown }[]): MvpTally {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const vote of votes) {
    const id = vote.playerId;
    if (typeof id !== "string" || !ledger?.[id]?.played) continue;
    counts[id] = (counts[id] ?? 0) + 1;
    total++;
  }
  return { counts, total };
}

/** Whether a match's vote is still open at `now` (a match without `voteClosesAt` has no open vote). */
export const mvpVoteOpenAt = (voteClosesAt: unknown, now: number): boolean => typeof voteClosesAt === "number" && Number.isFinite(voteClosesAt) && now < voteClosesAt;

/** What `mvpResults/{id}` may hold at `now`: the turnout while the vote is open, the counts after. */
export function mvpDoc(tally: MvpTally, voteClosesAt: unknown, now: number, eligible: number | null | undefined): MvpDoc {
  const m = typeof eligible === "number" && Number.isFinite(eligible) && eligible > 0 ? Math.round(eligible) : 0;
  if (mvpVoteOpenAt(voteClosesAt, now)) return { total: tally.total, eligible: m, open: true };
  return { counts: tally.counts, total: tally.total, eligible: m, open: false };
}

/** A stored doc still in its open shape (or none) whose vote has closed: the counts are owed
 *  (closeMvpVotes). An older doc without the flag already holds its counts and is left as it is (a
 *  historical import may have no votes to recount from). */
export function mvpCloseDue(stored: Readonly<Record<string, unknown>> | null | undefined, voteClosesAt: unknown, now: number): boolean {
  if (typeof voteClosesAt !== "number" || !Number.isFinite(voteClosesAt) || now < voteClosesAt) return false;
  return !stored || stored.open === true;
}
