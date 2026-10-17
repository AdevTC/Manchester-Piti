// La alineación del partido (matchLineup.ts), the server half: «Mandar a la mesa» from the pizarra
// (setMatchLineup) and the mesa's «¿Quién ha venido?» (setMatchPresent). Admins and the match's scorers,
// only before kick-off (clock `ready`, or none yet).
//
// setMatchLineup, in ONE transaction: match.lineup, the convocatoria it leaves (convocatoriaOf) and the
// match's official board carrying the same seven (copied onto it, or the sent board becomes the official
// the way the web's publishOfficial does). Notices: only the official board's own trigger (pushOnLineup:
// «Ya está el siete» or «Cambio en el siete») tells the team. The match write stamps `convocatoriaAt`,
// so pushOnMatch never adds a «Ya está la convocatoria» for the same seven (a convocatoria managed by a
// callable is never announced by the trigger); a later «Convocar y avisar» still tells what changed.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { playerRefSchema } from "./eventSchema.js";
import { isGuestId, isUnknownGuest, type MatchGuest } from "./guests.js";
import { requireScorer } from "./liveClock.js";
import { notCalledOf } from "./convocatoriaLogic.js";
import { findOfficialBoard, type BoardDb } from "./officialBoard.js";
import { convocatoriaOf, lineupFromBoard, lineupSeven, parseMatchLineup, parsePresent, sameLineup, type MatchLineup, type SetMatchLineupResult } from "./matchLineup.js";
import type { BoardLike } from "./boardCodes.js";
import { requireActiveMatch, runMatchTransaction } from "./matchAccess.js";

/** The most players a roll call can name (a season's squad and the match's guests). */
export const MAX_PRESENT = 40;

const lineupInput = z.object({ matchId: idSchema, boardId: idSchema });
const presentInput = z.object({ matchId: idSchema, present: z.array(playerRefSchema).max(MAX_PRESENT, `Como mucho ${MAX_PRESENT} jugadores.`) });

type Snap = FirebaseFirestore.DocumentSnapshot;
type BoardQuery = ReturnType<BoardDb["collection"]>;

/** findOfficialBoard's reads, inside a transaction (so the board it finds is locked with the match). */
function txBoardDb(tx: FirebaseFirestore.Transaction): BoardDb {
  const wrap = (q: FirebaseFirestore.Query): BoardQuery => ({ where: (field, op, value) => wrap(q.where(field, op, value)), get: () => tx.get(q) });
  return { doc: (path) => ({ get: () => tx.get(db.doc(path)) }), collection: (path) => wrap(db.collection(path)) };
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set([...a, ...b]).size === new Set(a).size;
/** `lineupOfficials/{scope}`: the season's official is «temporada». */
const scopeId = (seasonId: string, matchId: string | null) => `${seasonId}__${matchId ?? "temporada"}`;

/** The match before kick-off, published, active and not closed: the one checks both callables share. */
async function openMatch(tx: FirebaseFirestore.Transaction, matchId: string, match: Snap): Promise<{ seasonId: string; guests: MatchGuest[] }> {
  if (!match.exists) throw new HttpsError("not-found", "Ese partido no existe.");
  await requireActiveMatch(tx, matchId, match);
  const status = match.get("status") as string | undefined;
  if (status === "finished") throw new HttpsError("failed-precondition", "Ese partido ya se jugó: su alineación queda cerrada.");
  if (status === "cancelled" || status === "postponed") throw new HttpsError("failed-precondition", "Este partido no se va a jugar.");
  if (match.get("clock") && match.get("clock.phase") !== "ready") throw new HttpsError("failed-precondition", "El partido ya ha empezado: el siete cambia con las sustituciones de la mesa.");
  const seasonId = match.get("seasonId");
  if (typeof seasonId !== "string" || !seasonId) throw new HttpsError("failed-precondition", "El partido no tiene temporada.");
  const guests = Array.isArray(match.get("guests")) ? (match.get("guests") as MatchGuest[]) : [];
  return { seasonId, guests };
}

/** Why these ids can't play this match (null = they can): squad of the season, or a guest of the match. */
function playersProblem(players: readonly string[], roster: ReadonlySet<string>, guests: MatchGuest[]): string | null {
  if (players.some((id) => isUnknownGuest({ guests }, id))) return "Hay un invitado que no está en la lista de invitados del partido.";
  if (players.some((id) => !isGuestId(id) && !roster.has(id))) return "Hay jugadores que no son de la temporada de este partido.";
  return null;
}

export const setMatchLineup = onCall(async (req): Promise<SetMatchLineupResult> => {
  const actor = await memberAs(req);
  const data = parse(lineupInput, req.data);
  const matchRef = db.doc(`matches/${data.matchId}`);
  const draftRef = db.doc(`matchDrafts/${data.matchId}`);
  const sourceRef = db.doc(`lineups/${data.boardId}`);
  return runMatchTransaction(data.matchId, async (tx, { match, draft }) => {
    // ---- reads (all of them before the first write)
    await requireScorer(tx, data.matchId, actor);
    const { seasonId, guests } = await openMatch(tx, data.matchId, match);
    const source = await tx.get(sourceRef);
    const board = source.data();
    if (!source.exists || !board) throw new HttpsError("not-found", "Ese tablero ya no existe.");
    if (board.seasonId !== seasonId) throw new HttpsError("invalid-argument", "Ese tablero es de otra temporada.");
    const official = await findOfficialBoard(txBoardDb(tx), seasonId, data.matchId);
    if (!actor.isAdmin && board.ownerUid !== actor.uid && official?.id !== source.id)
      throw new HttpsError("permission-denied", "Solo puedes mandar el tablero oficial del partido o uno tuyo.");
    const next = lineupFromBoard(board as BoardLike);
    if (!next) throw new HttpsError("invalid-argument", "El tablero necesita siete jugadores distintos, uno en cada casilla.");
    const seven = lineupSeven(next);
    const players = await tx.get(db.collection("players").where("seasons", "array-contains", seasonId));
    const roster = players.docs.map((p) => p.id);
    const problem = playersProblem(seven, new Set(roster), guests);
    if (problem) throw new HttpsError("invalid-argument", problem);
    const lockRef = db.doc(`lineupOfficials/${scopeId(seasonId, data.matchId)}`);
    const lock = await tx.get(lockRef);
    // With no official for the match, the sent board becomes it, unless it is already the official of
    // another scope (the season's plan, another match): that one stays put and the match gets its copy.
    const copyRef = !official && board.isOfficial === true ? db.collection("lineups").doc() : null;

    // ---- what changes
    const old = parseMatchLineup(match.get("lineup"));
    const before = { starters: ids(match.get("starters")), bench: ids(match.get("bench")), notCalled: ids(match.get("notCalled")) };
    const conv = convocatoriaOf(seven, before, parsePresent(match.get("present")));
    const notCalled = notCalledOf(roster, conv);
    const officialId = official?.id ?? copyRef?.id ?? source.id;
    const convSame = sameList(before.starters, conv.starters) && sameList(before.bench, conv.bench) && sameSet(before.notCalled, notCalled);
    const officialSame = official ? official.id === source.id || sameLineup(lineupFromBoard(official.board), next) : false;
    const lockSame = lock.get("lineupId") === officialId;
    if (sameLineup(old, next) && old?.boardId === officialId && convSame && officialSame && lockSame)
      return { ok: true as const, changed: false, officialId, starters: conv.starters, bench: conv.bench };

    // ---- writes
    const now = Date.now();
    const lineup: MatchLineup = { ...next, boardId: officialId, setBy: actor.uid, setAt: now };
    const revision = (typeof match.get("revision") === "number" ? (match.get("revision") as number) : 0) + 1;
    const fields = { starters: conv.starters, bench: conv.bench, notCalled };
    // (the convocatoria's stamp: pushOnMatch leaves a callable's convocatoria to its own notices)
    tx.update(matchRef, { ...fields, lineup, ...(convSame ? {} : { convocatoriaAt: now }), revision, updatedAt: FieldValue.serverTimestamp() });
    // The draft keeps its own revision (the acta editor's base): only the convocatoria follows.
    if (draft.exists) tx.update(draftRef, fields);
    tx.set(db.collection("matchAudit").doc(), { matchId: data.matchId, revision, updatedBy: actor.uid, at: FieldValue.serverTimestamp(), lineup: { boardId: source.id, officialId } });
    const at = FieldValue.serverTimestamp();
    if (official && official.id !== source.id) {
      // The official carries the sent seven: its own trigger tells the team («Cambio en el siete»).
      const copy: Record<string, unknown> = { updatedAt: at };
      for (const key of ["formation", "freeMode", "slots", "playerPositions"] as const) copy[key] = board[key] ?? FieldValue.delete();
      if (board.bench !== undefined) copy.bench = board.bench;
      tx.update(db.doc(`lineups/${official.id}`), copy);
    } else if (copyRef) {
      // The season's (or another match's) official stays where it is: the match gets its own copy.
      const nickname = actor.profile.get("nickname");
      const { reactions: _r, ...rest } = board;
      tx.set(copyRef, { ...rest, ownerUid: actor.uid, ownerNickname: typeof nickname === "string" && nickname ? nickname : board.ownerNickname, name: "Siete del partido", isOfficial: true, matchId: data.matchId, createdAt: at, updatedAt: at });
    } else if (!official) {
      // No official yet: the sent board (the actor's own) becomes it («Ya está el siete»).
      tx.update(sourceRef, { isOfficial: true, matchId: data.matchId, updatedAt: at });
    }
    if (!lockSame) tx.set(lockRef, { lineupId: officialId, seasonId, matchId: data.matchId, at });
    return { ok: true as const, changed: true, officialId, starters: conv.starters, bench: conv.bench };
  });
});

export const setMatchPresent = onCall(async (req): Promise<{ ok: true }> => {
  const actor = await memberAs(req);
  const data = parse(presentInput, req.data);
  const present = [...new Set(data.present)];
  await runMatchTransaction(data.matchId, async (tx, { match }) => {
    await requireScorer(tx, data.matchId, actor);
    const { seasonId, guests } = await openMatch(tx, data.matchId, match);
    const players = await tx.get(db.collection("players").where("seasons", "array-contains", seasonId));
    const problem = playersProblem(present, new Set(players.docs.map((p) => p.id)), guests);
    if (problem) throw new HttpsError("invalid-argument", problem);
    tx.update(db.doc(`matches/${data.matchId}`), { present, updatedAt: FieldValue.serverTimestamp() });
  });
  return { ok: true };
});
