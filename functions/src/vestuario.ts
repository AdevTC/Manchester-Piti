// Vestuario features: account ↔ player link (claim + admin approval), training date
// polls, the season porra and the team board. All writes go through the backend.
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, idSchema, parse, member, admin, identity } from "./common.js";
import { predictionPoints, sortPorra, type PorraRow } from "./vestuarioLogic.js";

const DAY = 24 * 60 * 60_000;
const playerLabel = (p: FirebaseFirestore.DocumentSnapshot) =>
  (p.get("shirtName") as string | undefined) ||
  [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ") ||
  "Jugador";

// ---------- account ↔ player
export const requestPlayerClaim = onCall(async (req) => {
  const uid = await member(req);
  const { playerId } = parse(z.object({ playerId: idSchema }), req.data);
  const [player, link, profile] = await Promise.all([
    db.doc(`players/${playerId}`).get(),
    db.doc(`playerLinks/${playerId}`).get(),
    db.doc(`users/${uid}`).get(),
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
  const uid = await member(req);
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
  const who = await identity(req, uid);
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

export const voteTraining = onCall(async (req) => {
  const uid = await member(req);
  const { trainingId, slotIds } = parse(
    z.object({ trainingId: idSchema, slotIds: z.array(z.string().max(8)).max(4) }),
    req.data,
  );
  const training = await db.doc(`trainings/${trainingId}`).get();
  if (!training.exists) throw new HttpsError("not-found", "Ese entreno ya no existe.");
  const now = Date.now();
  const slots = (training.get("slots") ?? []) as { id: string; at: Timestamp }[];
  const open = new Set(slots.filter((s) => s.at.toMillis() > now).map((s) => s.id));
  if (!open.size) throw new HttpsError("failed-precondition", "La votación ya ha terminado.");
  const chosen = [...new Set(slotIds)];
  if (chosen.some((id) => !open.has(id)))
    throw new HttpsError("invalid-argument", "Elige huecos que todavía no hayan pasado.");
  // Once confirmed, the vote is closed: only "voy / no puedo" for the confirmed slot.
  const confirmed = training.get("confirmed.slotId") as string | undefined;
  if (confirmed && chosen.some((id) => id !== confirmed))
    throw new HttpsError("failed-precondition", "La votación está cerrada: el entreno ya está confirmado.");
  const ref = db.doc(`trainings/${trainingId}/votes/${uid}`);
  if (!chosen.length) await ref.delete();
  else {
    const who = await identity(req, uid);
    await ref.set({ slotIds: chosen, name: who.name, playerId: who.playerId, at: FieldValue.serverTimestamp() });
  }
  return { ok: true };
});

const MADRID = "Europe/Madrid";
const slotLabel = (at: number, end?: number) => {
  const day = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "long", day: "numeric", month: "short" }).format(at);
  const t = (ms: number) => new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, hour: "2-digit", minute: "2-digit" }).format(ms);
  return `${day}, ${end ? `${t(at)}–${t(end)}` : t(at)}`;
};

/** Proposer or admin fixes the winning slot (or reopens the vote with slotId null). */
export const confirmTraining = onCall(async (req) => {
  const uid = await member(req);
  const { trainingId, slotId } = parse(
    z.object({ trainingId: idSchema, slotId: z.string().max(8).nullable() }),
    req.data,
  );
  const ref = db.doc(`trainings/${trainingId}`);
  const [training, profile] = await Promise.all([ref.get(), db.doc(`users/${uid}`).get()]);
  if (!training.exists) throw new HttpsError("not-found", "Ese entreno ya no existe.");
  const isAdmin = ["admin", "superadmin"].includes(profile.get("role"));
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
  const who = await identity(req, uid);
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
  const uid = await member(req);
  const { trainingId } = parse(z.object({ trainingId: idSchema }), req.data);
  const ref = db.doc(`trainings/${trainingId}`);
  const [training, profile] = await Promise.all([ref.get(), db.doc(`users/${uid}`).get()]);
  if (!training.exists) return { ok: true };
  if (training.get("proposedBy") !== uid && !["admin", "superadmin"].includes(profile.get("role")))
    throw new HttpsError("permission-denied", "Solo quien lo propuso o un administrador puede borrarlo.");
  await db.recursiveDelete(ref);
  return { ok: true };
});

// ---------- porra
const goals = z.number().int().min(0).max(30);
export const predictScore = onCall(async (req) => {
  const uid = await member(req);
  const { matchId, goalsFor, goalsAgainst } = parse(
    z.object({ matchId: idSchema, goalsFor: goals, goalsAgainst: goals }),
    req.data,
  );
  const match = await db.doc(`matches/${matchId}`).get();
  if (!match.exists || match.get("status") !== "scheduled" || match.get("date").toMillis() <= Date.now())
    throw new HttpsError("failed-precondition", "La porra se cierra al empezar el partido.");
  const who = await identity(req, uid);
  await db.doc(`matchPrivate/${matchId}/predictions/${uid}`).set({
    goalsFor,
    goalsAgainst,
    name: who.name,
    playerId: who.playerId,
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/** Rebuild a season's porra table from every finished match and its predictions. */
export async function recomputePorra(seasonId: string) {
  const finished = await db
    .collection("matches")
    .where("seasonId", "==", seasonId)
    .where("status", "==", "finished")
    .get();
  const rows = new Map<string, PorraRow>();
  for (const match of finished.docs) {
    const result = { goalsFor: match.get("goalsFor") ?? 0, goalsAgainst: match.get("goalsAgainst") ?? 0 };
    const predictions = await db.collection(`matchPrivate/${match.id}/predictions`).get();
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

// ---------- board
export const postBoardMessage = onCall(async (req) => {
  const uid = await member(req);
  const { text } = parse(z.object({ text: z.string().trim().min(1, "Escribe algo.").max(500) }), req.data);
  const who = await identity(req, uid);
  const rateRef = db.doc(`boardRate/${uid}`);
  const ref = db.collection("board").doc();
  await db.runTransaction(async (tx) => {
    const rate = await tx.get(rateRef);
    if (Date.now() - (rate.get("at") ?? 0) < 5000)
      throw new HttpsError("resource-exhausted", "Espera un momento antes de volver a escribir.");
    tx.set(rateRef, { at: Date.now() });
    tx.set(ref, { text, uid, name: who.name, playerId: who.playerId, at: FieldValue.serverTimestamp() });
  });
  return { id: ref.id };
});

export const deleteBoardMessage = onCall(async (req) => {
  const uid = await member(req);
  const { id } = parse(z.object({ id: idSchema }), req.data);
  const ref = db.doc(`board/${id}`);
  const [message, profile] = await Promise.all([ref.get(), db.doc(`users/${uid}`).get()]);
  if (!message.exists) return { ok: true };
  if (message.get("uid") !== uid && !["admin", "superadmin"].includes(profile.get("role")))
    throw new HttpsError("permission-denied", "Solo puedes borrar tus mensajes.");
  await ref.delete();
  return { ok: true };
});
