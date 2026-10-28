// «Ya la he pagado»: a member tells the captains he paid (Bizum, cash…) — `cajaClaims/{id}`
// `{ uid, playerId, seasonId, concept, amount, at, status }`. He creates his own, «pendiente»; a captain
// confirms it (the claim flips to «confirmado» and a `pago` movement goes into the caja, in one batch) or
// rejects it («rechazado»). The backend tells the captains when one comes in (functions/src/caja.ts).
// Pure: the reader, the fields the rules check (firestore.rules cajaClaimOk) and the words.
import { CAJA_LIMITS, cajaMovFields, fmtEuros } from "./caja";
import { madridDate } from "./madrid";

export type CajaClaimStatus = "pendiente" | "confirmado" | "rechazado";
export const CAJA_CLAIM_STATUSES: readonly CajaClaimStatus[] = ["pendiente", "confirmado", "rechazado"];

export interface CajaClaim {
  id: string;
  uid: string;
  playerId: string;
  seasonId: string;
  concept: string;
  /** Positive cents. */
  amount: number;
  /** When he said it (ms; 0 while the server time is pending). */
  at: number;
  status: CajaClaimStatus;
  /** The captain who confirmed or rejected it (only once resolved). */
  resolvedBy?: string;
  /** When (ms; 0 while pending), only once resolved. */
  resolvedAt?: number;
  /** The `pago` movement a confirmation wrote (only when confirmed). */
  movId?: string;
  /** M-20: why a captain rejected it (≤ 130; only on a rejection, when he said why). */
  reason?: string;
}
/** M-20: the most a rejection's reason says (firestore.rules). */
export const CLAIM_REASON_MAX = 130;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function millisOf(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isRecord(v) && typeof v.toMillis === "function") {
    const ms: unknown = (v.toMillis as () => unknown)();
    return typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

/** A cajaClaims doc, or null when it isn't one (never shown). */
export function parseCajaClaim(id: string, d: unknown): CajaClaim | null {
  if (!isRecord(d)) return null;
  const uid = str(d.uid);
  const playerId = str(d.playerId);
  const seasonId = str(d.seasonId);
  const status = d.status;
  if (!uid || !playerId || !seasonId || typeof status !== "string" || !(CAJA_CLAIM_STATUSES as readonly string[]).includes(status)) return null;
  if (typeof d.amount !== "number" || !Number.isInteger(d.amount) || d.amount <= 0 || d.amount > CAJA_LIMITS.amount) return null;
  return {
    id,
    uid,
    playerId,
    seasonId,
    concept: typeof d.concept === "string" ? d.concept : "",
    amount: d.amount,
    at: millisOf(d.at),
    status: status as CajaClaimStatus,
    ...(str(d.resolvedBy) ? { resolvedBy: d.resolvedBy as string } : {}),
    ...(status !== "pendiente" ? { resolvedAt: millisOf(d.resolvedAt) } : {}),
    ...(str(d.movId) ? { movId: d.movId as string } : {}),
    ...(status === "rechazado" && typeof d.reason === "string" && d.reason.trim() ? { reason: d.reason.trim().slice(0, CLAIM_REASON_MAX) } : {}),
  };
}

/** What a member says he paid. */
export interface NewCajaClaim {
  seasonId: string;
  concept: string;
  /** Positive cents. */
  amount: number;
}
/** Why a claim can't go yet (null: it can). */
export function claimProblem(me: { playerId: string | null }, c: NewCajaClaim): string | null {
  if (!me.playerId) return "Necesitas tu ficha de jugador para avisar de un pago.";
  if (!c.seasonId) return "Elige la temporada.";
  if (!Number.isInteger(c.amount) || c.amount <= 0 || c.amount > CAJA_LIMITS.amount) return "Pon cuánto has pagado.";
  if (!c.concept.trim()) return "Di qué has pagado (la cuota, el partido…).";
  return null;
}
/** The cajaClaims doc fields a member writes (all but `at`, the server's time, added by the writer). */
export function cajaClaimFields(me: { uid: string; playerId: string | null }, c: NewCajaClaim) {
  return {
    uid: me.uid,
    playerId: me.playerId,
    seasonId: c.seasonId,
    concept: c.concept.trim().slice(0, CAJA_LIMITS.concept),
    amount: c.amount,
    status: "pendiente" as const,
  };
}
/** A captain's answer (all but resolvedAt, the server's time): «confirmado» carries the movement's id; «rechazado»
 *  may say why (M-20: trimmed, ≤ 130; left out when empty, as the rules allow). */
export const cajaClaimResolveFields = (by: string, status: Exclude<CajaClaimStatus, "pendiente">, movId?: string, reason?: string) => {
  const why = status === "rechazado" ? (reason ?? "").trim().slice(0, CLAIM_REASON_MAX) : "";
  return { status, resolvedBy: by, ...(status === "confirmado" && movId ? { movId } : {}), ...(why ? { reason: why } : {}) };
};
/** The `pago` a confirmation writes (cajaMovFields; dated the day he said it, Madrid). */
export const claimPagoFields = (claim: CajaClaim, by: string, now: number) =>
  cajaMovFields(claim.seasonId, { kind: "pago", playerId: claim.playerId, amount: claim.amount, concept: claim.concept || "Pago avisado", date: madridDate(claim.at || now), matchId: null }, by);

/** Pending first (oldest first: the queue), then the resolved ones newest first. */
export const sortClaims = (claims: readonly CajaClaim[]): CajaClaim[] =>
  [...claims].sort((a, b) => (a.status === "pendiente") === (b.status === "pendiente") ? (a.status === "pendiente" ? a.at - b.at : b.at - a.at) : a.status === "pendiente" ? -1 : 1);

/** The member's line for a claim: «Avisado, pendiente de confirmar» / «Confirmado» / «No se ha confirmado». */
export function claimStatusText(c: Pick<CajaClaim, "status" | "amount">): string {
  if (c.status === "pendiente") return `${fmtEuros(c.amount)} · Avisado, pendiente de confirmar`;
  if (c.status === "confirmado") return `${fmtEuros(c.amount)} · Confirmado`;
  return `${fmtEuros(c.amount)} · No se ha confirmado`;
}
