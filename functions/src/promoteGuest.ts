// r12 · M-41 «Darle de alta»: a guest who came to some matches gets his own ficha (created first, as any alta) and
// his matches as a guest become his: every `guest:gN` of him turns into his player id, he leaves the match's guest
// list, the matches' seasons join his `seasons`, and each published acta goes through publishSheet again (minutes,
// season stats, MVP, porra and notas recomputed the usual way). A match that is only a draft just changes its refs.
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { publishSheet, sheetSchema } from "./publishSheet.js";
import { dateMillis, type MatchSheet } from "./matchEngine.js";
import { requireActiveMatch, runMatchTransaction } from "./matchAccess.js";
import { promoteInMatch } from "./matchExtrasLogic.js";
import { PUBLICATION_RESOURCES } from "./publicationResources.js";

const input = z.object({
  playerId: idSchema,
  guests: z.array(z.object({ matchId: idSchema, guestId: z.enum(["g1", "g2", "g3", "g4"]) })).min(1).max(40),
});
const ms = (v: unknown): number => {
  const t = v as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : dateMillis(v);
};
/** Absent instead of null (the acta's schema takes optional fields, not nulls). */
const compact = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const LIVE = new Set(["first", "halftime", "second"]);

/** A published match as the acta it was published from (what saveMatchSheet takes), or why not. */
export function sheetOf(data: Record<string, unknown>, meetingNote: unknown): MatchSheet {
  const raw = compact({
    ...data,
    date: ms(data.date),
    revision: typeof data.revision === "number" ? data.revision : 0,
    postponedTo: data.postponedTo == null ? undefined : ms(data.postponedTo),
    meetingNote: typeof meetingNote === "string" ? meetingNote : undefined,
    goalsFor: data.status === "finished" ? data.goalsFor : undefined,
    goalsAgainst: data.status === "finished" ? data.goalsAgainst : undefined,
  });
  const parsed = sheetSchema.safeParse(raw);
  if (!parsed.success) throw new HttpsError("failed-precondition", `El acta contra ${String(data.rival ?? "el rival")} no se puede volver a publicar así: ${parsed.error.issues.map((i) => i.message).join(" ")}`);
  return parsed.data as MatchSheet;
}

export const promoteGuest = onCall({ ...PUBLICATION_RESOURCES, timeoutSeconds: 540 }, async (req) => {
  const uid = await admin(req);
  const data = parse(input, req.data);
  const player = await db.doc(`players/${data.playerId}`).get();
  if (!player.exists) throw new HttpsError("not-found", "Esa ficha no existe.");
  // ---- plan everything first: nothing is written if one of the matches can't take it
  const plans: { matchId: string; guestId: string; published: boolean; seasonId: string; rival: string }[] = [];
  for (const g of data.guests) {
    const [match, draft] = await db.getAll(db.doc(`matches/${g.matchId}`), db.doc(`matchDrafts/${g.matchId}`));
    const doc = match.exists ? match : draft;
    if (!doc.exists) throw new HttpsError("not-found", "Uno de esos partidos ya no existe.");
    const rival = String(doc.get("rival") ?? "el rival");
    const guests = (doc.get("guests") ?? []) as { id: string }[];
    if (!guests.some((x) => x.id === g.guestId)) throw new HttpsError("not-found", `Ese invitado ya no está en el partido contra ${rival}.`);
    if (match.exists && draft.exists) throw new HttpsError("failed-precondition", `El partido contra ${rival} tiene un borrador sin publicar: publícalo o descártalo antes.`);
    if (match.exists && LIVE.has(match.get("clock.phase"))) throw new HttpsError("failed-precondition", `El partido contra ${rival} se está jugando: dale de alta cuando acabe.`);
    plans.push({ matchId: g.matchId, guestId: g.guestId, published: match.exists, seasonId: String(doc.get("seasonId") ?? ""), rival });
  }
  const seasons = [...new Set(plans.map((p) => p.seasonId).filter(Boolean))];
  const seasonDocs = seasons.length ? await db.getAll(...seasons.map((s) => db.doc(`seasons/${s}`))) : [];
  const closed = seasonDocs.find((s) => !s.exists || s.get("archived") === true);
  if (closed) throw new HttpsError("failed-precondition", `${closed.exists ? `«${closed.get("name") ?? "Esa temporada"}» está archivada` : "Uno de esos partidos no tiene temporada"}: restáurala antes de darle de alta.`);
  // His seasons first: the acta only takes players of its season.
  if (seasons.length) await player.ref.update({ seasons: FieldValue.arrayUnion(...seasons), archived: FieldValue.delete() });
  for (const p of plans) {
    if (!p.published) {
      await runMatchTransaction(p.matchId, async (tx, { draft }) => {
        if (!draft.exists) throw new HttpsError("not-found", `El partido contra ${p.rival} ya no existe.`);
        await requireActiveMatch(tx, p.matchId, draft);
        const next = promoteInMatch(draft.data() ?? {}, p.guestId, data.playerId);
        if ("problem" in next) throw new HttpsError("not-found", `Ese invitado ya no está en el partido contra ${p.rival}.`);
        tx.update(draft.ref, next);
      });
      continue;
    }
    const [match, priv] = await db.getAll(db.doc(`matches/${p.matchId}`), db.doc(`matchPrivate/${p.matchId}`));
    const next = promoteInMatch(match.data() ?? {}, p.guestId, data.playerId);
    if ("problem" in next) throw new HttpsError("not-found", `Ese invitado ya no está en el partido contra ${p.rival}.`);
    const sheet = sheetOf({ ...(match.data() ?? {}), ...next }, priv.get("meetingNote"));
    // (the lineup and the roll call live outside the acta: they take him first, so the publication keeps them)
    const outside = Object.fromEntries((["lineup", "present"] as const).filter((k) => k in next).map((k) => [k, next[k]]));
    if (Object.keys(outside).length) await match.ref.update(outside);
    await publishSheet({ id: p.matchId, sheet, draft: false, uid });
  }
  await db.collection("matchAudit").add({ matchId: null, updatedBy: uid, at: FieldValue.serverTimestamp(), guestPromoted: { playerId: data.playerId, matches: plans.map((p) => `${p.matchId}:${p.guestId}`) } });
  return { matches: plans.length, seasons };
});
