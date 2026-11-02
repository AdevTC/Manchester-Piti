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
import { jornadaOf, type JornadaMatch } from "./jornada.js";
import { archivedMatch } from "./matchAccess.js";
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
  // (every field the numbering reads — published, archived, individuallyArchived, deleting, status — as the web)
  return jornadaOf(all.docs.map((d) => ({ ...(d.data() as JornadaMatch), id: d.id })), matchId);
}

/** The public snapshot of a board (reads its players, its match and the jornada). */
export async function buildFanBoard(board: R14Board) {
  const ids = sevenOf(board.slots).filter((id) => !id.startsWith("guest:"));
  const snaps = ids.length ? await db.getAll(...ids.map((id) => db.doc(`players/${id}`))) : [];
  const players = new Map<string, FanPlayerSource>(snaps.filter((s) => s.exists).map((s) => [s.id, s.data() as FanPlayerSource]));
  const mid = typeof board.matchId === "string" && board.matchId ? board.matchId : null;
  const match = mid ? (await db.doc(`matches/${mid}`).get()).data() : undefined;
  const live = match && !archivedMatch(match) && match.published !== false && match.deleting !== true ? match : null;
  const jornada = mid && live && typeof board.seasonId === "string" ? await seasonJornada(board.seasonId, mid) : null;
  const guests = Array.isArray(live?.guests) ? (live.guests as { id: string; name: string }[]) : [];
  return fanBoardOf(board, { players, guests, match: live ? { rival: live.rival, date: live.date, venue: live.venue ?? live.location, home: live.home } : null, jornada, now: Date.now() });
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
  const mid = typeof after.matchId === "string" && after.matchId ? after.matchId : null;
  if (stamp) {
    const done = await db.runTransaction(async (tx) => {
      const cur = (await tx.get(ref)).data() as R14Board | undefined;
      // (PZ-D04: the first seven published for a match closes «Adivina el siete» for good — a one-way flag the
      // rules read; unpublishing deletes the scope doc but never this)
      const priv = cur?.isOfficial && mid ? await tx.get(db.doc(`matchPrivate/${mid}`)) : null;
      // (a newer write already moved it: that write's own run stamps it)
      if (!cur?.isOfficial || (cur.sevenKey ?? null) !== (after.sevenKey ?? null) || (cur.sevenRev ?? 0) !== (after.sevenRev ?? 0)) return false;
      if (stable(sevenOf(cur.slots).sort()) !== stable(sevenOf(after.slots).sort())) return false;
      if (priv && priv.get("sieteOutAt") == null && (cur.matchId ?? null) === mid) tx.set(priv.ref, { sieteOutAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(ref, { sevenKey: stamp.sevenKey, sevenRev: stamp.sevenRev });
      return true;
    });
    if (done && stamp.bumped) {
      // Old reactions go — but one given since this write (the second before the stamp, still at the old version)
      // answers this seven: it is kept and moved to the new version.
      // (the write's time, less REACTION_GRACE_MS: the emulator's and the server's clocks for a commit and its
      // serverTimestamp may differ by a few ms; a reaction to the old seven needed to be given before it)
      const written = event.data?.after.updateTime?.toMillis() ?? Date.parse(event.time);
      const since = Number.isFinite(written) ? written - REACTION_GRACE_MS : Infinity;
      const snap = await ref.collection("reactions").get();
      for (const r of snap.docs) {
        if (reactionCurrent(r.data(), { sevenRev: stamp.sevenRev })) continue;
        const at = r.get("at");
        const ms = at && typeof at.toMillis === "function" ? (at.toMillis() as number) : -Infinity;
        await (ms >= since ? r.ref.update({ rev: stamp.sevenRev }) : r.ref.delete()).catch(() => undefined);
      }
    }
  }

  // ── PZ-D21T: the history (in a transaction that re-reads the board: a run landing after the board's delete —
  // and after its cascade — writes nothing, so no history is left under a deleted board)
  const kind = historyKind(before, after);
  if (kind) {
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists) return;
      const now = Date.now();
      const existing = await tx.get(ref.collection("history").orderBy("at", "desc").limit(30));
      const plan = historyPlan(existing.docs.map((d) => ({ id: d.id, kind: d.get("kind"), at: d.get("at") })), kind, now);
      tx.set(plan.replace ? ref.collection("history").doc(plan.replace) : ref.collection("history").doc(), snapshotOf(after, kind, before, now));
      plan.drop.forEach((hid) => tx.delete(ref.collection("history").doc(hid)));
    });
  }

  // ── PZ-D21F: the fan view follows the board (fail-closed: writeFanBoard writes only what the board still is)
  const token = typeof after.fanToken === "string" && after.fanToken ? after.fanToken : null;
  if (token && (before?.fanToken !== token || fanFieldsChanged(before, after))) await writeFanBoard(id, token);
  if (typeof before?.fanToken === "string" && before.fanToken && before.fanToken !== token) await db.doc(`fanBoards/${before.fanToken}`).delete();
});

/** A reaction given this close before the write that bumped the seven's version still counts for the new one. */
export const REACTION_GRACE_MS = 2000;

const tokenOf = (b: R14Board | undefined): string | null => (typeof b?.fanToken === "string" && b.fanToken ? b.fanToken : null);

/**
 * Writes the fan view of board `id` at `token`, FAIL-CLOSED (a revoke, a new token or a delete racing with a
 * slow run never brings a public link back): the snapshot is built from a fresh read of the board, then a
 * transaction re-reads it and writes only when the board still exists, still carries `token` and has not
 * changed since the snapshot was built (its updateTime); otherwise nothing is written — and when the board
 * no longer carries `token`, any fan doc left at it is deleted. The fan doc keeps `boardId` and `boardAt` (the
 * board version it shows): the rules only serve it while the board still names that token. Returns whether it
 * wrote. A newer write of the board has its own trigger run, which writes the newer snapshot.
 */
export async function writeFanBoard(id: string, token: string): Promise<boolean> {
  const ref = db.doc(`lineups/${id}`);
  const fanRef = db.doc(`fanBoards/${token}`);
  const first = await ref.get();
  const board = first.data() as R14Board | undefined;
  if (!first.exists || !board || tokenOf(board) !== token) {
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      if (!cur.exists || tokenOf(cur.data() as R14Board) !== token) tx.delete(fanRef);
    });
    return false;
  }
  const at = first.updateTime?.toMillis() ?? 0;
  const fan = await buildFanBoard(board);
  return db.runTransaction(async (tx) => {
    const cur = await tx.get(ref);
    const old = await tx.get(fanRef);
    if (!cur.exists || tokenOf(cur.data() as R14Board) !== token) {
      tx.delete(fanRef);
      return false;
    }
    // (what the fans see moved on since this snapshot — that write's own run writes the newer one —, or a newer
    // snapshot is already there: leave it)
    if (fanFieldsChanged(board, cur.data() as R14Board)) return false;
    const now = cur.updateTime?.toMillis() ?? at;
    if (old.exists && typeof old.get("boardAt") === "number" && (old.get("boardAt") as number) > now) return false;
    tx.set(fanRef, { ...fan, boardId: id, boardAt: now });
    return true;
  });
}

const fanInput = z.object({ boardId: idSchema, on: z.boolean(), rotate: z.boolean().optional() });

/** The board's fan link: `on` makes (or keeps) it and returns its token — `rotate` gives it a new token (the old
 *  link stops working at once); off deletes it. The board's owner or a captain. Errors: not-found (no board),
 *  permission-denied (not yours), failed-precondition (no seven). The token changes in one transaction with the
 *  old fan doc's deletion; the new fan doc is then written fail-closed (writeFanBoard). */
export const setBoardFanLink = onCall(async (req): Promise<{ ok: true; token: string | null }> => {
  const actor = await memberAs(req);
  const { boardId, on, rotate } = parse(fanInput, req.data);
  const ref = db.doc(`lineups/${boardId}`);
  const token = await db.runTransaction(async (tx): Promise<string | null> => {
    const snap = await tx.get(ref);
    const board = snap.data() as R14Board | undefined;
    if (!snap.exists || !board) throw new HttpsError("not-found", "Ese tablero ya no existe.");
    if (!actor.isAdmin && board.ownerUid !== actor.uid) throw new HttpsError("permission-denied", "Solo el dueño del tablero o un capitán comparte su enlace para la afición.");
    const old = tokenOf(board);
    if (!on || rotate) {
      if (old) tx.delete(db.doc(`fanBoards/${old}`));
      if (!on) {
        if (old) tx.update(ref, { fanToken: FieldValue.delete() });
        return null;
      }
    }
    if (sevenOf(board.slots).length === 0) throw new HttpsError("failed-precondition", "Pon al menos un jugador en el siete antes de compartirlo.");
    if (old && !rotate) return old;
    const next = fanTokenOf(randomBytes(24));
    tx.update(ref, { fanToken: next });
    return next;
  });
  // (the trigger of the token's write writes it too: whichever runs first, both only write the board's current state)
  if (token && !(await writeFanBoard(boardId, token)) && !(await db.doc(`fanBoards/${token}`).get()).exists) {
    // (the board changed while it was being built: once more, from its newest state)
    await writeFanBoard(boardId, token);
  }
  return { ok: true, token };
});
