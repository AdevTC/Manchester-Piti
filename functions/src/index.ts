import { narrationSourcesSchema } from './narrated/schema.js';
import { PUBLICATION_RESOURCES } from "./publicationResources.js";
import { onCall } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { z } from "zod";
import { type MatchSheet } from "./matchEngine.js";
import { db, idSchema, parse, admin } from "./common.js";
import { publishSheet, sheetSchema } from "./publishSheet.js";
import { matchActiveTx, runMatchTransaction } from './matchAccess.js';
import { activeMemberCount } from "./mvp.js";
import { mvpDoc, tallyVotes } from "./mvpLogic.js";
export { closeMvpVotes } from "./mvp.js";
export { weatherOnMatch } from "./weather.js";
export { onCajaClaimCreated } from "./caja.js";
export { markTurnDone } from "./turnos.js";
export { clubShare } from "./social.js";
export { setSeasonArchived } from "./seasons.js";
export { clubCalendar } from "./calendar.js";
export { clubBundle } from "./bundle.js";
export { clubVitals } from "./vitals.js";
export { htmlCacheMatches, htmlCachePlayers, htmlCacheSeasons, htmlCacheMvp, htmlCacheStandings, htmlCacheContent } from "./htmlCache.js";
export { liveEvent } from "./live.js";
export { publishLive } from "./publishLive.js";
export { savePrediction } from "./savePrediction.js";
export { controlMatchClock, setMatchScorers } from "./liveClock.js";
export { pushSubscribe, pushSetPreset, pushSetMatchTopics, pushUnsubscribe, pushOnMatch, pushOnLineup, pushKickoff, pushOnClaim, pushOnPositionsReview, pushOnStandings, rotaTurnsOnWrite } from "./push.js";
export { pushSetPause } from "./pushPause.js";
export { pushReminders, pushOnAnswer } from "./reminders.js";
export { porraCountOnWrite } from "./porraCount.js";
export { onAbsenceWritten } from "./absences.js";
export { onPollCreated, onPollDeleted } from "./polls.js";
export { cleanupMatchTombstone, deleteMatch, setMatchArchived } from "./matches.js";
export { setConvocatoria } from "./convocatoria.js";
export { setMatchLineup, setMatchPresent } from "./matchLineupCallables.js";
export { inviteInfo, createInvite, revokeInvite, joinWithInvite, requestAccess, cancelAccessRequest, resolveAccess, revokeMember, doorShirts } from "./door.js";
export { setNickname, setShirtName, cancelPlayerClaim, leaveVestuario } from "./profile.js";
export { renameEverywhere } from "./rename.js";
export {
  requestPlayerClaim,
  resolvePlayerClaim,
  proposeTraining,
  confirmTraining,
  deleteTraining,
} from "./vestuario.js";

export { sheetSchema };
export const saveMatchSheet = onCall(PUBLICATION_RESOURCES, async (req) => {
  const uid = await admin(req);
  const input = parse(
    z.object({
      id: idSchema,
      sheet: sheetSchema,
      sources: narrationSourcesSchema.optional(),
      draft: z.boolean().default(false),
    }),
    req.data,
  );
  return publishSheet({ id: input.id, sheet: input.sheet as MatchSheet, draft: input.draft, sources: input.sources, uid });
});
/**
 * MVP tally: members write their own vote (matches/{id}/votes/{uid}, validated by the
 * rules); this trigger recounts the match in a transaction so mvpResults is always
 * the exact count of valid votes, whatever the order or retries of the events. While the
 * vote is open it holds only the turnout (mvpLogic.ts: nothing public says who is ahead);
 * closeMvpVotes publishes the counts once it closes.
 */
export const tallyMvp = onDocumentWritten("matches/{matchId}/votes/{uid}", async (event) => {
  const eligible = await activeMemberCount(Date.now());
  await runMatchTransaction(event.params.matchId, async (tx, { match }) => {
    const votes = await tx.get(match.ref.collection('votes'));
    if (!match.exists) { tx.delete(db.doc(`mvpResults/${event.params.matchId}`)); return; }
    if (!(await matchActiveTx(tx, event.params.matchId, match))) return;
    const tally = tallyVotes(match.get("ledger"), votes.docs.map((v) => v.data()));
    tx.set(db.doc(`mvpResults/${event.params.matchId}`), mvpDoc(tally, match.get("voteClosesAt"), Date.now(), eligible));
  });
});
