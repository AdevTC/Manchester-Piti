// The acta's publication pipeline, shared by saveMatchSheet (the editor, admins) and publishLive (la
// mesa, admins and the match's scorers): validation, ledger, «Ha jugado de», season totals, MVP votes
// and the porra, in one transaction.
import { analysisProblem, narratedAnalysisSchema, type NarrationSource } from './narrated/schema.js';
import { prepareNarrationHistory } from './narrated/history.js';
import { synchronizeCanonicalAnalysis } from './narrated/editing.js';
import { publicNarrationEvents } from './narrated/privateSources.js';
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { z } from "zod";
import { calculateLedger, dateMillis, isCompleted, isPendingDup, type MatchSheet } from "./matchEngine.js";
import { db, idSchema } from "./common.js";
import { isYouTubeUrl } from "./matchVideo.js";
import { eventSchema, guestsSchema, playerRefSchema } from "./eventSchema.js";
import { guestRefsProblem, memberIds, withoutGuests } from "./guests.js";
import { readyClock } from "./matchClock.js";
import { recomputePorra } from "./vestuario.js";
import { boardCodeByPlayer, boardSystem } from "./boardCodes.js";
import { findOfficialBoard } from "./officialBoard.js";
import { resolvePositions, type PosCode } from "./positions.js";
import { keepStoredPositions, positionsPlayed, swapsChanged, withPositions } from "./positionsPlayed.js";
import { assertMatchNotDeleted, requireActiveMatch, runMatchTransaction } from './matchAccess.js';
import { lineupCodeByPlayer, lineupSeven, parseMatchLineup, parsePresent, sameSeven } from "./matchLineup.js";
import { activeMemberCount } from "./mvp.js";
import { mvpDoc, tallyVotes } from "./mvpLogic.js";
import { notasDoc, parseStoredNotas } from "./rating/frozen.js";
import { standingsLike } from "./rating/rival.js";
import { frozenNotas } from "./rating/season.js";
import type { RatingMatch, StandingsLike } from "./rating/types.js";

/** A stored match date in ms: a Timestamp to the exact ms, or a plain number (older and seeded matches). */
const exactMillis = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : dateMillis(v);
};

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
  /** La mesa's LED code for the rival («ATL»); empty or absent: the first letters of its name. */
  rivalShort: z
    .string()
    .trim()
    .max(4, "El código del rival tiene como mucho 4 letras.")
    .regex(/^[\p{L}\p{N}]*$/u, "El código del rival solo lleva letras y números.")
    .optional(),
  competition: z.string().trim().min(1).max(80),
  date: z.number().finite().min(0),
  duration: z.number().int().min(1).max(150),
  durationSeconds: z.number().int().min(1).max(9000).optional(),
  analysis: narratedAnalysisSchema.optional(),
  analysisCoverage: z.enum(["partial", "complete"]).optional(),
  analysisNotes: z.string().max(2000).optional(),
  venue: z.string().max(200),
  home: z.boolean(),
  status: z.enum(["scheduled", "finished", "cancelled", "postponed"]),
  starters: z.array(playerRefSchema).max(7),
  bench: z.array(playerRefSchema).max(30),
  notCalled: z.array(idSchema).max(100),
  guests: guestsSchema.optional(),
  events: z.array(eventSchema).max(2500),
  goalsFor: z.number().int().min(0).max(100).optional(),
  goalsAgainst: z.number().int().min(0).max(100).optional(),
  report: z.string().max(10000),
  photoUrl: url.optional(),
  videoUrl: z.union([z.literal(""), z.string().max(300).refine(isYouTubeUrl, "El vídeo tiene que ser un enlace de YouTube.")]).optional(),
  gallery: z.array(url).max(20).optional(),
  meetingNote: z.string().max(500).optional(),
  kit: z.enum(["home", "away"]).optional(),
  /** Aplazado: why (≤ 140) and the new date (ms; null = por decidir). Kept only with status "postponed". */
  postponedReason: z.string().trim().max(140, "El motivo cabe en 140 letras.").optional(),
  postponedTo: z.number().finite().min(0).nullable().optional(),
});
export interface PublishRequest {
  id: string;
  sheet: MatchSheet;
  draft: boolean;
  sources?: NarrationSource[];
  /** Who publishes (the audit, matchPrivate.updatedBy). */
  uid: string;
  /** Extra checks inside the transaction, before any write (publishLive: the scorer, the whistle). */
  guard?: (tx: FirebaseFirestore.Transaction, old: FirebaseFirestore.DocumentSnapshot) => Promise<void>;
  /** What a stale revision says. */
  staleMessage?: string;
}
/** Saves a draft or publishes the acta: exactly saveMatchSheet's pipeline. */
export async function publishSheet(input: PublishRequest) {
  const uid = input.uid;
  const sheet = { ...input.sheet } as MatchSheet;
  // Old clients and live publication keep the rich dataset; omission never erases an import.
  if (!sheet.analysis) { const previous = await db.doc(`matches/${input.id}`).get(); if (previous.get('analysis')) sheet.analysis = synchronizeCanonicalAnalysis(narratedAnalysisSchema.parse(previous.get('analysis')), previous.get('events') ?? [], sheet.events, sheet.durationSeconds ?? sheet.duration * 60); }
  if (Buffer.byteLength(JSON.stringify(sheet), "utf8") > 650_000) throw new HttpsError("invalid-argument", "El acta es demasiado grande. Reduce las notas de las jugadas.");
  // Members only: a guest («guest:g1») has no ficha, no season and no stats (guests.ts).
  const participants = memberIds([...sheet.starters, ...sheet.bench, ...sheet.notCalled]);
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
  // Every `guest:` reference names a guest on the list — a draft too (the acta and Convocar read it).
  const guestProblem = guestRefsProblem(sheet);
  if (guestProblem) throw new HttpsError("invalid-argument", guestProblem);
  const analysisIssue = analysisProblem(sheet.analysis, sheet.events, [...sheet.starters, ...sheet.bench, ...sheet.notCalled], sheet.durationSeconds ?? sheet.duration * 60);
  if (analysisIssue) throw new HttpsError('invalid-argument', analysisIssue);
  const fullLedger = calculateLedger(sheet, sheet.status === "finished");
  // The guests' goals count for the team (goalsFor); their rows never reach a member's numbers: the
  // stored ledger, the season stats, the MVP candidates and the porra read members only.
  const ledger = { ...fullLedger, players: withoutGuests(fullLedger.players) };
  if (!input.draft && ledger.errors.length)
    throw new HttpsError("invalid-argument", ledger.errors.join(" "));
  // La mesa's «¿Es la misma jugada?» must be answered first: a pending duplicate counts once until then.
  if (!input.draft && sheet.status === "finished" && sheet.events.some(isPendingDup))
    throw new HttpsError("failed-precondition", "Hay jugadas repetidas sin resolver («¿Es la misma jugada?»). Respóndelas antes de publicar el acta.");
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
  // «La nota congelada» (rating/frozen): the season's other published actas and its table, which this acta's notas
  // are rated against — read here, like the fichas, since they only feed the rating.
  let seasonGames: RatingMatch[] = [];
  let table: StandingsLike[] = [];
  if (!input.draft && sheet.status === "finished") {
    const [games, standings] = await Promise.all([
      db.collection("matches").where("seasonId", "==", sheet.seasonId).where("status", "==", "finished").get(),
      db.doc(`standings/${sheet.seasonId}`).get(),
    ]);
    seasonGames = games.docs.filter((d) => d.id !== input.id).map((d) => ({ ...d.data(), id: d.id }) as RatingMatch).filter((m) => isCompleted(m));
    const t = standingsLike(sheet.seasonId, standings.data());
    table = t ? [t] : [];
  }
  const ref = db.doc(`matches/${input.id}`);
  // Who can vote the MVP (the turnout's «de 14»), counted outside the transaction.
  const eligible = !input.draft && sheet.status === "finished" ? await activeMemberCount(Date.now()) : 0;
  const affectedSeasons = await runMatchTransaction(input.id, async (tx, { match: old, draft: oldDraft }) => {
    const currentSeason = await tx.get(db.doc(`seasons/${sheet.seasonId}`));
    await assertMatchNotDeleted(tx, input.id);
    if (old.exists || oldDraft.exists) await requireActiveMatch(tx, input.id, old.exists ? old : oldDraft);
    if (!currentSeason.exists || currentSeason.get('archived') === true) throw new HttpsError('failed-precondition', 'La temporada no está disponible para guardar partidos.');
    if ((old.get("revision") ?? 0) !== (sheet.revision ?? 0))
      throw new HttpsError(
        "aborted",
        input.staleMessage ?? "Otro administrador ha actualizado este partido. Recarga antes de guardar.",
      );
    if (sheet.analysis && sheet.analysis.revision !== (old.get('analysis.revision') ?? 0)) throw new HttpsError('aborted', 'El análisis ha cambiado. Recarga el acta antes de guardar.');
    if (input.guard) await input.guard(tx, old);
    const activeClock = old.get("clock");
    if (!input.draft && sheet.status === "finished" && sheet.date > Date.now() && activeClock?.phase !== "ended") throw new HttpsError("invalid-argument", "El partido todavía no ha comenzado.");
    if (!input.draft && activeClock && ["first", "halftime", "second"].includes(activeClock.phase)) throw new HttpsError("failed-precondition", "El partido sigue en marcha. Pita el final antes de publicar o modificar el acta.");
    const writeNarrationHistory = await prepareNarrationHistory(tx, input.id, uid, sheet.revision ?? 0, input.draft, sheet, input.sources ?? [], old);
    if (input.draft) {
      writeNarrationHistory();
      tx.set(db.doc(`matchDrafts/${input.id}`), {
        ...sheet,
        ...(input.sources?.length ? { narrationSources: input.sources } : {}),
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return [] as string[];
    }
    const { meetingNote, postponedReason, postponedTo, narrationSources: _privateSources, ...publicSheet } = sheet;
    const finished = sheet.status === "finished";
    const voteClosesAt: number | null = finished ? ((old.get("voteClosesAt") as number | undefined) ?? Date.now() + 48 * 60 * 60_000) : null;
    // Aplazado: its reason and new date (a Timestamp), only while postponed.
    const postponed =
      sheet.status === "postponed"
        ? {
            ...(postponedReason?.trim() ? { postponedReason: postponedReason.trim() } : {}),
            postponedTo: typeof postponedTo === "number" ? Timestamp.fromMillis(postponedTo) : null,
          }
        : {};
    // Backend stamps that live outside the sheet: who keeps la mesa, and the weather at kick-off (while
    // the kick-off is the same).
    const sameDate = exactMillis(old.get("date")) === sheet.date;
    const stamped = {
      ...(old.get("mesa") ? { mesa: old.get("mesa") } : {}),
      ...(sameDate && old.get("weatherAtKickoff") ? { weatherAtKickoff: old.get("weatherAtKickoff") } : {}),
    };
    // «Ha jugado de», over the full ledger (a member who comes on for a guest takes the guest's place); the
    // member rows in `ledger.players` are the same objects, so they get their positions too. With the board unreadable, a published acta keeps its stored positions and system
    // for each player whose stints and actions did not change, and estimates the rest; a first
    // publication has nothing stored, so it estimates.
    let system: string | null = null;
    // La alineación del partido (matchLineup.ts) wins over the board: its system, and each slot's code for
    // the seven (whoever comes on takes the code of whoever goes off). Only while it is the seven of these
    // titulares: an acta that changed them keeps no lineup, and falls back to the board.
    const storedLineup = parseMatchLineup(old.get("lineup"));
    const lineup = storedLineup && sameSeven(lineupSeven(storedLineup), sheet.starters) ? storedLineup : null;
    const present = parsePresent(old.get("present"));
    if (finished) {
      if (lineup) {
        withPositions(fullLedger.players, positionsPlayed(fullLedger.players, sheet.events, { board: lineupCodeByPlayer(lineup), main }));
        system = lineup.system;
      } else if (boardFailed && old.get("status") === "finished") {
        keepStoredPositions(fullLedger.players, old.get("ledger"), positionsPlayed(fullLedger.players, sheet.events, { board: null, main }), swapsChanged(old.get("events"), sheet.events));
        system = typeof old.get("system") === "string" ? (old.get("system") as string) : null;
      } else {
        withPositions(fullLedger.players, positionsPlayed(fullLedger.players, sheet.events, { board: board?.codes ?? null, main }));
        system = board?.system ?? null;
      }
    }
    // Each player's nota of this acta, rated with the season's actas up to it and frozen with it; a correction keeps
    // the rival factor of its first publication. A rating that fails never blocks the acta (the web rates it then).
    let notas: ReturnType<typeof notasDoc> | null = null;
    if (finished)
      try {
        const self: RatingMatch = { ...publicSheet, id: input.id, date: sheet.date, status: "finished", events: publicNarrationEvents(sheet.events), ledger: ledger.players };
        notas = notasDoc(frozenNotas(self, seasonGames, table, parseStoredNotas(old.get("notas"))?.rival ?? null), Date.now());
      } catch (error) {
        console.error("saveMatchSheet: the notas could not be rated, the acta goes without them", input.id, error);
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
    // An amended lineup may remove a previously eligible MVP candidate. While the vote is open only the
    // turnout is public (mvpLogic.ts).
    const valid = finished ? ledger.players : {};
    writeNarrationHistory();
    for (const vote of votes.docs) if (!valid[vote.get("playerId")]?.played) tx.delete(vote.ref);
    const tally = tallyVotes(valid, votes.docs.map((v) => v.data()));
    tx.set(db.doc(`mvpResults/${input.id}`), mvpDoc(tally, voteClosesAt, Date.now(), eligible));
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
      events: publicNarrationEvents(sheet.events),
      ...(sheet.analysis ? { analysis: { ...sheet.analysis, revision: sheet.analysis.revision + 1 } } : {}),
      ...stamps,
      ...stamped,
      ...postponed,
      // (the lineup and the roll call live outside the sheet: a save keeps them)
      ...(lineup ? { lineup } : {}),
      ...(present ? { present } : {}),
      clock: old.get("clock") ?? readyClock(),
      ...(typeof old.get("liveEndedAt") === "number" && exactMillis(old.get("date")) === sheet.date ? { liveEndedAt: old.get("liveEndedAt") } : {}),
      date: Timestamp.fromMillis(sheet.date),
      revision: (sheet.revision ?? 0) + 1,
      goalsFor: finished ? sheet.goalsFor : null,
      goalsAgainst: finished ? sheet.goalsAgainst : null,
      ledger: finished ? ledger.players : {},
      ...(notas ? { notas } : {}),
      system,
      voteClosesAt,
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
}
