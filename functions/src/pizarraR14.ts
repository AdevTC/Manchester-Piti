// r14 · La pizarra, the server (the pure rules: pizarraR14Logic.ts; the contract: piti-diseno/src/pizarra/r14/
// impl/API.txt).
//
// onLineupR14 — one trigger per write of a board (lineups/{id}):
//   · PZ-D01: an official board carries `sevenKey` (who plays) and `sevenRev` (the seven's version). The version
//     moves when it is published and when its seven changes; the reactions given to an older version are
//     deleted (the rules only accept a reaction to the current one).
//   · PZ-D21T: a snapshot in lineups/{id}/history when the board is created or published, its sistema changes or
//     someone comes into the seven (≤ 20; a burst of the same change within 10 min is one snapshot).
//   · PZ-D21F: a board with a fan link refreshes its public snapshot (fanBoards/{token}) when what it shows changed.
//   · A deleted board takes its voz, reactions, history and fan view with it.
// setBoardFanLink — the fan link of a board, on or off (its owner or a captain).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { jornadaOf } from "./jornada.js";
import { sevenOf } from "./pushLogic.js";
import { fanBoardOf, fanTokenOf, historyKind, historyPlan, reactionCurrent, sevenStamp, snapshotOf, type FanPlayerSource, type R14Board } from "./pizarraR14Logic.js";

/** The fields the fan view shows: a write that changes none of them leaves the snapshot alone. */
const FAN_FIELDS = ["formation", "freeMode", "slots", "roles", "rival", "plan", "matchId", "isOfficial", "seasonId"] as const;
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object" && typeof (v as { toMillis?: unknown }).toMillis !== "function")
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const fanFieldsChanged = (a: R14Board | undefined, b: R14Board | undefined): boolean =>
  FAN_FIELDS.some((k) => stable((a as Record<string, unknown> | undefined)?.[k]) !== stable((b as Record<string, unknown> | undefined)?.[k]));

async function seasonJornada(seasonId: string, matchId: string): Promise<number | null> {
  const all = await db.collection("matches").where("seasonId", "==", seasonId).get();
  return jornadaOf(
    all.docs
      .filter((d) => d.get("archived") !== true)
      .map((d) => ({ id: d.id, seasonId: d.get("seasonId") as string | undefined, date: d.get("date") as unknown, status: d.get("status") as string | undefined })),
    matchId,
  );
}

/** The public snapshot of a board (reads its players, its match and the jornada). */
export async function buildFanBoard(board: R14Board) {
  const ids = sevenOf(board.slots).filter((id) => !id.startsWith("guest:"));
  const snaps = ids.length ? await db.getAll(...ids.map((id) => db.doc(`players/${id}`))) : [];
  const players = new Map<string, FanPlayerSource>(snaps.filter((s) => s.exists).map((s) => [s.id, s.data() as FanPlayerSource]));
  const mid = typeof board.matchId === "string" && board.matchId ? board.matchId : null;
  const match = mid ? (await db.doc(`matches/${mid}`).get()).data() : undefined;
  const live = match && match.archived !== true ? match : null;
  const jornada = mid && live && typeof board.seasonId === "string" ? await seasonJornada(board.seasonId, mid) : null;
  const guests = Array.isArray(live?.guests) ? (live.guests as { id: string; name: string }[]) : [];
  return fanBoardOf(board, { players, guests, match: live ? { rival: live.rival, date: live.date, venue: live.venue ?? live.location, home: live.home } : null, jornada, now: Date.now() });
}

async function deleteAll(q: FirebaseFirestore.Query, keep: (d: FirebaseFirestore.QueryDocumentSnapshot) => boolean = () => false): Promise<number> {
  const snap = await q.get();
  const gone = snap.docs.filter((d) => !keep(d));
  for (let i = 0; i < gone.length; i += 400) {
    const batch = db.batch();
    gone.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return gone.length;
}

export const onLineupR14 = onDocumentWritten({ document: "lineups/{lineupId}", maxInstances: 10 }, async (event) => {
  const id = event.params.lineupId;
  const ref = db.doc(`lineups/${id}`);
  const before = event.data?.before.data() as R14Board | undefined;
  const after = event.data?.after.data() as R14Board | undefined;

  // ── deleted: its subcollections and its fan view go with it
  if (!after) {
    if (!before) return;
    await db.recursiveDelete(ref);
    if (typeof before.fanToken === "string" && before.fanToken) await db.doc(`fanBoards/${before.fanToken}`).delete();
    return;
  }

  // ── PZ-D01: the official seven's version
  const stamp = sevenStamp(before, after);
  if (stamp) {
    const done = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data() as R14Board | undefined;
      // (a newer write already moved it: that write's own run stamps it)
      if (!cur?.isOfficial || (cur.sevenKey ?? null) !== (after.sevenKey ?? null) || (cur.sevenRev ?? 0) !== (after.sevenRev ?? 0)) return false;
      if (stable(sevenOf(cur.slots).sort()) !== stable(sevenOf(after.slots).sort())) return false;
      tx.update(ref, { sevenKey: stamp.sevenKey, sevenRev: stamp.sevenRev });
      return true;
    });
    if (done && stamp.bumped) await deleteAll(ref.collection("reactions"), (d) => reactionCurrent(d.data(), { sevenRev: stamp.sevenRev }));
  }

  // ── PZ-D21T: the history
  const kind = historyKind(before, after);
  if (kind) {
    const now = Date.now();
    const existing = await ref.collection("history").orderBy("at", "desc").limit(30).get();
    const plan = historyPlan(existing.docs.map((d) => ({ id: d.id, kind: d.get("kind"), at: d.get("at") })), kind, now);
    const batch = db.batch();
    batch.set(plan.replace ? ref.collection("history").doc(plan.replace) : ref.collection("history").doc(), snapshotOf(after, kind, before, now));
    plan.drop.forEach((hid) => batch.delete(ref.collection("history").doc(hid)));
    await batch.commit();
  }

  // ── PZ-D21F: the fan view follows the board
  const token = typeof after.fanToken === "string" && after.fanToken ? after.fanToken : null;
  if (token && (before?.fanToken !== token || fanFieldsChanged(before, after))) {
    await db.doc(`fanBoards/${token}`).set(await buildFanBoard(after));
  }
  if (typeof before?.fanToken === "string" && before.fanToken && before.fanToken !== token) await db.doc(`fanBoards/${before.fanToken}`).delete();
});

const fanInput = z.object({ boardId: idSchema, on: z.boolean() });

/** The board's fan link: `on` makes (or keeps) it and returns its token; off deletes it. The board's owner or a
 *  captain. Errors: not-found (no board), permission-denied (not yours), failed-precondition (no seven). */
export const setBoardFanLink = onCall(async (req): Promise<{ ok: true; token: string | null }> => {
  const actor = await memberAs(req);
  const { boardId, on } = parse(fanInput, req.data);
  const ref = db.doc(`lineups/${boardId}`);
  const snap = await ref.get();
  const board = snap.data() as R14Board | undefined;
  if (!snap.exists || !board) throw new HttpsError("not-found", "Ese tablero ya no existe.");
  if (!actor.isAdmin && board.ownerUid !== actor.uid) throw new HttpsError("permission-denied", "Solo el dueño del tablero o un capitán comparte su enlace para la afición.");
  const old = typeof board.fanToken === "string" && board.fanToken ? board.fanToken : null;
  if (!on) {
    if (old) {
      const batch = db.batch();
      batch.delete(db.doc(`fanBoards/${old}`));
      batch.update(ref, { fanToken: FieldValue.delete() });
      await batch.commit();
    }
    return { ok: true, token: null };
  }
  if (sevenOf(board.slots).length === 0) throw new HttpsError("failed-precondition", "Pon al menos un jugador en el siete antes de compartirlo.");
  const token = old ?? fanTokenOf(randomBytes(24));
  const fan = await buildFanBoard(board);
  const batch = db.batch();
  batch.set(db.doc(`fanBoards/${token}`), fan);
  if (!old) batch.update(ref, { fanToken: token });
  await batch.commit();
  return { ok: true, token };
});
