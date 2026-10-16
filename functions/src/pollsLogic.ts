// Encuestas del vestuario (pure): the team's one «Nueva encuesta» notice for a poll just created
// (polls.ts onPollCreated sends it through push.ts deliver → sendTo, which keeps it in the centro de
// avisos). The closing result is not pushed (docs/superpowers/specs/2026-10-16-encuestas-design.md).
import type { Notice } from "./pushLogic.js";

/** Where the vestuario shows the polls. */
export const POLL_URL = "/vestuario#encuestas";

/** The fields of polls/{id} the notice reads. */
export interface PollLike {
  question?: unknown;
  authorName?: unknown;
}

/**
 * «Nueva encuesta» · «${authorName}: ${question}», on the `lineup` topic (the team's vestuario news), with
 * tag and log `poll-${id}`: a retried trigger finds its pushLog taken and never sends it twice. Null when
 * the doc has no question to tell.
 */
export function pollNotice(id: string, poll: PollLike | undefined): Notice | null {
  const question = typeof poll?.question === "string" ? poll.question.trim() : "";
  if (!question) return null;
  const author = typeof poll?.authorName === "string" ? poll.authorName.trim() : "";
  const tag = `poll-${id}`;
  return { topic: "lineup", title: "Nueva encuesta", body: author ? `${author}: ${question}` : question, tag, url: POLL_URL, log: tag };
}
