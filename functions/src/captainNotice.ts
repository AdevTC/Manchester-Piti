// r12 · M-18 «Mandar un aviso a mano» (La bandeja de la capitanía): a captain's own notice to the vestuario's
// members, to the captains, or to a match's convocados — kept in the centro de avisos and in «Lo que se ha
// mandado» (pushSent) with how many got it. One a minute per captain.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { admin, db, idSchema, parse } from "./common.js";
import { logSent, sendToMembers, vapidPrivate } from "./push.js";
import { captainNotice, CAPTAIN_NOTICE_GAP_MS, CAPTAIN_NOTICE_MAX } from "./remindersLogic.js";
import { memberIds } from "./guests.js";
import { matchActive } from "./matchAccess.js";

const input = z.object({
  text: z.string().max(CAPTAIN_NOTICE_MAX, `El aviso cabe en ${CAPTAIN_NOTICE_MAX} letras.`),
  audience: z.enum(["todos", "capitanes", "convocados"]),
  matchId: idSchema.optional(),
});
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);

export const sendCaptainNotice = onCall({ secrets: [vapidPrivate] }, async (req) => {
  const by = await admin(req);
  const data = parse(input, req.data);
  const text = data.text.replace(/\s+/g, " ").trim();
  if (!text) throw new HttpsError("invalid-argument", "Escribe el aviso antes de mandarlo.");
  if (data.audience === "convocados" && !data.matchId) throw new HttpsError("invalid-argument", "Elige el partido de los convocados.");
  const now = Date.now();
  // who it is for, checked before the minute's turn is spent: only members still inside the vestuario
  const members = await db.collection("teamMembers").where("expiresAt", ">", new Date(now)).get();
  const inside = new Set(members.docs.map((d) => d.id));
  let uids: string[] = [];
  let url = "/vestuario";
  if (data.audience === "todos") uids = [...inside];
  else if (data.audience === "capitanes") {
    const caps = await db.collection("users").where("role", "in", ["admin", "superadmin"]).get();
    uids = caps.docs.map((d) => d.id).filter((u) => inside.has(u));
  } else {
    const match = await db.doc(`matches/${data.matchId}`).get();
    if (!match.exists || !(await matchActive(data.matchId!))) throw new HttpsError("failed-precondition", "Ese partido no tiene convocatoria.");
    const players = memberIds([...strs(match.get("starters")), ...strs(match.get("bench"))]);
    if (!players.length) throw new HttpsError("failed-precondition", "Ese partido no tiene convocatoria.");
    const links = await db.getAll(...players.map((p) => db.doc(`playerLinks/${p}`)));
    uids = links.map((l) => l.get("uid")).filter((u): u is string => typeof u === "string" && inside.has(u));
    url = `/partidos/${data.matchId}`;
  }
  // (one a minute per captain: a double tap never sends it twice)
  const gate = db.doc(`pushLog/manual-${by}`);
  const go = await db.runTransaction(async (tx) => {
    const last = (await tx.get(gate)).get("sentAt");
    if (typeof last === "number" && now - last < CAPTAIN_NOTICE_GAP_MS) return false;
    tx.set(gate, { sentAt: now, at: FieldValue.serverTimestamp() });
    return true;
  });
  if (!go) throw new HttpsError("resource-exhausted", "Acabas de mandar un aviso: espera un minuto.");
  const notice = captainNotice(text, url, now);
  const sent = await sendToMembers(notice, uids, data.audience === "todos" ? "team" : data.audience === "capitanes" ? "captains" : "personal");
  await logSent(notice, sent, { kind: "manual", audience: data.audience === "todos" ? "equipo" : data.audience, by });
  return sent;
});
