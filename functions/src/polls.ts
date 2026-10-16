// Encuestas del vestuario: members write polls/{id} and their votes straight from the app (firestore.rules
// checks the shape, the author, the closing time and every vote). The backend only tells the team, once,
// that there is a new poll (pollsLogic.ts builds the notice; deliver claims pushLog/poll-<id> first).
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { deliver, vapidPrivate } from "./push.js";
import { pollNotice, type PollLike } from "./pollsLogic.js";

export const onPollCreated = onDocumentCreated({ document: "polls/{pollId}", secrets: [vapidPrivate] }, async (event) => {
  const notice = pollNotice(event.params.pollId, event.data?.data() as PollLike | undefined);
  if (notice) await deliver(notice);
});
