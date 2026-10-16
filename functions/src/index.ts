import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  calculateLedger,
  type MatchSheet,
} from "./matchEngine.js";
import { db, idSchema, parse, admin } from "./common.js";
import { eventSchema } from "./eventSchema.js";
import { readyClock } from "./matchClock.js";
import { recomputePorra } from "./vestuario.js";
import { boardCodeByPlayer, boardSystem } from "./boardCodes.js";
import { findOfficialBoard } from "./officialBoard.js";
import { resolvePositions, type PosCode } from "./positions.js";
import { keepStoredPositions, positionsPlayed, withPositions } from "./positionsPlayed.js";
import { assertMatchNotDeleted, matchActiveTx, requireActiveMatch, runMatchTransaction } from './matchAccess.js';
export { clubShare } from "./social.js";
export { setSeasonArchived } from "./seasons.js";
export { clubCalendar } from "./calendar.js";
export { clubBundle } from "./bundle.js";
export { liveEvent } from "./live.js";
export { savePrediction } from "./savePrediction.js";
export { controlMatchClock, setMatchScorers } from "./liveClock.js";
export { pushSubscribe, pushUnsubscribe, pushOnMatch, pushOnLineup, pushKickoff, pushOnClaim, pushOnPositionsReview } from "./push.js";
export { pushReminders, pushOnAnswer } from "./reminders.js";
export { onAbsenceWritten } from "./absences.js";
export { cleanupMatchTombstone, deleteMatch, setMatchArchived } from "./matches.js";
export { setConvocatoria } from "./convocatoria.js";
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

const url = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Usa una URL HTTPS."),
]);
export const sheetSchema = z.object({
  version: z.literal(2),
  revision: z.number().int().min(0).optional(),
  seasonId: idSchema,
  rival: z.string().trim().min(1).max(100),
  rivalLogoUrl: url.optional(),
  rivalInitials: z
    .string()
    .trim()
    .max(3)
    .regex(/^[A-Za-z0-9]*$/)
    .optional(),
  competition: z.string().trim().min(1).max(80),
  date: z.number().finite().min(0),
  duration: z.number().int().min(1).max(150),
  durationSeconds: z.number().int().min(1).max(9000).optional(),
  analysisCoverage: z.enum(["partial", "complete"]).optional(),
  analysisNotes: z.string().max(2000).optional(),
  venue: z.string().max(200),
  home: z.boolean(),
  status: z.enum(["scheduled", "finished", "cancelled", "postponed"]),
  starters: z.array(idSchema).max(7),
  bench: z.array(idSchema).max(30),
  notCalled: z.array(idSchema).max(100),
  events: z.array(eventSchema).max(2500),
  goalsFor: z.number().int().min(0).max(100).optional(),
  goalsAgainst: z.number().int().min(0).max(100).optional(),
  report: z.string().max(10000),
  photoUrl: url.optional(),
  gallery: z.array(url).max(20).optional(),
  meetingNote: z.string().max(500).optional(),
  kit: z.enum(["home", "away"]).optional(),
});
export const saveMatchSheet = onCall(async (req) => {
  const uid = await admin(req);
  const input = parse(
    z.object({
      id: idSchema,
      sheet: sheetSchema,
      draft: z.boolean().default(false),
    }),
    req.data,
  );
  const sheet = input.sheet as MatchSheet;
  if (Buffer.byteLength(JSON.stringify(sheet), "utf8") > 650_000) throw new HttpsError("invalid-argument", "El acta es demasiado grande. Reduce las notas de las jugadas.");
  const participants = [...sheet.starters, ...sheet.bench, ...sheet.notCalled];
  const season = await db.doc(`seasons/${sheet.seasonId}`).get();
  if (!season.exists)
    throw new HttpsError("invalid-argument", "La temporada no existe.");
  if (season.get("archived") === true)
    throw new HttpsError("failed-precondition", "Esa temporada está archivada. Restáurala para editar sus partidos.");
  // «Ha jugado de»: each one's preferred position as the web reads it (resolvePositions: `positions`,
  // else the old free-text position), from the fichas read here anyway.
  const main: Record<string, PosCode | null> = {};
  if (participants.length) {
    const players = await db.getAll(
      ...participants.map((id) => db.doc(`players/${id}`)),
    );
    for (const p of players) main[p.id] = resolvePositions(p.data() ?? {}).main;
    if (
      players.some(
        (p) => !p.exists || !(p.get("seasons") ?? []).includes(sheet.seasonId),
      )
    )
      throw new HttpsError(
        "invalid-argument",
        "Hay jugadores que no pertenecen a esta temporada.",
      );
  }
  const ledger = calculateLedger(sheet, sheet.status === "finished");
  if (!input.draft && ledger.errors.length)
    throw new HttpsError("invalid-argument", ledger.errors.join(" "));
  if (!input.draft && sheet.status === "finished") {
    const roster = await db
      .collection("players")
      .where("seasons", "array-contains", sheet.seasonId)
      .get();
    if (roster.docs.some((p) => !participants.includes(p.id)))
      throw new HttpsError(
        "invalid-argument",
        "Asigna una situación inicial a todos los jugadores de la temporada.",
      );
    if (
      sheet.goalsFor !== ledger.goalsFor ||
      sheet.goalsAgainst !== ledger.goalsAgainst
    )
      throw new HttpsError(
        "invalid-argument",
        "Registra todos los goles de ambos equipos: el acta debe coincidir con el marcador.",
      );
  }
  // The match's official board (never the season's) says who played where. Reading or decoding it must
  // never block publishing. A board that can't be read leaves the correction to the transaction (keep
  // what is stored where nothing changed); one that is read but can't be decoded counts as no board.
  let board: { codes: Record<string, PosCode>; system: string } | null = null;
  let boardFailed = false;
  if (!input.draft && sheet.status === "finished") {
    let found: Awaited<ReturnType<typeof findOfficialBoard>> = null;
    try {
      found = await findOfficialBoard(db, sheet.seasonId, input.id, {
        onInvalidId: (what, id) => console.warn("saveMatchSheet: id no válido", what, id),
      });
    } catch (error) {
      boardFailed = true;
      console.error("saveMatchSheet: official board unreadable, keeping the stored positions where nothing changed", input.id, error);
    }
    if (found)
      try {
        board = { codes: boardCodeByPlayer(found.board), system: boardSystem(found.board) };
      } catch (error) {
        console.error("saveMatchSheet: official board malformed, estimating by preferred position", input.id, found.id, error);
      }
  }
  const ref = db.doc(`matches/${input.id}`);
  const affectedSeasons = await runMatchTransaction(input.id, async (tx, { match: old, draft: oldDraft }) => {
    const currentSeason = await tx.get(db.doc(`seasons/${sheet.seasonId}`));
    await assertMatchNotDeleted(tx, input.id);
    if (old.exists || oldDraft.exists) await requireActiveMatch(tx, input.id, old.exists ? old : oldDraft);
    if (!currentSeason.exists || currentSeason.get('archived') === true) throw new HttpsError('failed-precondition', 'La temporada no está disponible para guardar partidos.');
    if ((old.get("revision") ?? 0) !== (sheet.revision ?? 0))
      throw new HttpsError(
        "aborted",
        "Otro administrador ha actualizado este partido. Recarga antes de guardar.",
      );
    const activeClock = old.get("clock");
    if (!input.draft && sheet.status === "finished" && sheet.date > Date.now() && activeClock?.phase !== "ended") throw new HttpsError("invalid-argument", "El partido todavía no ha comenzado.");
    if (!input.draft && activeClock && ["first", "halftime", "second"].includes(activeClock.phase)) throw new HttpsError("failed-precondition", "El partido sigue en marcha. Pita el final antes de publicar o modificar el acta.");
    if (input.draft) {
      tx.set(db.doc(`matchDrafts/${input.id}`), {
        ...sheet,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return [] as string[];
    }
    const { meetingNote, ...publicSheet } = sheet;
    const finished = sheet.status === "finished";
    // «Ha jugado de». With the board unreadable, a published acta keeps its stored positions and system
    // for each player whose stints and actions did not change, and estimates the rest; a first
    // publication has nothing stored, so it estimates.
    let system: string | null = null;
    if (finished) {
      if (boardFailed && old.get("status") === "finished") {
        keepStoredPositions(ledger.players, old.get("ledger"), positionsPlayed(ledger.players, sheet.events, { board: null, main }));
        system = typeof old.get("system") === "string" ? (old.get("system") as string) : null;
      } else {
        withPositions(ledger.players, positionsPlayed(ledger.players, sheet.events, { board: board?.codes ?? null, main }));
        system = board?.system ?? null;
      }
    }
    const votes = await tx.get(ref.collection("votes"));
    // Replace this match's contribution atomically: corrections never double count.
    const deltas = new Map<
      string,
      { playerId: string; seasonId: string; totals: Record<string, number> }
    >();
    const contribute = (
      seasonId: string,
      rows: Record<
        string,
        ReturnType<typeof calculateLedger>["players"][string]
      >,
      sign: number,
    ) => {
      for (const [playerId, row] of Object.entries(rows)) {
        const key = createHash("sha256")
          .update(`${seasonId}/${playerId}`)
          .digest("hex");
        const entry = deltas.get(key) ?? { playerId, seasonId, totals: {} };
        for (const [k, v] of Object.entries(row))
          if (typeof v === "number")
            entry.totals[k] = (entry.totals[k] ?? 0) + sign * v;
        for (const k of [
          "started",
          "benched",
          "notCalled",
          "played",
          "dismissed",
        ] as const)
          entry.totals[k] = (entry.totals[k] ?? 0) + sign * (row[k] ? 1 : 0);
        deltas.set(key, entry);
      }
    };
    if (old.get("status") === "finished" && old.get("seasonId"))
      contribute(old.get("seasonId"), old.get("ledger") ?? {}, -1);
    if (finished) contribute(sheet.seasonId, ledger.players, 1);
    const totalsBefore = new Map<string, Record<string, number>>();
    const keys = [...deltas.keys()];
    const stats = keys.length ? await tx.getAll(...keys.map((key) => db.doc(`playerSeasonStats/${key}`))) : [];
    stats.forEach((snap, i) => totalsBefore.set(keys[i], snap.get("totals") ?? {}));
    // An amended lineup may remove a previously eligible MVP candidate.
    const counts: Record<string, number> = {};
    let total = 0;
    for (const vote of votes.docs) {
      const playerId = vote.get("playerId");
      if (finished && ledger.players[playerId]?.played) {
        counts[playerId] = (counts[playerId] ?? 0) + 1;
        total++;
      } else tx.delete(vote.ref);
    }
    tx.set(db.doc(`mvpResults/${input.id}`), { counts, total });
    for (const [key, entry] of deltas) {
      const totals = totalsBefore.get(key)!;
      for (const [stat, change] of Object.entries(entry.totals))
        totals[stat] = (totals[stat] ?? 0) + change;
      tx.set(db.doc(`playerSeasonStats/${key}`), {
        playerId: entry.playerId,
        seasonId: entry.seasonId,
        totals,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    // setConvocatoria's stamps live outside the sheet: a save keeps them (the trigger and Hoy read them).
    const stamps = Object.fromEntries((["convocatoriaAt", "convocatoriaNotifiedAt"] as const).flatMap((k) => (typeof old.get(k) === "number" ? [[k, old.get(k) as number]] : [])));
    tx.set(ref, {
      ...publicSheet,
      ...stamps,
      clock: old.get("clock") ?? readyClock(),
      ...(typeof old.get("liveEndedAt") === "number" && old.get("date")?.toMillis() === sheet.date ? { liveEndedAt: old.get("liveEndedAt") } : {}),
      date: Timestamp.fromMillis(sheet.date),
      revision: (sheet.revision ?? 0) + 1,
      goalsFor: finished ? sheet.goalsFor : null,
      goalsAgainst: finished ? sheet.goalsAgainst : null,
      ledger: finished ? ledger.players : {},
      system,
      voteClosesAt: finished
        ? (old.get("voteClosesAt") ?? Date.now() + 48 * 60 * 60_000)
        : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`matchPrivate/${input.id}`), {
      meetingNote: meetingNote ?? "",
      updatedBy: uid,
    }, { merge: true });
    tx.delete(db.doc(`matchDrafts/${input.id}`));
    tx.set(db.collection("matchAudit").doc(), {
      matchId: input.id,
      revision: (sheet.revision ?? 0) + 1,
      updatedBy: uid,
      at: FieldValue.serverTimestamp(),
    });
    return [...new Set([sheet.seasonId, old.get('seasonId')].filter((id): id is string => typeof id === 'string' && !!id))].sort();
  }, { seasons: [sheet.seasonId] });
  // A move removes the old season's contribution as well as adding the new one.
  for (const seasonId of affectedSeasons) await recomputePorra(seasonId);
  return { id: input.id, draft: input.draft, ledger };
});
/**
 * MVP tally: members write their own vote (matches/{id}/votes/{uid}, validated by the
 * rules); this trigger recounts the match in a transaction so mvpResults is always
 * the exact count of valid votes, whatever the order or retries of the events.
 */
export const tallyMvp = onDocumentWritten("matches/{matchId}/votes/{uid}", async (event) => {
  await runMatchTransaction(event.params.matchId, async (tx, { match }) => {
    const votes = await tx.get(match.ref.collection('votes'));
    if (!match.exists) { tx.delete(db.doc(`mvpResults/${event.params.matchId}`)); return; }
    if (!(await matchActiveTx(tx, event.params.matchId, match))) return;
    const ledger = (match.get("ledger") ?? {}) as Record<string, { played?: boolean }>;
    const counts: Record<string, number> = {};
    let total = 0;
    for (const vote of votes.docs) {
      const playerId = vote.get("playerId") as string;
      if (!ledger[playerId]?.played) continue;
      counts[playerId] = (counts[playerId] ?? 0) + 1;
      total++;
    }
    tx.set(db.doc(`mvpResults/${event.params.matchId}`), { counts, total });
  });
});
