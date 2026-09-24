import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  calculateLedger,
  EVENT_LABELS,
  type MatchSheet,
} from "./matchEngine.js";
export { clubShare } from "./social.js";

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });
const db = getFirestore();
const teamPassword = defineSecret("TEAM_PASSWORD");
const idSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const url = z.union([
  z.literal(""),
  z.url().refine((v) => v.startsWith("https://"), "Usa una URL HTTPS."),
]);
const eventSchema = z.object({
  id: idSchema,
  type: z.enum(
    Object.keys(EVENT_LABELS) as [
      keyof typeof EVENT_LABELS,
      ...Array<keyof typeof EVENT_LABELS>,
    ],
  ),
  minute: z.number().int().min(0).max(150),
  playerId: z.string().max(128).optional(),
  assistPlayerId: z.string().max(128).optional(),
  inPlayerId: z.string().max(128).optional(),
  note: z.string().max(300).optional(),
});
export const sheetSchema = z.object({
  version: z.literal(2),
  revision: z.number().int().min(0).optional(),
  seasonId: idSchema,
  rival: z.string().trim().min(1).max(100),
  rivalLogoUrl: url.optional(),
  rivalInitials: z
    .string()
    .trim()
    .max(3)
    .regex(/^[A-Za-z0-9]*$/)
    .optional(),
  competition: z.string().trim().min(1).max(80),
  date: z.number().finite().min(0),
  duration: z.number().int().min(1).max(150),
  venue: z.string().max(200),
  home: z.boolean(),
  status: z.enum(["scheduled", "finished", "cancelled", "postponed"]),
  starters: z.array(idSchema).max(7),
  bench: z.array(idSchema).max(30),
  notCalled: z.array(idSchema).max(100),
  events: z.array(eventSchema).max(500),
  goalsFor: z.number().int().min(0).max(100).optional(),
  goalsAgainst: z.number().int().min(0).max(100).optional(),
  report: z.string().max(10000),
  photoUrl: url.optional(),
  gallery: z.array(url).max(20).optional(),
  meetingNote: z.string().max(500).optional(),
});
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new HttpsError(
      "invalid-argument",
      r.error.issues.map((i) => i.message).join(" "),
    );
  return r.data;
}
function googleUser(req: CallableRequest) {
  if (!req.auth)
    throw new HttpsError("unauthenticated", "Inicia sesión con Google.");
  if (req.auth.token.firebase?.sign_in_provider !== "google.com")
    throw new HttpsError("permission-denied", "Usa tu cuenta de Google.");
  return req.auth.uid;
}
async function member(req: CallableRequest) {
  const uid = googleUser(req);
  const access = await db.doc(`teamMembers/${uid}`).get();
  if (
    !access.exists ||
    !access.get("expiresAt") ||
    access.get("expiresAt").toMillis() <= Date.now()
  )
    throw new HttpsError(
      "permission-denied",
      "Introduce la clave del vestuario.",
    );
  return uid;
}
async function admin(req: CallableRequest) {
  const uid = await member(req);
  const profile = await db.doc(`users/${uid}`).get();
  if (!["admin", "superadmin"].includes(profile.get("role")))
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores pueden publicar.",
    );
  return uid;
}
export const enterTeam = onCall({ secrets: [teamPassword] }, async (req) => {
  const uid = googleUser(req);
  const { password } = parse(
    z.object({ password: z.string().max(200) }),
    req.data,
  );
  const now = Date.now();
  const attemptRef = db.doc(`accessAttempts/${uid}`);
  const allowed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    const fresh = now - (snap.get("since") ?? 0) > 15 * 60_000;
    const attempts = fresh ? 0 : (snap.get("count") ?? 0);
    if (attempts >= 5) return false;
    tx.set(attemptRef, {
      since: fresh ? now : snap.get("since"),
      count: attempts + 1,
    });
    return true;
  });
  if (!allowed)
    throw new HttpsError(
      "resource-exhausted",
      "Demasiados intentos. Prueba dentro de 15 minutos.",
    );
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (
    !teamPassword.value() ||
    !timingSafeEqual(digest(password), digest(teamPassword.value()))
  )
    throw new HttpsError(
      "permission-denied",
      "La clave del equipo no es correcta.",
    );
  const expiresAt = Timestamp.fromMillis(now + 12 * 60 * 60_000);
  await db
    .doc(`teamMembers/${uid}`)
    .set({ expiresAt, joinedAt: FieldValue.serverTimestamp() });
  await attemptRef.delete();
  return { expiresAt: expiresAt.toMillis() };
});
export const leaveTeam = onCall(async (req) => {
  const uid = googleUser(req);
  await db.doc(`teamMembers/${uid}`).delete();
  return { ok: true };
});
export const registerTeamProfile = onCall(async (req) => {
  const uid = await member(req);
  const { nickname } = parse(
    z.object({
      nickname: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(15)
        .regex(/^[a-z0-9_]+$/),
    }),
    req.data,
  );
  const userRef = db.doc(`users/${uid}`),
    nameRef = db.doc(`nicknames/${nickname}`);
  const role = await db.runTransaction(async (tx) => {
    const current = await tx.get(userRef),
      claimed = await tx.get(nameRef);
    const legacy = await tx.get(
      db.collection("users").where("nickname", "==", nickname).limit(2),
    );
    if (
      (claimed.exists && claimed.get("uid") !== uid) ||
      legacy.docs.some((d) => d.id !== uid)
    )
      throw new HttpsError(
        "already-exists",
        "Ese nombre ya lo utiliza otro miembro.",
      );
    const currentRole =
      current.get("role") ??
      (req.auth?.token.email === "adriantomascv@gmail.com" &&
      req.auth?.token.email_verified === true
        ? "superadmin"
        : "user");
    const previous = current.get("nickname");
    const previousRef =
      previous && previous !== nickname && /^[a-z0-9_]{3,15}$/.test(previous)
        ? db.doc(`nicknames/${previous}`)
        : null;
    const previousClaim = previousRef ? await tx.get(previousRef) : null;
    tx.set(nameRef, { uid });
    if (previousRef && previousClaim?.get("uid") === uid)
      tx.delete(previousRef);
    tx.set(
      userRef,
      {
        email: req.auth?.token.email ?? "",
        nickname,
        role: currentRole,
        createdAt: current.get("createdAt") ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return currentRole;
  });
  return { nickname, role };
});
export const saveMatchSheet = onCall(async (req) => {
  const uid = await admin(req);
  const input = parse(
    z.object({
      id: idSchema,
      sheet: sheetSchema,
      draft: z.boolean().default(false),
    }),
    req.data,
  );
  const sheet = input.sheet as MatchSheet;
  const participants = [...sheet.starters, ...sheet.bench, ...sheet.notCalled];
  const season = await db.doc(`seasons/${sheet.seasonId}`).get();
  if (!season.exists)
    throw new HttpsError("invalid-argument", "La temporada no existe.");
  if (participants.length) {
    const players = await db.getAll(
      ...participants.map((id) => db.doc(`players/${id}`)),
    );
    if (
      players.some(
        (p) => !p.exists || !(p.get("seasons") ?? []).includes(sheet.seasonId),
      )
    )
      throw new HttpsError(
        "invalid-argument",
        "Hay jugadores que no pertenecen a esta temporada.",
      );
  }
  const ledger = calculateLedger(sheet, sheet.status === "finished");
  if (!input.draft && ledger.errors.length)
    throw new HttpsError("invalid-argument", ledger.errors.join(" "));
  if (!input.draft && sheet.status === "finished") {
    const roster = await db
      .collection("players")
      .where("seasons", "array-contains", sheet.seasonId)
      .get();
    if (roster.docs.some((p) => !participants.includes(p.id)))
      throw new HttpsError(
        "invalid-argument",
        "Asigna una situación inicial a todos los jugadores de la temporada.",
      );
    if (sheet.date > Date.now())
      throw new HttpsError(
        "invalid-argument",
        "El partido todavía no ha comenzado.",
      );
    if (
      sheet.goalsFor !== ledger.goalsFor ||
      sheet.goalsAgainst !== ledger.goalsAgainst
    )
      throw new HttpsError(
        "invalid-argument",
        "Registra todos los goles de ambos equipos: el acta debe coincidir con el marcador.",
      );
  }
  const ref = db.doc(`matches/${input.id}`);
  await db.runTransaction(async (tx) => {
    const old = await tx.get(ref);
    if ((old.get("revision") ?? 0) !== (sheet.revision ?? 0))
      throw new HttpsError(
        "aborted",
        "Otro administrador ha actualizado este partido. Recarga antes de guardar.",
      );
    if (input.draft) {
      tx.set(db.doc(`matchDrafts/${input.id}`), {
        ...sheet,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    const { meetingNote, ...publicSheet } = sheet;
    const finished = sheet.status === "finished";
    const votes = await tx.get(ref.collection("votes"));
    // Replace this match's contribution atomically: corrections never double count.
    const deltas = new Map<
      string,
      { playerId: string; seasonId: string; totals: Record<string, number> }
    >();
    const contribute = (
      seasonId: string,
      rows: Record<
        string,
        ReturnType<typeof calculateLedger>["players"][string]
      >,
      sign: number,
    ) => {
      for (const [playerId, row] of Object.entries(rows)) {
        const key = createHash("sha256")
          .update(`${seasonId}/${playerId}`)
          .digest("hex");
        const entry = deltas.get(key) ?? { playerId, seasonId, totals: {} };
        for (const [k, v] of Object.entries(row))
          if (typeof v === "number")
            entry.totals[k] = (entry.totals[k] ?? 0) + sign * v;
        for (const k of [
          "started",
          "benched",
          "notCalled",
          "played",
          "dismissed",
        ] as const)
          entry.totals[k] = (entry.totals[k] ?? 0) + sign * (row[k] ? 1 : 0);
        deltas.set(key, entry);
      }
    };
    if (old.get("status") === "finished" && old.get("seasonId"))
      contribute(old.get("seasonId"), old.get("ledger") ?? {}, -1);
    if (finished) contribute(sheet.seasonId, ledger.players, 1);
    const totalsBefore = new Map<string, Record<string, number>>();
    for (const key of deltas.keys()) {
      const snap = await tx.get(db.doc(`playerSeasonStats/${key}`));
      totalsBefore.set(key, snap.get("totals") ?? {});
    }
    // An amended lineup may remove a previously eligible MVP candidate.
    const counts: Record<string, number> = {};
    let total = 0;
    for (const vote of votes.docs) {
      const playerId = vote.get("playerId");
      if (finished && ledger.players[playerId]?.played) {
        counts[playerId] = (counts[playerId] ?? 0) + 1;
        total++;
      } else tx.delete(vote.ref);
    }
    tx.set(db.doc(`mvpResults/${input.id}`), { counts, total });
    for (const [key, entry] of deltas) {
      const totals = totalsBefore.get(key)!;
      for (const [stat, change] of Object.entries(entry.totals))
        totals[stat] = (totals[stat] ?? 0) + change;
      tx.set(db.doc(`playerSeasonStats/${key}`), {
        playerId: entry.playerId,
        seasonId: entry.seasonId,
        totals,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(ref, {
      ...publicSheet,
      date: Timestamp.fromMillis(sheet.date),
      revision: (sheet.revision ?? 0) + 1,
      goalsFor: finished ? sheet.goalsFor : null,
      goalsAgainst: finished ? sheet.goalsAgainst : null,
      ledger: finished ? ledger.players : {},
      voteClosesAt: finished
        ? (old.get("voteClosesAt") ?? Date.now() + 48 * 60 * 60_000)
        : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.doc(`matchPrivate/${input.id}`), {
      meetingNote: meetingNote ?? "",
      updatedBy: uid,
    });
    tx.delete(db.doc(`matchDrafts/${input.id}`));
    tx.set(db.collection("matchAudit").doc(), {
      matchId: input.id,
      revision: (sheet.revision ?? 0) + 1,
      updatedBy: uid,
      at: FieldValue.serverTimestamp(),
    });
  });
  return { id: input.id, draft: input.draft, ledger };
});
export const voteMvp = onCall(async (req) => {
  const uid = await member(req);
  const { matchId, playerId } = parse(
    z.object({ matchId: idSchema, playerId: idSchema }),
    req.data,
  );
  await db.runTransaction(async (tx) => {
    const match = await tx.get(db.doc(`matches/${matchId}`));
    const voteRef = db.doc(`matches/${matchId}/votes/${uid}`);
    const prior = await tx.get(voteRef);
    const resultRef = db.doc(`mvpResults/${matchId}`);
    const result = await tx.get(resultRef);
    if (
      match.get("status") !== "finished" ||
      !match.get("voteClosesAt") ||
      Date.now() >= match.get("voteClosesAt")
    )
      throw new HttpsError("failed-precondition", "La votación está cerrada.");
    if (!match.get("ledger")?.[playerId]?.played)
      throw new HttpsError(
        "invalid-argument",
        "Elige a un jugador que haya participado.",
      );
    const counts: Record<string, number> = result.get("counts") ?? {};
    const previous = prior.get("playerId");
    if (previous) counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
    counts[playerId] = (counts[playerId] ?? 0) + 1;
    tx.set(voteRef, {
      playerId,
      voterName: req.auth?.token.name ?? "Miembro",
      at: FieldValue.serverTimestamp(),
    });
    tx.set(resultRef, {
      counts,
      total: (result.get("total") ?? 0) + (prior.exists ? 0 : 1),
    });
  });
  return { ok: true };
});
export const setAvailability = onCall(async (req) => {
  const uid = await member(req);
  const { matchId, response } = parse(
    z.object({ matchId: idSchema, response: z.enum(["yes", "no", "maybe"]) }),
    req.data,
  );
  const match = await db.doc(`matches/${matchId}`).get();
  if (
    !match.exists ||
    match.get("status") !== "scheduled" ||
    match.get("date").toMillis() <= Date.now()
  )
    throw new HttpsError(
      "failed-precondition",
      "Solo puedes responder para próximos partidos.",
    );
  await db.doc(`matchPrivate/${matchId}/availability/${uid}`).set({
    response,
    name: req.auth?.token.name ?? "Miembro",
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
