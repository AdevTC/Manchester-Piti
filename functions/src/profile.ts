// /profile «La carta»: what a member changes about themselves. The vestuario handle (unique, reserved
// in nicknames/{nick}), the name printed on the back of their shirt (players stay admin-write in the
// rules: this callable writes it for the owner of the ficha), cancelling a ficha request and leaving
// the vestuario. Pure rules in profileLogic.ts (shared with the web app).
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { db, memberAs, parse } from "./common.js";
import { fold, NICK_COPY, nicknameProblem, normalizeShirtName, SHIRT_COPY, SHIRT_UNDO_MS, shirtNameProblem, shirtTakenMessage, type ShirtOwner } from "./profileLogic.js";

/** The handle a member is known by in convocatorias, porra and the pizarra. */
export const setNickname = onCall(async (req) => {
  const { uid } = await memberAs(req);
  const { nickname } = parse(z.object({ nickname: z.string({ error: NICK_COPY.empty }).max(64, NICK_COPY.long) }), req.data);
  const problem = nicknameProblem(nickname);
  if (problem) throw new HttpsError("invalid-argument", problem.message);
  return db.runTransaction(async (tx) => {
    const userRef = db.doc(`users/${uid}`);
    const nextRef = db.doc(`nicknames/${nickname}`);
    const claimRef = db.doc(`playerClaims/${uid}`);
    const [user, next, claim] = await Promise.all([tx.get(userRef), tx.get(nextRef), tx.get(claimRef)]);
    const previous = (user.get("nickname") as string | undefined) ?? "";
    if (!user.exists) throw new HttpsError("failed-precondition", "Crea tu perfil del vestuario primero.");
    if (previous === nickname) return { nickname, previous, changed: false };
    if (next.exists && next.get("uid") !== uid) throw new HttpsError("already-exists", NICK_COPY.taken);
    const oldRef = previous ? db.doc(`nicknames/${previous}`) : null;
    const old = oldRef ? await tx.get(oldRef) : null;
    tx.set(nextRef, { uid });
    if (oldRef && old?.exists && old.get("uid") === uid) tx.delete(oldRef);
    tx.update(userRef, { nickname, nicknameAt: FieldValue.serverTimestamp() });
    // A request still waiting for the captain shows who asks with the new handle.
    if (claim.exists && claim.get("status") === "pending") tx.update(claimRef, { nickname });
    return { nickname, previous, changed: true };
  });
});

const seasonDetailName = (detail: unknown) =>
  detail && typeof detail === "object" && typeof (detail as { shirtName?: unknown }).shirtName === "string" ? (detail as { shirtName: string }).shirtName : "";
const fullName = (p: FirebaseFirestore.DocumentSnapshot) => [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ");

/**
 * The name on the back of your shirt. Only the member linked to the ficha (users.playerId and
 * playerLinks/{id}.uid) can change it; it must pass the rules and be unique in the squad (checked
 * inside the transaction). Undo = calling again with `previous`: a legacy previous name the rules
 * would refuse is still accepted for 10 minutes after the change (shirtNamePrev/At).
 */
export const setShirtName = onCall(async (req) => {
  const { uid, profile } = await memberAs(req);
  const { name } = parse(z.object({ name: z.string({ error: SHIRT_COPY.empty }).max(64, SHIRT_COPY.long) }), req.data);
  const playerId = profile.get("playerId") as string | undefined;
  if (!playerId) throw new HttpsError("failed-precondition", SHIRT_COPY.notLinked);
  return db.runTransaction(async (tx) => {
    const playerRef = db.doc(`players/${playerId}`);
    const [user, link, player, everyone, seasons] = await Promise.all([
      tx.get(db.doc(`users/${uid}`)),
      tx.get(db.doc(`playerLinks/${playerId}`)),
      tx.get(playerRef),
      tx.get(db.collection("players")),
      tx.get(db.collection("seasons")),
    ]);
    if (user.get("playerId") !== playerId || !link.exists || link.get("uid") !== uid || !player.exists)
      throw new HttpsError("failed-precondition", SHIRT_COPY.notLinked);
    const createdAt = (s: FirebaseFirestore.DocumentSnapshot) => (s.get("createdAt") as Timestamp | undefined)?.toMillis?.() ?? 0;
    const liveSeasons = seasons.docs.filter((s) => s.get("archived") !== true).sort((a, b) => createdAt(a) - createdAt(b) || a.id.localeCompare(b.id)).map((s) => s.id);
    const live = new Set(liveSeasons);
    // Every name a player wears today: his own and the one of each live season that has its own.
    const namesOf = (p: FirebaseFirestore.DocumentSnapshot) => {
      const details = (p.get("seasonDetails") ?? {}) as Record<string, unknown>;
      return [p.get("shirtName") as string | undefined, ...Object.entries(details).filter(([sid]) => live.has(sid)).map(([, d]) => seasonDetailName(d))].filter((n): n is string => !!n);
    };
    // What the club prints today: the newest live season's own name, else his own, else his full name.
    const details = (player.get("seasonDetails") ?? {}) as Record<string, unknown>;
    const base = (player.get("shirtName") as string | undefined) ?? "";
    const seasonNames = liveSeasons.map((sid) => seasonDetailName(details[sid])).filter(Boolean);
    const current = seasonNames.at(-1) || base || fullName(player);
    const wanted = normalizeShirtName(name);
    if (base === wanted && seasonNames.every((n) => n === wanted)) return { shirtName: wanted, previous: wanted, changed: false };
    const prev = player.get("shirtNamePrev") as string | undefined;
    const prevAt = (player.get("shirtNamePrevAt") as Timestamp | undefined)?.toMillis() ?? 0;
    const undoing = !!prev && name === prev && Date.now() - prevAt <= SHIRT_UNDO_MS;
    const others: ShirtOwner[] = everyone.docs
      .filter((p) => p.id !== playerId && p.get("archived") !== true)
      .flatMap((p) => namesOf(p).map((n) => ({ id: p.id, name: n, number: (p.get("number") as number | undefined) ?? null })));
    const value = undoing ? prev : wanted;
    if (undoing) {
      const owner = others.find((o) => fold(o.name) === fold(value));
      if (owner) throw new HttpsError("already-exists", shirtTakenMessage(owner));
    } else {
      const problem = shirtNameProblem(wanted, others);
      if (problem) throw new HttpsError(problem.code === "taken" ? "already-exists" : "invalid-argument", problem.message);
    }
    // The season's own shirt name (when the admin set one) is what the plantilla and the pizarra print.
    const seasonPaths = Object.entries(details)
      .filter(([sid, d]) => live.has(sid) && !!seasonDetailName(d))
      .flatMap(([sid]) => [new FieldPath("seasonDetails", sid, "shirtName"), value]);
    tx.update(
      playerRef,
      "shirtName",
      value,
      "shirtNameBy",
      uid,
      "shirtNameAt",
      FieldValue.serverTimestamp(),
      "shirtNamePrev",
      current,
      "shirtNamePrevAt",
      FieldValue.serverTimestamp(),
      ...seasonPaths,
    );
    return { shirtName: value, previous: current, changed: true };
  });
});

/** Withdraw your own ficha request while the captain hasn't answered it. */
export const cancelPlayerClaim = onCall(async (req) => {
  const { uid } = await memberAs(req);
  const ref = db.doc(`playerClaims/${uid}`);
  await db.runTransaction(async (tx) => {
    const claim = await tx.get(ref);
    if (claim.exists && claim.get("status") === "pending") tx.delete(ref);
  });
  return { ok: true };
});

/**
 * Leave the vestuario yourself: the same as a captain removing you (back only if a captain opens the
 * door again), plus this account's notice subscriptions. The ficha link stays: the goals are the
 * club's history.
 */
export const leaveVestuario = onCall(async (req) => {
  const { uid, profile } = await memberAs(req);
  parse(z.object({ confirm: z.literal(true, { error: "Marca que entiendes que dejas el vestuario." }) }), req.data);
  if (profile.get("role") === "superadmin") throw new HttpsError("permission-denied", "El superadministrador no puede darse de baja");
  const subs = await db.collection("pushSubscriptions").where("uid", "==", uid).get();
  const batch = db.batch();
  batch.delete(db.doc(`teamMembers/${uid}`));
  batch.set(db.doc(`users/${uid}`), { removedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(db.doc(`accessRequests/${uid}`), {
    status: "left",
    resolvedBy: uid,
    resolvedAt: FieldValue.serverTimestamp(),
    email: profile.get("email") ?? "",
    name: profile.get("nickname") ?? "",
  });
  subs.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return { ok: true };
});
