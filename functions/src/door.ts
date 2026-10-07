// The vestuario door, without a shared key: a Google account gets in with an invitation link from a
// captain or by asking for access (a captain approves it). Membership lasts until an admin removes
// it. The first time, the newcomer says who they are (their ficha, or a name); the profile and the
// ficha link are created here. Pure rules in doorLogic.ts.
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, googleUser, idSchema, parse } from "./common.js";
import { cleanName, FOREVER_MS, INVITE_DAYS, INVITE_PROBLEM, inviteCodePattern, inviteState, newInviteCode, nicknameBase, nicknameCandidates } from "./doorLogic.js";
import { sendTo } from "./push.js";

const SUPERADMIN = "adriantomascv@gmail.com";
const codeSchema = z.string().regex(inviteCodePattern, "Invitación no válida.");
const whoSchema = z.object({ playerId: idSchema.optional(), name: z.string().max(60).optional() });
const playerLabel = (p: FirebaseFirestore.DocumentSnapshot) =>
  (p.get("shirtName") as string | undefined) || [p.get("firstName"), p.get("lastName")].filter(Boolean).join(" ") || "Jugador";
const inviteData = (snap: FirebaseFirestore.DocumentSnapshot) =>
  snap.exists ? { expiresAt: (snap.get("expiresAt") as Timestamp).toMillis(), maxUses: snap.get("maxUses") ?? 1, uses: snap.get("uses") ?? 0, revoked: !!snap.get("revoked") } : undefined;

/**
 * Inside a transaction: membership, profile (keeps an existing one; otherwise a unique nickname from
 * the ficha or name) and, when the ficha is free, the link. Reads first, then writes.
 */
async function admit(tx: Transaction, req: CallableRequest, uid: string, who: { playerId?: string; name?: string }, via: string, by: string) {
  const userRef = db.doc(`users/${uid}`);
  const [user, player, link] = await Promise.all([
    tx.get(userRef),
    who.playerId ? tx.get(db.doc(`players/${who.playerId}`)) : Promise.resolve(null),
    who.playerId ? tx.get(db.doc(`playerLinks/${who.playerId}`)) : Promise.resolve(null),
  ]);
  if (who.playerId && !player?.exists) throw new HttpsError("not-found", "Esa ficha no existe.");
  const linkable = !!who.playerId && (!link?.exists || link.get("uid") === uid);
  let nickname = user.get("nickname") as string | undefined;
  let nameRef: FirebaseFirestore.DocumentReference | null = null;
  if (!nickname) {
    const base = nicknameBase(player ? playerLabel(player) : undefined, who.name, req.auth?.token.name as string | undefined, req.auth?.token.email as string | undefined);
    for (const candidate of nicknameCandidates(base)) {
      const ref = db.doc(`nicknames/${candidate}`);
      const taken = await tx.get(ref);
      if (!taken.exists || taken.get("uid") === uid) {
        nickname = candidate;
        nameRef = ref;
        break;
      }
    }
    if (!nickname) throw new HttpsError("resource-exhausted", "No hemos podido reservar tu nombre. Prueba con otro.");
  }
  const email = (req.auth?.token.email as string | undefined) ?? "";
  const role = user.get("role") ?? (email === SUPERADMIN && req.auth?.token.email_verified === true ? "superadmin" : "user");
  tx.set(db.doc(`teamMembers/${uid}`), { expiresAt: Timestamp.fromMillis(FOREVER_MS), joinedAt: FieldValue.serverTimestamp(), via, by });
  if (nameRef) tx.set(nameRef, { uid });
  tx.set(
    userRef,
    {
      email,
      nickname,
      role,
      ...(who.name && !who.playerId ? { displayName: cleanName(who.name) } : {}),
      ...(linkable ? { playerId: who.playerId } : {}),
      createdAt: user.get("createdAt") ?? FieldValue.serverTimestamp(),
      removedAt: FieldValue.delete(),
    },
    { merge: true },
  );
  if (linkable && who.playerId) {
    tx.set(db.doc(`playerLinks/${who.playerId}`), { uid, at: FieldValue.serverTimestamp() });
    const previous = user.get("playerId") as string | undefined;
    if (previous && previous !== who.playerId) tx.delete(db.doc(`playerLinks/${previous}`));
  }
  tx.delete(db.doc(`accessRequests/${uid}`));
  return { nickname, linked: linkable };
}

/** Public: what an invitation link says (who invites, until when, a reserved ficha) — or why it's dead. */
export const inviteInfo = onCall(async (req) => {
  const { code } = parse(z.object({ code: codeSchema }), req.data);
  const snap = await db.doc(`invites/${code}`).get();
  const state = inviteState(inviteData(snap), Date.now());
  if (state !== "valid") return { state, problem: INVITE_PROBLEM[state] };
  return { state, by: snap.get("byName") ?? "El capitán", expiresAt: (snap.get("expiresAt") as Timestamp).toMillis(), playerId: snap.get("playerId") ?? null, playerName: snap.get("playerName") ?? null };
});

export const createInvite = onCall(async (req) => {
  const uid = await admin(req);
  const input = parse(z.object({ playerId: idSchema.optional(), maxUses: z.union([z.literal(0), z.literal(1)]).default(1), days: z.number().int().min(INVITE_DAYS.min).max(INVITE_DAYS.max).default(INVITE_DAYS.default) }), req.data ?? {});
  const [me, player] = await Promise.all([db.doc(`users/${uid}`).get(), input.playerId ? db.doc(`players/${input.playerId}`).get() : Promise.resolve(null)]);
  if (input.playerId && !player?.exists) throw new HttpsError("not-found", "Esa ficha no existe.");
  const code = newInviteCode();
  const expiresAt = Timestamp.fromMillis(Date.now() + input.days * 86_400_000);
  await db.doc(`invites/${code}`).create({
    by: uid,
    byName: (me.get("displayName") as string | undefined) || (me.get("nickname") as string | undefined) || "El capitán",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    maxUses: input.maxUses,
    uses: 0,
    ...(player ? { playerId: input.playerId, playerName: playerLabel(player) } : {}),
  });
  return { code, expiresAt: expiresAt.toMillis() };
});

export const revokeInvite = onCall(async (req) => {
  await admin(req);
  const { code } = parse(z.object({ code: codeSchema }), req.data);
  await db.doc(`invites/${code}`).update({ revoked: true });
  return { ok: true };
});

export const joinWithInvite = onCall(async (req) => {
  const uid = googleUser(req);
  const input = parse(whoSchema.extend({ code: codeSchema }), req.data);
  const inviteRef = db.doc(`invites/${input.code}`);
  return db.runTransaction(async (tx) => {
    const invite = await tx.get(inviteRef);
    const state = inviteState(inviteData(invite), Date.now());
    if (state !== "valid") throw new HttpsError("failed-precondition", INVITE_PROBLEM[state]);
    const playerId = (invite.get("playerId") as string | undefined) ?? input.playerId;
    const result = await admit(tx, req, uid, { playerId, name: input.name }, "invite", invite.get("by"));
    tx.update(inviteRef, { uses: FieldValue.increment(1), lastUsedBy: uid, lastUsedAt: FieldValue.serverTimestamp() });
    return result;
  });
});

export const requestAccess = onCall(async (req) => {
  const uid = googleUser(req);
  const input = parse(whoSchema, req.data ?? {});
  if (!input.playerId && !cleanName(input.name ?? "")) throw new HttpsError("invalid-argument", "Dinos quién eres: elige tu ficha o escribe tu nombre.");
  const [user, access, player] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`teamMembers/${uid}`).get(),
    input.playerId ? db.doc(`players/${input.playerId}`).get() : Promise.resolve(null),
  ]);
  if (input.playerId && !player?.exists) throw new HttpsError("not-found", "Esa ficha no existe.");
  // Already inside (e.g. a second device): nothing to ask — only the profile, if it was never made.
  if (access.exists && (access.get("expiresAt") as Timestamp).toMillis() > Date.now()) {
    if (!user.exists) await db.runTransaction((tx) => admit(tx, req, uid, input, "returning", uid));
    return { status: "member" as const };
  }
  // Whoever already had a vestuario profile (from the old shared key) walks straight back in —
  // unless an admin removed them.
  if (user.exists && !user.get("removedAt")) {
    const result = await db.runTransaction((tx) => admit(tx, req, uid, input, "returning", uid));
    return { status: "member" as const, ...result };
  }
  const email = (req.auth?.token.email as string | undefined) ?? "";
  await db.doc(`accessRequests/${uid}`).set({
    status: "pending",
    googleName: (req.auth?.token.name as string | undefined) ?? "",
    email,
    photo: (req.auth?.token.picture as string | undefined) ?? "",
    ...(input.playerId ? { playerId: input.playerId, playerName: playerLabel(player!) } : { name: cleanName(input.name ?? "") }),
    at: FieldValue.serverTimestamp(),
  });
  const who = input.playerId ? playerLabel(player!) : cleanName(input.name ?? "") || "Alguien";
  await sendTo({ topic: "door", title: "Llaman a la puerta del vestuario", body: `${who} pide entrar${email ? ` (${email})` : ""}.`, tag: `door-${uid}`, url: "/vestuario#puerta" });
  return { status: "pending" as const };
});

export const cancelAccessRequest = onCall(async (req) => {
  const uid = googleUser(req);
  await db.doc(`accessRequests/${uid}`).delete();
  return { ok: true };
});

export const resolveAccess = onCall(async (req) => {
  const by = await admin(req);
  const input = parse(z.object({ uid: z.string().min(1).max(128), approve: z.boolean(), playerId: idSchema.optional() }), req.data);
  const ref = db.doc(`accessRequests/${input.uid}`);
  if (!input.approve) {
    await ref.update({ status: "rejected", resolvedBy: by, resolvedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  }
  const result = await db.runTransaction(async (tx) => {
    const request = await tx.get(ref);
    if (!request.exists) throw new HttpsError("not-found", "Esa petición ya no existe.");
    // The callable runs as the captain, but the profile is the requester's: rebuild their token bits.
    const fake = { auth: { uid: input.uid, token: { email: request.get("email"), name: request.get("googleName"), email_verified: true } } } as unknown as CallableRequest;
    return admit(tx, fake, input.uid, { playerId: input.playerId ?? request.get("playerId"), name: request.get("name") }, "request", by);
  });
  await sendTo({ topic: "access", title: "¡Ya estás dentro!", body: "El capitán te ha abierto la puerta del vestuario.", tag: "access", url: "/vestuario" }, input.uid);
  return { ok: true, ...result };
});

export const revokeMember = onCall(async (req) => {
  const by = await admin(req);
  const { uid } = parse(z.object({ uid: z.string().min(1).max(128) }), req.data);
  if (uid === by) throw new HttpsError("failed-precondition", "No puedes quitarte el acceso a ti mismo.");
  const user = await db.doc(`users/${uid}`).get();
  if (user.get("role") === "superadmin") throw new HttpsError("permission-denied", "No se puede quitar el acceso al superadministrador.");
  await db.doc(`teamMembers/${uid}`).delete();
  await db.doc(`users/${uid}`).set({ removedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`accessRequests/${uid}`).set({ status: "removed", resolvedBy: by, resolvedAt: FieldValue.serverTimestamp(), email: user.get("email") ?? "", name: user.get("nickname") ?? "" });
  return { ok: true };
});

/** For «¿Quién eres?»: which fichas already have an owner (ids only, never who). Any Google account. */
// Public on purpose: the door shows who is already inside (shirts with an owner, how many accounts)
// before signing in. The squad is public; which shirts are claimed and a head count are not secrets.
export const doorShirts = onCall(async () => {
  // "With access" = everyone with a profile who wasn't removed: members from the old team key keep
  // their access and walk back in on their next visit, even if their old session has lapsed.
  const [links, people, removed] = await Promise.all([db.collection("playerLinks").get(), db.collection("users").count().get(), db.collection("users").where("removedAt", "!=", null).count().get()]);
  return { taken: links.docs.map((d) => d.id), inside: people.data().count - removed.data().count };
});
