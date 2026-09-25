import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  calculateLedger,
  EVENT_LABELS,
  type MatchSheet,
} from "./matchEngine.js";
import { db, idSchema, parse, googleUser, member, admin } from "./common.js";
import { recomputePorra } from "./vestuario.js";
export { clubShare } from "./social.js";
export { setSeasonArchived } from "./seasons.js";
export { clubCalendar } from "./calendar.js";
export {
  requestPlayerClaim,
  resolvePlayerClaim,
  proposeTraining,
  confirmTraining,
  deleteTraining,
} from "./vestuario.js";

const teamPassword = defineSecret("TEAM_PASSWORD");
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
  kit: z.enum(["home", "away"]).optional(),
});
/**
 * How long the team key unlocks the vestuario on a device. Google sign-in is still
 * required, "Salir del vestuario" revokes it at once and an admin can remove teamMembers/{uid}.
 */
const TEAM_ACCESS_MS = 30 * 24 * 60 * 60_000;
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
  const expiresAt = Timestamp.fromMillis(now + TEAM_ACCESS_MS);
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
    const [current, claimed, legacy] = await Promise.all([
      tx.get(userRef),
      tx.get(nameRef),
      tx.get(db.collection("users").where("nickname", "==", nickname).limit(2)),
    ]);
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
  if (season.get("archived") === true)
    throw new HttpsError("failed-precondition", "Esa temporada está archivada. Restáurala para editar sus partidos.");
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
    const keys = [...deltas.keys()];
    const stats = keys.length ? await tx.getAll(...keys.map((key) => db.doc(`playerSeasonStats/${key}`))) : [];
    stats.forEach((snap, i) => totalsBefore.set(keys[i], snap.get("totals") ?? {}));
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
  // The porra table follows the official result: recompute the season this edit touched.
  if (!input.draft) await recomputePorra(sheet.seasonId);
  return { id: input.id, draft: input.draft, ledger };
});
/**
 * MVP tally: members write their own vote (matches/{id}/votes/{uid}, validated by the
 * rules); this trigger recounts the match in a transaction so mvpResults is always
 * the exact count of valid votes, whatever the order or retries of the events.
 */
export const tallyMvp = onDocumentWritten("matches/{matchId}/votes/{uid}", async (event) => {
  const matchRef = db.doc(`matches/${event.params.matchId}`);
  await db.runTransaction(async (tx) => {
    const [match, votes] = await Promise.all([tx.get(matchRef), tx.get(matchRef.collection("votes"))]);
    const ledger = (match.get("ledger") ?? {}) as Record<string, { played?: boolean }>;
    const counts: Record<string, number> = {};
    let total = 0;
    for (const vote of votes.docs) {
      const playerId = vote.get("playerId") as string;
      if (!ledger[playerId]?.played) continue;
      counts[playerId] = (counts[playerId] ?? 0) + 1;
      total++;
    }
    tx.set(db.doc(`mvpResults/${event.params.matchId}`), { counts, total });
  });
});
