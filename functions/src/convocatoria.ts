// The one convocatoria: «el siete» (titulares) + the banquillo of a match, written by the admin's Hoy and
// Convocar (and read by the match tab, the pizarra and the acta). setConvocatoria validates the lineup
// (≤ 7 titulares, nobody twice, players of the match's season), writes it to the published match (and to
// its draft, when there is one, so the admin's merged view agrees) with a revision bump, the rest of the
// season as «no convocados» and the `convocatoriaAt` stamp. With `notify` it sends the convocatoria's push:
// «Ya está la convocatoria» the first time, «Cambios en la convocatoria» once when an already-notified one
// changed (pushLog keeps both to once per match), and stamps `convocatoriaNotifiedAt`. One «siete» per
// match: that notice stays quiet (`covered`) when «Ya está el siete» told the team the same seven in the
// last 10 minutes, or is about to (`fromBoard`: the pizarra's official just published with «Usar este
// siete como convocatoria») — only when the seven is all it would tell (a «Cambios» that calls someone
// new, or leaves someone out, always goes). Another convocatoria notice never covers one.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { guestsSchema, playerRefSchema } from "./eventSchema.js";
import type { MatchGuest } from "./guests.js";
import { convocatoriaNoticeKind, convocatoriaProblem, MAX_STARTERS, notCalledOf, sameLineup, type ConvocatoriaNoticeKind } from "./convocatoriaLogic.js";
import { seasonJornada, sendTo, vapidPrivate } from "./push.js";
import { boardNotice, convocatoriaMessage, parseSiete, sevenOf, sieteKey, sieteLog, sieteMayCover, sieteStep, type SieteAsk } from "./pushLogic.js";
import { matchActiveTx, requireActiveMatch, runMatchTransaction } from './matchAccess.js';

const input = z.object({
  matchId: idSchema,
  starters: z.array(playerRefSchema).max(MAX_STARTERS),
  bench: z.array(playerRefSchema).max(30),
  /** Invitados en el acta: the match's guest list (replaces it); absent keeps the stored one. */
  guests: guestsSchema.optional(),
  notify: z.boolean().default(false),
  /** The pizarra's official just published for this match, whose seven this is («Usar este siete como
   *  convocatoria»): its «Ya está el siete» tells the team, the convocatoria's notice stays quiet. */
  fromBoard: idSchema.optional(),
});

const millis = (v: unknown): number => {
  if (typeof v === "number") return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : NaN;
};
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const setConvocatoria = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const uid = await admin(req);
  const data = parse(input, req.data);
  const pubRef = db.doc(`matches/${data.matchId}`);
  const draftRef = db.doc(`matchDrafts/${data.matchId}`);
  const lineup = { starters: data.starters, bench: data.bench };
  const written = await runMatchTransaction(data.matchId, async (tx, { match: pub, draft }) => {
    if (!pub.exists && !draft.exists) throw new HttpsError("not-found", "Ese partido no existe.");
    // The admin shows the draft's fields over the published ones: read them the same way.
    const shown = draft.exists ? draft : pub;
    await requireActiveMatch(tx, data.matchId, pub.exists ? pub : draft);
    if (data.notify && !pub.exists) throw new HttpsError("failed-precondition", "El partido aún no está en el calendario: publícalo antes de avisar.");
    if (pub.get("archived") === true) throw new HttpsError("failed-precondition", "Ese partido está archivado.");
    const seasonId = shown.get("seasonId") as string | undefined;
    if (!seasonId) throw new HttpsError("failed-precondition", "El partido no tiene temporada.");
    const season = await tx.get(db.doc(`seasons/${seasonId}`));
    if (!season.exists) throw new HttpsError("invalid-argument", "La temporada no existe.");
    if (season.get("archived") === true) throw new HttpsError("failed-precondition", "Esa temporada está archivada. Restáurala para cambiar sus partidos.");
    const players = await tx.get(db.collection("players").where("seasons", "array-contains", seasonId));
    const roster = players.docs.map((p) => p.id);
    // Closed once the match is PUBLISHED as played (its acta corrects the minutes); an acta still in draft
    // — played but unpublished — can complete its convocatoria. Cancelled: closed either way.
    const status = pub.exists ? (pub.get("status") as string | undefined) : shown.get("status") === "cancelled" ? "cancelled" : undefined;
    if (pub.get("clock") && pub.get("clock.phase") !== "ready") throw new HttpsError("failed-precondition", "El siete inicial ya está en juego. Registra las sustituciones desde la mesa del partido.");
    const guests = data.guests ?? (Array.isArray(shown.get("guests")) ? (shown.get("guests") as MatchGuest[]) : []);
    const problem = convocatoriaProblem(lineup, { roster, status, guests });
    if (problem) throw new HttpsError(problem.startsWith("Ese partido") ? "failed-precondition" : "invalid-argument", problem);

    const now = Date.now();
    const before = { starters: ids(shown.get("starters")), bench: ids(shown.get("bench")) };
    const stamps = { convocatoriaAt: now, ...(data.notify ? { convocatoriaNotifiedAt: now } : {}) };
    const fields = { starters: data.starters, bench: data.bench, notCalled: notCalledOf(roster, lineup), ...(data.guests ? { guests: data.guests } : {}), ...stamps };
    const revision = num((pub.exists ? pub : draft).get("revision")) + 1;
    // Changed since the last notice: a quiet change after it, or this very call.
    const changed = !sameLineup(before, lineup) || num(pub.get("convocatoriaAt")) > num(pub.get("convocatoriaNotifiedAt"));
    if (pub.exists) tx.update(pubRef, { ...fields, revision, updatedAt: FieldValue.serverTimestamp() });
    // The draft keeps its own revision (the acta editor's base): only the lineup follows.
    if (draft.exists) tx.update(draftRef, fields);
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision, updatedBy: uid, at: FieldValue.serverTimestamp(), convocatoria: data.notify ? "notify" : "save" });
    // The notice tells what the members see: the calendar's (published) date and rival, else the draft's.
    const told = (field: string) => (pub.exists && pub.get(field) != null ? pub.get(field) : shown.get(field));
    return { now, revision, changed, seasonId, date: millis(told("date")), rival: (told("rival") as string | undefined) ?? "el rival" };
  });

  let notice: ConvocatoriaNoticeKind | null = null;
  // The team was (or is about to be) told this seven by «Ya está el siete»: the notice stays quiet.
  let covered = false;
  if (data.notify) {
    const notifiedBefore = (await db.doc(`pushLog/conv-${data.matchId}`).get()).exists;
    const kind = convocatoriaNoticeKind({ notify: true, upcoming: Number.isFinite(written.date) && written.date > written.now, notifiedBefore, changed: written.changed });
    if (kind) {
      // Once per match and kind, whatever the double taps or retries — and one «siete» per match
      // (pushLogic sieteStep): «Ya está el siete» of this same seven (just told, or about to be by the
      // official just published) covers the notice when the seven is all it would tell (sieteMayCover).
      // Decided in ONE transaction with the kind's claim: a quiet «Cambios» never takes its slot (a real
      // change later is still announced); a quiet first notice does (the convocatoria counts as announced).
      const log = kind === "first" ? `conv-${data.matchId}` : `conv-${data.matchId}-cambios`;
      const logRef = db.doc(`pushLog/${log}`);
      const firstRef = db.doc(`pushLog/conv-${data.matchId}`);
      const sieteRef = db.doc(`pushLog/${sieteLog(data.matchId)}`);
      const board = data.fromBoard ? await boardSevenFor(data.fromBoard, data.matchId, written.seasonId) : null;
      const seven = sieteKey(data.starters);
      const ask: SieteAsk = data.fromBoard && board?.state === "pending" ? { by: "reserve", board: data.fromBoard, seven: board.seven } : { by: "conv", seven };
      const lineupNow = { starters: data.starters, bench: data.bench };
      const outcome = await runMatchTransaction(data.matchId, async (tx) => {
        const [own, first, siete] = await tx.getAll(logRef, firstRef, sieteRef);
        if (!(await matchActiveTx(tx, data.matchId))) return 'taken' as const;
        if (own.exists) return "taken" as const;
        const now = Date.now();
        const step = sieteMayCover(kind, lineupNow, kind === "first" ? null : (first.get("announced") as { starters?: unknown; bench?: unknown } | undefined))
          ? sieteStep(parseSiete(siete.data()), ask, now)
          : { send: true, write: { at: now, by: "conv" as const, seven, sent: true }, coveredBy: null };
        if (step.write) tx.set(sieteRef, { ...step.write, matchId: data.matchId });
        const stamp = { at: FieldValue.serverTimestamp(), matchId: data.matchId, by: uid, ...(kind === "first" ? { announced: lineupNow } : {}) };
        if (step.send) {
          tx.create(logRef, stamp);
          return "send" as const;
        }
        // (the log says why nothing went)
        if (kind === "first") tx.create(logRef, { ...stamp, quiet: "siete" });
        return step.coveredBy === "lineup" ? ("covered" as const) : ("quiet" as const);
      });
      notice = outcome === "send" ? kind : null;
      covered = outcome === "covered";
      if (notice) {
        const jornada = await seasonJornada(written.seasonId, data.matchId);
        await sendTo(convocatoriaMessage(data.matchId, notice, { rival: written.rival, date: written.date }, jornada));
      }
    }
  }
  return { at: written.now, revision: written.revision, notice, covered };
});

const atMillis = (v: unknown): number | null => {
  const t = millis(v);
  return Number.isFinite(t) ? t : null;
};

/** Where `boardId`'s «Ya está el siete» stands when it is the match's official just published (pushLogic
 *  boardNotice), with its stored seven (sieteKey); null otherwise. */
async function boardSevenFor(boardId: string, matchId: string, seasonId: string): Promise<{ state: "pending" | "sent"; seven: string } | null> {
  const [board, lock, logged] = await Promise.all([
    db.doc(`lineups/${boardId}`).get(),
    db.doc(`lineupOfficials/${seasonId}__${matchId}`).get(),
    db.doc(`pushLog/lineup-${boardId}-${matchId}`).get(),
  ]);
  const now = Date.now();
  const state = boardNotice({
    board: board.data(),
    lock: lock.exists ? { lineupId: lock.get("lineupId"), at: atMillis(lock.get("at")) } : null,
    boardId,
    matchId,
    // (a claim without its stamp yet: just made)
    lineupLoggedAt: logged.exists ? (atMillis(logged.get("at")) ?? now) : null,
    now,
  });
  return state ? { state, seven: sieteKey(sevenOf(board.get("slots"))) } : null;
}
