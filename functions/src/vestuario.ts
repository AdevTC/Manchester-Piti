// Vestuario features: account ↔ player link (claim + admin approval), training date
// polls, the season porra and the team board. Everyday member writes (training votes,
// porra, board messages) go straight to Firestore under the rules; the rest lives here.
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, parse, memberAs, admin } from "./common.js";
import { predictionPoints, sortPorra, type PorraRow } from "./vestuarioLogic.js";

const DAY = 24 * 60 * 60_000;
const playerLabel = (p: FirebaseFirestore.DocumentSnapshot) =>
  (p.get("shirtName") as string | undefined) ||
  [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ") ||
  "Jugador";

// ---------- account ↔ player
export const requestPlayerClaim = onCall(async (req) => {
  const { playerId } = parse(z.object({ playerId: idSchema }), req.data);
  const [{ uid, profile }, player, link] = await Promise.all([
    memberAs(req),
    db.doc(`players/${playerId}`).get(),
    db.doc(`playerLinks/${playerId}`).get(),
  ]);
  if (!player.exists)
    throw new HttpsError("not-found", "Esa ficha no existe.");
  if (!profile.exists)
    throw new HttpsError("failed-precondition", "Crea tu perfil del vestuario primero.");
  if (profile.get("playerId") === playerId)
    throw new HttpsError("already-exists", "Esa ficha ya es tuya.");
  if (link.exists && link.get("uid") !== uid)
    throw new HttpsError("already-exists", "Esa ficha ya está vinculada a otro miembro.");
  await db.doc(`playerClaims/${uid}`).set({
    playerId,
    playerName: playerLabel(player),
    nickname: profile.get("nickname") ?? "",
    email: req.auth?.token.email ?? "",
    status: "pending",
    at: FieldValue.serverTimestamp(),
  });
  // Admins approve claims anyway: theirs link at once.
  const captain = ["admin", "superadmin"].includes(profile.get("role"));
  if (captain) await settleClaim(uid, true, uid);
  return { ok: true, linked: captain };
});

export const resolvePlayerClaim = onCall(async (req) => {
  const by = await admin(req);
  const { uid, approve } = parse(
    z.object({ uid: z.string().min(1).max(128), approve: z.boolean() }),
    req.data,
  );
  await settleClaim(uid, approve, by);
  return { ok: true };
});

async function settleClaim(uid: string, approve: boolean, by: string) {
  await db.runTransaction(async (tx) => {
    const claimRef = db.doc(`playerClaims/${uid}`),
      userRef = db.doc(`users/${uid}`);
    const [claim, user] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);
    if (!claim.exists) throw new HttpsError("not-found", "No hay solicitud.");
    const playerId = claim.get("playerId") as string;
    const linkRef = db.doc(`playerLinks/${playerId}`);
    const link = await tx.get(linkRef);
    const previous = user.get("playerId") as string | undefined;
    const previousRef =
      previous && previous !== playerId ? db.doc(`playerLinks/${previous}`) : null;
    const previousLink = previousRef ? await tx.get(previousRef) : null;
    if (approve) {
      if (link.exists && link.get("uid") !== uid)
        throw new HttpsError("already-exists", "Esa ficha ya está vinculada a otro miembro.");
      if (previousRef && previousLink?.get("uid") === uid) tx.delete(previousRef);
      tx.set(linkRef, { uid, at: FieldValue.serverTimestamp() });
      tx.update(userRef, { playerId });
    } else if (user.get("playerId") === playerId) {
      // Rejecting an approved claim unlinks it.
      if (link.get("uid") === uid) tx.delete(linkRef);
      tx.update(userRef, { playerId: FieldValue.delete() });
    }
    tx.update(claimRef, {
      status: approve ? "approved" : "rejected",
      resolvedBy: by,
      resolvedAt: FieldValue.serverTimestamp(),
    });
  });
}

// ---------- training polls
const slotInput = z.object({
  at: z.number().finite(),
  /** End of the proposed range (optional for older clients). */
  end: z.number().finite().optional(),
  place: z.string().trim().max(80).default(""),
});
export const proposeTraining = onCall(async (req) => {
  const { uid, who } = await memberAs(req);
  const { slots, note } = parse(
    z.object({
      slots: z.array(slotInput).min(1).max(4),
      note: z.string().trim().max(200).default(""),
    }),
    req.data,
  );
  const now = Date.now();
  if (slots.some((s) => s.end !== undefined && (s.end <= s.at || s.end - s.at > 6 * 3_600_000)))
    throw new HttpsError("invalid-argument", "Cada hueco debe acabar después de empezar y durar como mucho 6 horas.");
  if (slots.some((s) => s.at <= now || s.at > now + 60 * DAY))
    throw new HttpsError("invalid-argument", "Propón fechas de los próximos dos meses.");
  const sorted = [...slots].sort((a, b) => a.at - b.at);
  const ref = await db.collection("trainings").add({
    slots: sorted.map((s, i) => ({ id: `s${i + 1}`, at: Timestamp.fromMillis(s.at), ...(s.end ? { end: Timestamp.fromMillis(s.end) } : {}), place: s.place })),
    note,
    proposedBy: uid,
    proposedByName: who.name,
    lastSlotAt: Timestamp.fromMillis(sorted.at(-1)!.at),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
});

const MADRID = "Europe/Madrid";
const slotLabel = (at: number, end?: number) => {
  const day = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "long", day: "numeric", month: "short" }).format(at);
  const t = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, hour: "2-digit", minute: "2-digit" }).format(ms);
  return `${day}, ${end ? `${t(at)}–${t(end)}` : t(at)}`;
};

/** Proposer or admin fixes the winning slot (or reopens the vote with slotId null). */
export const confirmTraining = onCall(async (req) => {
  const { trainingId, slotId } = parse(
    z.object({ trainingId: idSchema, slotId: z.string().max(8).nullable() }),
    req.data,
  );
  const ref = db.doc(`trainings/${trainingId}`);
  const [{ uid, isAdmin, who }, training] = await Promise.all([memberAs(req), ref.get()]);
  if (!training.exists) throw new HttpsError("not-found", "Ese entreno ya no existe.");
  if (training.get("proposedBy") !== uid && !isAdmin)
    throw new HttpsError("permission-denied", "Solo quien lo propuso o un administrador puede confirmarlo.");
  if (slotId === null) {
    await ref.update({ confirmed: FieldValue.delete() });
    return { ok: true };
  }
  const slots = (training.get("slots") ?? []) as { id: string; at: Timestamp; end?: Timestamp; place?: string }[];
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) throw new HttpsError("not-found", "Ese hueco no existe.");
  if (slot.at.toMillis() <= Date.now()) throw new HttpsError("failed-precondition", "Ese hueco ya ha pasado.");
  const place = slot.place || "";
  await ref.update({
    confirmed: { slotId, at: slot.at, ...(slot.end ? { end: slot.end } : {}), place, by: uid, byName: who.name, confirmedAt: FieldValue.serverTimestamp() },
  });
  // The whole team finds out on the board (as the vestuario itself, outside the rate limit).
  await db.collection("board").add({
    text: `Entreno confirmado: ${slotLabel(slot.at.toMillis(), slot.end?.toMillis())}${place ? ` · ${place}` : ""}. Apúntate en el vestuario.`,
    uid: "vestuario",
    name: "Vestuario",
    playerId: null,
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const deleteTraining = onCall(async (req) => {
  const { trainingId } = parse(z.object({ trainingId: idSchema }), req.data);
  const ref = db.doc(`trainings/${trainingId}`);
  const [{ uid, isAdmin }, training] = await Promise.all([memberAs(req), ref.get()]);
  if (!training.exists) return { ok: true };
  if (training.get("proposedBy") !== uid && !isAdmin)
    throw new HttpsError("permission-denied", "Solo quien lo propuso o un administrador puede borrarlo.");
  await db.recursiveDelete(ref);
  return { ok: true };
});

// ---------- porra (predictions are written by each member; the table is rebuilt here)
/** Rebuild a season's porra table from every finished match and its predictions. */
export async function recomputePorra(seasonId: string) {
  const finished = await db
    .collection("matches")
    .where("seasonId", "==", seasonId)
    .where("status", "==", "finished")
    .get();
  const rows = new Map<string, PorraRow>();
  const allPredictions = await Promise.all(finished.docs.map((m) => db.collection(`matchPrivate/${m.id}/predictions`).get()));
  for (const [i, match] of finished.docs.entries()) {
    const result = { goalsFor: match.get("goalsFor") ?? 0, goalsAgainst: match.get("goalsAgainst") ?? 0 };
    const predictions = allPredictions[i];
    for (const p of predictions.docs) {
      const row = rows.get(p.id) ?? { uid: p.id, name: p.get("name") ?? "Miembro", playerId: p.get("playerId") ?? null, points: 0, exact: 0, hits: 0, played: 0 };
      const pts = predictionPoints({ goalsFor: p.get("goalsFor"), goalsAgainst: p.get("goalsAgainst") }, result);
      row.points += pts;
      row.exact += pts === 3 ? 1 : 0;
      row.hits += pts > 0 ? 1 : 0;
      row.played += 1;
      row.name = p.get("name") ?? row.name;
      row.playerId = p.get("playerId") ?? row.playerId;
      rows.set(p.id, row);
    }
  }
  await db.doc(`porraStandings/${seasonId}`).set({
    seasonId,
    rows: sortPorra([...rows.values()]),
    matches: finished.size,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ---------- board: members post and delete directly (firestore.rules, boardRate/{uid}).
