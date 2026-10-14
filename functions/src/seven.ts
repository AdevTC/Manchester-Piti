// «Cambio en el siete»: the official's seven changes after it was published. The team is told who comes in
// and who goes out, at most once per board every 10 minutes: the first change goes at once, the ones that
// follow within the window wait (pushLog/seven-<board>.pending) and the 5-minute job (reminders.ts) sends
// them together, from the seven the team was last told about (the baseline) to the one there is then.
// Only to the subscribers of the «lineup» topic. The sending is passed in (push.ts sendTo).
import { type DocumentData, type Timestamp } from "firebase-admin/firestore";
import { db } from "./common.js";
import { nameFor } from "./names.js";
import { parseSiete, sevenChangeNotice, sevenDiff, sevenNewsworthy, sevenOf, sevenStep, sieteKey, sieteLog, sieteStep, SEVEN_DEBOUNCE_MS, type LineupLike, type MatchLike, type Notice, type SieteAsk } from "./pushLogic.js";

type Send = (n: Notice) => Promise<void>;

const logRef = (id: string) => db.doc(`pushLog/seven-${id}`);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ids = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

const asMatch = (d: DocumentData | undefined): MatchLike | null =>
  d ? { rival: d.rival, status: d.status, archived: d.archived, seasonId: d.seasonId, date: (d.date as Timestamp | undefined)?.toMillis?.() } : null;
async function matchOf(mid: string | null | undefined): Promise<MatchLike | null> {
  return mid ? asMatch((await db.doc(`matches/${mid}`).get()).data()) : null;
}
/** The players named by their shirt name in `seasonId` (the match's season, else the board's), like the web. */
async function namesOf(pids: string[], seasonId: string | undefined): Promise<(id: string) => string> {
  const docs = await Promise.all(pids.map((p) => db.doc(`players/${p}`).get()));
  const m = new Map(docs.map((p) => [p.id, nameFor(p.data(), seasonId)]));
  return (id) => m.get(id) ?? "Jugador";
}

/**
 * One «siete» per match (pushLogic sieteStep): runs the step on `pushLog/siete-<match>` in a transaction
 * (the publish's trigger and the convocatoria's call may race) and says whether the asker's notice goes.
 */
export async function claimSiete(matchId: string, ask: SieteAsk, now = Date.now()): Promise<boolean> {
  const ref = db.doc(`pushLog/${sieteLog(matchId)}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const step = sieteStep(snap.exists ? parseSiete(snap.data()) : null, ask, now);
    if (step.write) tx.set(ref, step.write);
    return step.send;
  });
}

/**
 * «Cambio en el siete» goes: for a match's official it also tells the team that match's seven, so it takes
 * the one-siete claim (as «Ya está el siete» does) — a convocatoria «Cambios» right after, calling the same
 * players with this seven, has nothing new to say.
 */
async function sendChange(id: string, board: LineupLike, now7: string[], notice: Notice, send: Send): Promise<void> {
  if (board.matchId) await claimSiete(board.matchId, { by: "lineup", board: id, seven: sieteKey(now7) });
  await send(notice);
}

/** A board has just become the official: what the team was told about is this seven. */
export async function sevenPublished(id: string, after: LineupLike): Promise<void> {
  await logRef(id).set({ baseline: sevenOf(after.slots), sentAt: Date.now(), pending: false });
}

/** An official that stays official was saved: if its seven changed, tell the team (or hold it). */
export async function sevenEdited(id: string, before: LineupLike, after: LineupLike, send: Send): Promise<void> {
  const was = sevenOf(before.slots);
  const now7 = sevenOf(after.slots);
  const d = sevenDiff(was, now7);
  if (!d.ins.length && !d.outs.length) return;
  const match = await matchOf(after.matchId);
  if (!sevenNewsworthy(after, match, Date.now())) return;
  const baseline = await db.runTransaction(async (tx) => {
    const snap = await tx.get(logRef(id));
    const now = Date.now();
    // (an official published before these notices: what the team saw is the seven before this save)
    const base = (snap.exists ? ids(snap.get("baseline")) : null) ?? was;
    const last = snap.exists ? num(snap.get("sentAt")) : null;
    if (sevenStep(last, now) === "hold") {
      tx.set(logRef(id), { baseline: base, sentAt: last, pending: true });
      return null;
    }
    tx.set(logRef(id), { baseline: now7, sentAt: now, pending: false });
    return base;
  });
  if (!baseline) return;
  const d2 = sevenDiff(baseline, now7);
  const notice = sevenChangeNotice(id, baseline, now7, after, match, await namesOf([...d2.ins, ...d2.outs], match?.seasonId ?? after.seasonId));
  if (notice) await sendChange(id, after, now7, notice, send);
}

/** The job: the held changes whose window is over go now, grouped (a seven changed back says nothing). */
export async function flushSevens(now: number, send: Send): Promise<void> {
  const held = await db.collection("pushLog").where("pending", "==", true).get();
  for (const h of held.docs) {
    const last = num(h.get("sentAt"));
    if (last != null && now - last < SEVEN_DEBOUNCE_MS) continue;
    const id = h.id.replace(/^seven-/, "");
    const board = (await db.doc(`lineups/${id}`).get()).data() as LineupLike | undefined;
    const match = board?.isOfficial ? await matchOf(board.matchId) : null;
    const live = !!board && sevenNewsworthy(board, match, now);
    const now7 = board ? sevenOf(board.slots) : [];
    // claim it (another run may be at it too)
    const baseline = await db.runTransaction(async (tx) => {
      const snap = await tx.get(h.ref);
      if (snap.get("pending") !== true) return null;
      const base = ids(snap.get("baseline")) ?? [];
      tx.set(h.ref, { baseline: live ? now7 : base, sentAt: live ? now : last, pending: false });
      return live ? base : null;
    });
    if (!baseline || !board) continue;
    const d = sevenDiff(baseline, now7);
    const notice = sevenChangeNotice(id, baseline, now7, board, match, await namesOf([...d.ins, ...d.outs], match?.seasonId ?? board.seasonId));
    if (notice) await sendChange(id, board, now7, notice, send);
  }
}
