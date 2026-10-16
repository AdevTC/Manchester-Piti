// Turnos del equipo, the server's part (rotaLogic.ts has the rules).
//
// The freeze: once a match is played, its turns are written into `rotaTurns/{matchId}` with
// `{ seasonId, frozen: true }` (the doc-level flag; only the backend sets it, firestore.rules). That is the
// real history the next turns read. It happens when the match is finished or its clock ends (pushOnMatch),
// and lazily before a later match's convocatoria is processed (notifyRota): every earlier, played,
// unfrozen match of the season, oldest first. A captain's entries (a pin, «Lo hizo otro») stay as he set
// them; each match is frozen in a transaction with its doc, so a pin written meanwhile is never lost.
//
// The notice: when a match's convocatoria is published, the member whose turn it is gets «Te toca lavar la
// equipación tras el partido del sábado»; when a captain pins or swaps a turn of that upcoming match, the
// newly assigned member gets it too. Once per match, job and member (pushLog `rota-<match>-<job>-<player>`,
// deliver), personal (his own devices and his centro de avisos, never a fan). Never in the way of the
// convocatoria: errors are logged.
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { db } from "./common.js";
import { madridDate } from "./madrid.js";
import { deliver } from "./push.js";
import { parseRota, parseRotaTurns, playedEntry, rotaNotice, rotaPast, rotaPlayed, turnsFor, type PlayedTurns, type Rota, type RotaAbsence, type RotaAnswer, type RotaMatch, type RotaTurnsDoc } from "./rotaLogic.js";

const millis = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
};
const asRotaMatch = (id: string, d: DocumentData | undefined): RotaMatch => ({
  id,
  date: millis(d?.date),
  home: d?.home === true,
  status: d?.status,
  seasonId: typeof d?.seasonId === "string" ? d.seasonId : undefined,
});

/** A match's answers and the absences that may cover its Madrid day (never the whole collection). */
async function outsOf(m: RotaMatch): Promise<{ answers: RotaAnswer[]; absences: RotaAbsence[] }> {
  const answers = (await db.collection(`matchPrivate/${m.id}/availability`).get()).docs.map((a) => ({ playerId: (a.get("playerId") as string | null | undefined) ?? null, response: a.get("response") }));
  if (m.date === null) return { answers, absences: [] };
  const day = madridDate(m.date);
  const absences = (await db.collection("absences").where("to", ">=", day).get()).docs
    .map((a) => ({ playerId: (a.get("playerId") as string | null | undefined) ?? null, from: String(a.get("from") ?? ""), to: String(a.get("to") ?? "") }))
    .filter((a) => a.from <= day);
  return { answers, absences };
}

interface Season {
  rota: Rota | null;
  matches: RotaMatch[];
  docs: Record<string, RotaTurnsDoc>;
}
async function loadSeason(seasonId: string): Promise<Season> {
  const [rota, matches, turns] = await Promise.all([db.doc(`rotas/${seasonId}`).get(), db.collection("matches").where("seasonId", "==", seasonId).get(), db.collection("rotaTurns").where("seasonId", "==", seasonId).get()]);
  return {
    rota: parseRota(rota.data()),
    matches: matches.docs.filter((d) => d.get("archived") !== true).map((d) => asRotaMatch(d.id, d.data())),
    docs: Object.fromEntries(turns.docs.map((d) => [d.id, parseRotaTurns(d.data())])),
  };
}

/** Freezes one played match (in a transaction with its doc; a doc already frozen is kept as it is). */
async function freezeOne(seasonId: string, m: RotaMatch, rota: Rota, history: readonly PlayedTurns[]): Promise<RotaTurnsDoc> {
  const outs = await outsOf(m);
  const ref = db.doc(`rotaTurns/${m.id}`);
  return db.runTransaction(async (tx) => {
    const doc = parseRotaTurns((await tx.get(ref)).data());
    if (doc.frozen) return doc;
    const turns = turnsFor(m, rota, history, outs.answers, outs.absences, doc);
    // (the captain's entries are left as he set them: only the computed ones are written)
    const computed = Object.fromEntries(turns.filter((t) => t.playerId && !t.pinned).map((t) => [t.job.id, { playerId: t.playerId, at: FieldValue.serverTimestamp() }]));
    tx.set(ref, { seasonId, frozen: true, ...computed }, { merge: true });
    return { frozen: true, turns: { ...doc.turns, ...Object.fromEntries(turns.filter((t) => t.playerId).map((t) => [t.job.id, { playerId: t.playerId as string, ...(t.swappedFrom ? { swappedFrom: t.swappedFrom } : {}) }])) } };
  });
}

/**
 * Freezes the season's played, unfrozen matches before `match` (and `match` itself with `inclusive`, when
 * it is played), oldest first. Returns the season as it is now (its docs updated) and the history before
 * `match`. Nothing is frozen without a rota with jobs.
 */
export async function freezeRota(match: RotaMatch, now: number, inclusive: boolean): Promise<Season & { history: PlayedTurns[] }> {
  const season = await loadSeason(match.seasonId as string);
  const { rota } = season;
  if (!rota?.jobs.length) return { ...season, history: [] };
  const past = rotaPast(match, season.matches, now);
  const history: PlayedTurns[] = [];
  for (const m of past) {
    if (!season.docs[m.id]?.frozen) season.docs[m.id] = await freezeOne(match.seasonId as string, m, rota, history);
    history.push(playedEntry(m, season.docs[m.id], rota, history));
  }
  if (inclusive && rotaPlayed(match, now) && !season.docs[match.id]?.frozen) season.docs[match.id] = await freezeOne(match.seasonId as string, match, rota, history);
  return { ...season, history };
}

/** pushOnMatch: a match just finished or its clock ended — its turns (and the earlier ones) are history. */
export async function freezeOnMatch(matchId: string, now = Date.now()): Promise<void> {
  try {
    const snap = await db.doc(`matches/${matchId}`).get();
    if (!snap.exists || snap.get("archived") === true) return;
    const match = asRotaMatch(matchId, snap.data());
    if (!match.seasonId || !rotaPlayed(match, now)) return;
    await freezeRota(match, now, true);
  } catch (e) {
    console.error("freezeOnMatch", matchId, e);
  }
}

/**
 * «Te toca…» to whoever's turn it is in an upcoming match (the convocatoria published, or a captain's pin
 * or swap): the earlier played matches are frozen first, so the turn is the one the web shows.
 */
export async function notifyRota(matchId: string, now = Date.now()): Promise<void> {
  try {
    const snap = await db.doc(`matches/${matchId}`).get();
    if (!snap.exists || snap.get("archived") === true || snap.get("status") !== "scheduled") return;
    const match = asRotaMatch(matchId, snap.data());
    if (!match.seasonId || match.date === null || match.date <= now) return;
    const season = await freezeRota(match, now, false);
    if (!season.rota?.jobs.length) return;
    const [outs, own] = await Promise.all([outsOf(match), db.doc(`rotaTurns/${matchId}`).get()]);
    const turns = turnsFor(match, season.rota, season.history, outs.answers, outs.absences, parseRotaTurns(own.data()));
    const rival = typeof snap.get("rival") === "string" ? (snap.get("rival") as string) : undefined;
    for (const t of turns) {
      if (!t.playerId) continue;
      const uid = (await db.doc(`playerLinks/${t.playerId}`).get()).get("uid");
      if (typeof uid !== "string" || !uid) continue;
      await deliver(rotaNotice(matchId, t.job, t.playerId, { date: match.date, rival }, now), uid);
    }
  } catch (e) {
    console.error("notifyRota", matchId, e);
  }
}

/**
 * A captain wrote a match's turns (rotaTurnsOnWrite, push.ts): when someone else now does a job of an
 * upcoming match whose convocatoria is out, the newly assigned member is told (notifyRota: once per
 * member). The backend's own freeze, and a match without its convocatoria yet, say nothing.
 */
export async function notifyRotaChange(matchId: string, before: DocumentData | undefined, after: DocumentData | undefined): Promise<void> {
  if (!after || after.frozen === true) return;
  const a = parseRotaTurns(after).turns;
  const b = parseRotaTurns(before).turns;
  if (!Object.keys({ ...a, ...b }).some((k) => a[k]?.playerId !== b[k]?.playerId)) return;
  if (!(await db.doc(`pushLog/conv-${matchId}`).get()).exists) return;
  await notifyRota(matchId);
}
