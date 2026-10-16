// Encuestas del vestuario: members write polls/{id} and their votes straight from the app (firestore.rules
// checks the shape, the author, the closing time and every vote). The backend tells the team, once, that
// there is a new poll (pollsLogic.ts builds the notice; deliver claims pushLog/poll-<id> first), and
// clears a deleted poll's votes.
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { db } from "./common.js";
import { deliver, vapidPrivate } from "./push.js";
import { pollNotice, type PollLike } from "./pollsLogic.js";

export const onPollCreated = onDocumentCreated({ document: "polls/{pollId}", secrets: [vapidPrivate] }, async (event) => {
  const notice = pollNotice(event.params.pollId, event.data?.data() as PollLike | undefined);
  if (notice) await deliver(notice);
});

/** Votes deleted per batch (well under Firestore's 500 writes per batch). */
const VOTE_BATCH = 200;

/** Deletes polls/{pollId}/votes/* in bounded batches until none is left. Idempotent: a retry (or a vote
 *  written in between) just finds what remains, or nothing. Returns how many it deleted. */
export async function deletePollVotes(pollId: string): Promise<number> {
  const votes = db.collection(`polls/${pollId}/votes`);
  let deleted = 0;
  for (;;) {
    const page = await votes.limit(VOTE_BATCH).get();
    if (page.empty) return deleted;
    const batch = db.batch();
    for (const d of page.docs) batch.delete(d.ref);
    await batch.commit();
    deleted += page.size;
  }
}

// A poll deleted by its author or a captain takes its votes with it (the rules let each member delete
// only their own, so nobody else could).
export const onPollDeleted = onDocumentDeleted("polls/{pollId}", async (event) => {
  await deletePollVotes(event.params.pollId);
});
