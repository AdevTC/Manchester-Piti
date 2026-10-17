// La mesa's «Publicar el acta»: an admin or one of the match's scorers publishes the acta from the live
// record (events, assists answered inline, lineup and minutes). Rival, date, season and convocatoria
// stay as stored (they are the editor's, admin-only). Under the hood it is saveMatchSheet's pipeline
// (publishSheet): ledger, «Ha jugado de», season totals, MVP vote and porra. Reopening a published
// acta stays admin-only (the editor).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, memberAs, parse } from "./common.js";
import { playerRefSchema } from "./eventSchema.js";
import { isGuestId } from "./guests.js";
import { requireScorer } from "./liveClock.js";
import { calculateLedger, dateMillis, isPendingDup, type MatchEvent, type MatchSheet } from "./matchEngine.js";
import { publishSheet, sheetSchema } from "./publishSheet.js";

const GOALS = new Set<string>(["goal", "goal_penalty", "goal_freekick"]);
const input = z.object({
  matchId: idSchema,
  /** eventId → who gave the pass ("" = nobody). */
  assists: z
    .record(z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/), z.union([playerRefSchema, z.literal("")]))
    .refine((r) => Object.keys(r).length <= 100, { message: "Demasiadas asistencias en una sola publicación." })
    .optional(),
});

/** The object without its `undefined` keys. */
const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Why the live record can't be published yet, in words; null when it can. */
export function liveReadyProblem(m: { status?: string; clock?: { phase?: string }; events?: readonly MatchEvent[] }): string | null {
  if (m.status === "finished") return "El acta ya está publicada. Solo un administrador puede reabrirla desde el editor.";
  if (m.status === "cancelled" || m.status === "postponed") return "Este partido no se ha jugado: no tiene acta que publicar.";
  if (m.clock?.phase !== "ended") return "Pita el final antes de publicar el acta.";
  if ((m.events ?? []).some(isPendingDup)) return "Hay jugadas repetidas sin resolver («¿Es la misma jugada?»). Respóndelas antes de publicar el acta.";
  if ((m.events ?? []).some((e) => GOALS.has(e.type) && !e.playerId)) return "Falta quién marcó algún gol («Lo apunto luego»). Complétalo antes de publicar el acta.";
  return null;
}

export const publishLive = onCall(async (req) => {
  const actor = await memberAs(req);
  const data = parse(input, req.data);
  const id = data.matchId;
  const [snap, priv] = await db.getAll(db.doc(`matches/${id}`), db.doc(`matchPrivate/${id}`));
  if (!actor.isAdmin && !((priv.get("scorerUids") ?? []) as string[]).includes(actor.uid))
    throw new HttpsError("permission-denied", "Solo administradores y anotadores designados para este partido.");
  if (!snap.exists) throw new HttpsError("not-found", "Ese partido no existe.");
  const m = snap.data() as Record<string, unknown> & { status?: string; clock?: { phase?: string }; events?: MatchEvent[]; starters?: string[]; bench?: string[]; seasonId?: string; revision?: number };
  const problem = liveReadyProblem(m);
  if (problem) throw new HttpsError("failed-precondition", problem);
  // The assists answered on Final («¿Le dio el pase alguien?»); any goal still unanswered goes without one.
  const events: MatchEvent[] = (m.events ?? []).map((e) => ({ ...e }));
  for (const [eventId, who] of Object.entries(data.assists ?? {})) {
    const e = events.find((x) => x.id === eventId);
    if (!e) throw new HttpsError("aborted", "Una de esas jugadas ya no está. Revisa las jugadas y vuelve a publicar.");
    if (!GOALS.has(e.type)) throw new HttpsError("invalid-argument", "Las asistencias solo van en los goles del Piti.");
    if (who === "") delete e.assistPlayerId;
    else e.assistPlayerId = who;
    e.assistReviewed = true;
  }
  for (const e of events) if (GOALS.has(e.type) && e.assistReviewed === false) e.assistReviewed = true;
  // Everyone in the season has a situation: who wasn't called this time is «no convocado».
  const seasonId = m.seasonId ?? "";
  const roster = seasonId ? await db.collection("players").where("seasons", "array-contains", seasonId).get() : null;
  const starters = m.starters ?? [], bench = m.bench ?? [];
  const called = new Set([...starters, ...bench]);
  const notCalled = (roster?.docs ?? []).map((d) => d.id).filter((pid) => !called.has(pid) && !isGuestId(pid));
  const base = {
    version: 2 as const,
    revision: m.revision ?? 0,
    seasonId,
    rival: m.rival,
    rivalLogoUrl: m.rivalLogoUrl,
    rivalInitials: m.rivalInitials,
    rivalShort: m.rivalShort,
    competition: m.competition,
    // exact ms (a Timestamp's toMillis): the pipeline keeps the whistle's liveEndedAt when the date is unchanged
    date: typeof (m.date as { toMillis?: unknown } | undefined)?.toMillis === "function" ? (m.date as { toMillis: () => number }).toMillis() : dateMillis(m.date),
    duration: m.duration,
    durationSeconds: m.durationSeconds,
    analysisCoverage: m.analysisCoverage,
    analysisNotes: m.analysisNotes,
    venue: m.venue ?? "",
    home: m.home,
    status: "finished" as const,
    starters,
    bench,
    notCalled,
    guests: m.guests,
    events,
    report: m.report ?? "",
    photoUrl: m.photoUrl,
    gallery: m.gallery,
    meetingNote: priv.get("meetingNote"),
    kit: m.kit,
  };
  const score = calculateLedger({ starters, bench, notCalled, events, guests: base.guests as MatchSheet["guests"], duration: typeof base.duration === "number" ? base.duration : 50, durationSeconds: typeof base.durationSeconds === "number" ? base.durationSeconds : undefined });
  const parsed = sheetSchema.safeParse(compact({ ...base, goalsFor: score.goalsFor, goalsAgainst: score.goalsAgainst }));
  if (!parsed.success) throw new HttpsError("failed-precondition", `El acta en directo no se puede publicar así: ${parsed.error.issues.map((i) => i.message).join(" ")}`);
  await publishSheet({
    id,
    sheet: parsed.data as MatchSheet,
    draft: false,
    uid: actor.uid,
    staleMessage: "La mesa ha cambiado mientras publicabas. Revisa las jugadas y vuelve a publicar.",
    guard: async (tx, old) => {
      await requireScorer(tx, id, actor);
      const again = liveReadyProblem(old.data() ?? {});
      if (again) throw new HttpsError("failed-precondition", again);
    },
  });
  return { ok: true, goalsFor: score.goalsFor, goalsAgainst: score.goalsAgainst };
});
