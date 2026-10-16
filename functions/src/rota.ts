// Turnos del equipo, the server's part: when a match's convocatoria is published («Convocar y avisar», or
// a match published with its titulares), the member whose turn it is gets «Te toca lavar la equipación
// tras el partido del sábado» — once per match and job (pushLog `rota-<match>-<job>`, deliver), to his
// own devices (playerLinks gives the member of a player) and in his centro de avisos (sendTo). The turn is
// the one the web shows: rotaLogic.turnsFor over the season's completed matches, their answers, the
// team's absences and the captains' overrides. Never in the way of the convocatoria: errors are logged.
import { db } from "./common.js";
import { deliver } from "./push.js";
import { parseRota, parseRotaTurns, rotaNotice, turnsFor, type RotaAnswer, type RotaMatch } from "./rotaLogic.js";

const millis = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
};
const asRotaMatch = (id: string, d: FirebaseFirestore.DocumentData | undefined): RotaMatch => ({
  id,
  date: millis(d?.date),
  home: d?.home === true,
  status: d?.status,
  seasonId: typeof d?.seasonId === "string" ? d.seasonId : undefined,
});

export async function notifyRota(matchId: string, now = Date.now()): Promise<void> {
  try {
    const snap = await db.doc(`matches/${matchId}`).get();
    if (!snap.exists || snap.get("archived") === true || snap.get("status") !== "scheduled") return;
    const match = asRotaMatch(matchId, snap.data());
    if (!match.seasonId || match.date === null || match.date <= now) return;
    const rota = parseRota((await db.doc(`rotas/${match.seasonId}`).get()).data());
    if (!rota?.jobs.length) return;
    const season = await db.collection("matches").where("seasonId", "==", match.seasonId).get();
    const played = season.docs.filter((d) => d.get("archived") !== true).map((d) => asRotaMatch(d.id, d.data()));
    // (the answers of the matches that count, and of this one)
    const ids = [...played.filter((m) => m.status === "finished").map((m) => m.id), matchId];
    const availability: Record<string, RotaAnswer[]> = {};
    await Promise.all(
      ids.map(async (id) => {
        const answers = await db.collection(`matchPrivate/${id}/availability`).get();
        availability[id] = answers.docs.map((a) => ({ playerId: a.get("playerId") ?? null, response: a.get("response") }));
      }),
    );
    const absences = (await db.collection("absences").get()).docs.map((a) => ({ playerId: (a.get("playerId") as string | null) ?? null, from: String(a.get("from") ?? ""), to: String(a.get("to") ?? "") }));
    const pinned = parseRotaTurns((await db.doc(`rotaTurns/${matchId}`).get()).data());
    const turns = turnsFor(match, rota, played, availability, absences, pinned);
    const rival = typeof snap.get("rival") === "string" ? (snap.get("rival") as string) : undefined;
    for (const t of turns) {
      if (!t.playerId) continue;
      const uid = (await db.doc(`playerLinks/${t.playerId}`).get()).get("uid");
      if (typeof uid !== "string" || !uid) continue;
      await deliver(rotaNotice(matchId, t.job, { date: match.date, rival }, now), uid);
    }
  } catch (e) {
    console.error("notifyRota", matchId, e);
  }
}
