// «Cambio en el siete»: the official's seven changes after it was published. The team is told who comes in
// and who goes out, at most once per board every 10 minutes: the first change goes at once, the ones that
// follow within the window wait (pushLog/seven-<board>.pending) and the 5-minute job (reminders.ts) sends
// them together, from the seven the team was last told about (the baseline) to the one there is then.
// Only to the subscribers of the «lineup» topic. The sending is passed in (push.ts sendTo).
import { type DocumentData, type Timestamp } from "firebase-admin/firestore";
import { db } from "./common.js";
import { sevenChangeNotice, sevenDiff, sevenNewsworthy, sevenOf, sevenStep, SEVEN_DEBOUNCE_MS, type LineupLike, type MatchLike, type Notice } from "./pushLogic.js";

type Send = (n: Notice) => Promise<void>;

const logRef = (id: string) => db.doc(`pushLog/seven-${id}`);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ids = (v: unknown): string[] | null => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null);

const asMatch = (d: DocumentData | undefined): MatchLike | null =>
  d ? { rival: d.rival, status: d.status, archived: d.archived, date: (d.date as Timestamp | undefined)?.toMillis?.() } : null;
async function matchOf(mid: string | null | undefined): Promise<MatchLike | null> {
  return mid ? asMatch((await db.doc(`matches/${mid}`).get()).data()) : null;
}
async function namesOf(pids: string[]): Promise<(id: string) => string> {
  const docs = await Promise.all(pids.map((p) => db.doc(`players/${p}`).get()));
  const m = new Map(docs.map((p) => [p.id, (p.get("shirtName") as string) || [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ") || "Jugador"]));
  return (id) => m.get(id) ?? "Jugador";
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
  const notice = sevenChangeNotice(id, baseline, now7, after, match, await namesOf([...d2.ins, ...d2.outs]));
  if (notice) await send(notice);
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
    const notice = sevenChangeNotice(id, baseline, now7, board, match, await namesOf([...d.ins, ...d.outs]));
    if (notice) await send(notice);
  }
}
