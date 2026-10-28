// CAJA · what the caja's screens say (pure): the words and the lists of /admin/caja and /admin/caja/coste/<id>
// (board caja.js), over the money logic that already works (lib/derived/caja, cajaClaims). Every sum here is
// derived/caja's — the same the vestuario's «La caja» reads — so the sala and the vestuario add up the same; this
// file only says them (whole euros without «,00», the day with its weekday, the balances by dorsal…).
import {
  balanceRows,
  balanceText,
  type BalancePlayer,
  type BalanceRow,
  type CajaKind,
  type CajaMov,
  type CajaSettings,
} from "../../../../lib/derived/caja";
import type { CajaClaim } from "../../../../lib/derived/cajaClaims";
import { nameFor } from "../../../../lib/derived/names";
import type { PlayerDoc } from "../../../../lib/schemas";
import { relativeTime } from "../../../../lib/derived/notices";
import { plural } from "../../../../lib/derived/words";
import { shortDate, type AdminMatch } from "../../data/adminLogic";
import { carrilPhase } from "../../partido/carril";

// ───────────────────────── money and days in words ─────────────────────────
const WHOLE = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** «25 €», «7,28 €» (es-ES): whole euros say no «,00» (the board's money). */
export const euros = (cents: number): string => (cents % 100 === 0 ? WHOLE : CENTS).format(cents / 100);

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** «lun 19 oct» for a movement's `YYYY-MM-DD` (Madrid noon, so the weekday is that day's); «sin fecha». */
export function dayWeek(day: string): string {
  const m = DAY_RE.exec(day);
  return m ? shortDate(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : "sin fecha";
}

/** A movement's amount as the book shows it: «+» what comes in (a pago, an ingreso), «−» what goes out or is owed
 *  (a gasto, a cargo) — derived/caja's movSign, the app's since the caja exists. */
export const signedAmount = (m: Pick<CajaMov, "kind" | "amount">): string => `${m.kind === "pago" || m.kind === "ingreso" ? "+" : "−"}${euros(m.amount)}`;

export const KIND_WORD: Record<CajaKind, string> = { cargo: "Cargo", pago: "Pago", gasto: "Gasto", ingreso: "Ingreso" };

// ───────────────────────── the jar's facts ─────────────────────────
/** «25 € al mes» / «25 € por temporada» / «Sin cuota · ponla en Ajustes». */
export const cuotaLine = (s: Pick<CajaSettings, "cuota" | "cuotaPeriod">): string =>
  s.cuota ? `${euros(s.cuota)} ${s.cuotaPeriod === "mensual" ? "al mes" : "por temporada"}` : "Sin cuota · ponla en Ajustes";
/** «Cómo pagar: …» / what is missing (and why it matters). */
export const howLine = (s: Pick<CajaSettings, "howToPay">): string =>
  s.howToPay.trim() ? `Cómo pagar: ${s.howToPay.trim()}` : "Falta «Cómo pagar»: los socios no saben a quién pagar";

/** «Os deben 230 € · 13 jugadores» and «Más: HUBEROSKI 33 € · PELLETE 33 € · BRAWAN 33 € y 10 más» (A-CLUB-17), or
 *  that nobody owes. `owed` is derived/caja's owedTotal (everyone who owes, also who left the squad). */
export function owedLines(rows: readonly BalanceRow[], owed: number, squadSize: number): { owed: string; who: string } {
  const debtors = rows.filter((r) => r.state === "debe");
  if (!owed || !debtors.length) return { owed: squadSize || rows.length ? "Nadie debe nada" : "Sin plantilla en esta temporada", who: "" };
  const top = [...debtors].sort((a, b) => a.balance - b.balance || (a.number ?? 999) - (b.number ?? 999)).slice(0, 3);
  const more = debtors.length - top.length;
  return {
    owed: `Os deben ${euros(owed)} · ${plural(debtors.length, "jugador", "jugadores")}`,
    who: `Más: ${top.map((r) => `${r.name} ${euros(-r.balance)}`).join(" · ")}${more > 0 ? ` y ${more} más` : ""}`,
  };
}

// ───────────────────────── who is in the season ─────────────────────────
/** A player's dorsal in a season (its seasonDetails, else his default; the Plantilla's rule). */
export function numberIn(p: Pick<PlayerDoc, "number" | "seasonDetails">, seasonId: string): number | null {
  const raw = p.seasonDetails?.[seasonId];
  const own = raw && typeof raw === "object" ? (raw as Record<string, unknown>).number : undefined;
  const n = typeof own === "number" ? own : p.number;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
/** The season's squad (its players, with that season's shirt name and dorsal), by dorsal then name: who a cuota
 *  charges and whose balance the caja lists (the sala's rule before r12). */
export function squadOf(players: readonly PlayerDoc[], seasonId: string): BalancePlayer[] {
  return players
    .filter((p) => (p.seasons ?? []).includes(seasonId))
    .map((p) => ({ id: p.id, name: nameFor(p, seasonId), number: numberIn(p, seasonId) }))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es"));
}

// ───────────────────────── saldos ─────────────────────────
/** Everyone's balance (derived/caja's balanceRows: the squad plus anyone else with a movement) in the board's
 *  order: by dorsal (no dorsal last), then by name. */
export function saldoRows(movs: readonly CajaMov[], squad: readonly BalancePlayer[], nameOf: (id: string) => string): BalanceRow[] {
  return balanceRows(movs, squad, nameOf).sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es"));
}
/** A balance in words, never colour alone (derived/caja's: «Debe 12,50 €»…), in the board's money («Debe 8 €»). */
export function saldoText(cents: number): string {
  if (!cents) return balanceText(0);
  return cents < 0 ? `Debe ${euros(-cents)}` : `A favor ${euros(cents)}`;
}

// ───────────────────────── the book (movimientos) ─────────────────────────
/** «todos», «bote» (no player: gastos and ingresos) or a player's id. */
export type WhoFilter = string;
export const WHO_ALL = "todos";
export const WHO_BOTE = "bote";
export function filterBook(movs: readonly CajaMov[], kind: CajaKind | "", who: WhoFilter): CajaMov[] {
  return movs.filter((m) => (!kind || m.kind === kind) && (who === WHO_ALL || (who === WHO_BOTE ? !m.playerId : m.playerId === who)));
}
/** How many rows of the book show at first (the board's 50, 80 on a big screen): «Ver todos» shows the rest. */
export const bookPage = (big: boolean): number => (big ? 80 : 50);

/** Live movements plus the ones still behind their «Deshacer» (`pending`, already with their ids): one per id, the
 *  live one first (the listener has it once the write is made, offline too). */
export function withPending(live: readonly CajaMov[], pending: readonly CajaMov[]): readonly CajaMov[] {
  if (!pending.length) return live;
  const ids = new Set(live.map((m) => m.id));
  const extra = pending.filter((m) => !ids.has(m.id));
  return extra.length ? [...live, ...extra] : live;
}

// ───────────────────────── pagos avisados ─────────────────────────
export interface ResolvedLine {
  id: string;
  title: string;
  detail: string;
  word: "Confirmado" | "Rechazado";
}
/** «Resueltos» (H-CLUB-16): the newest six answered, «KEVIN · Cuota octubre · 25 €» / «Rechazado por jordi · ayer ·
 *  «No me ha llegado»». */
export function resolvedLines(claims: readonly CajaClaim[], nameOf: (playerId: string) => string, nickOf: (uid: string) => string, now: number, max = 6): ResolvedLine[] {
  return claims
    .filter((c) => c.status !== "pendiente")
    .sort((a, b) => (b.resolvedAt || b.at) - (a.resolvedAt || a.at))
    .slice(0, max)
    .map((c) => {
      const word = c.status === "confirmado" ? "Confirmado" : "Rechazado";
      const by = c.resolvedBy ? ` por ${nickOf(c.resolvedBy)}` : "";
      const when = c.resolvedAt ? ` · ${relativeTime(c.resolvedAt, now)}` : "";
      return { id: c.id, title: `${nameOf(c.playerId)} · ${c.concept || "Pago avisado"} · ${euros(c.amount)}`, detail: `${word}${by}${when}${c.reason ? ` · «${c.reason}»` : ""}`, word };
    });
}

// ───────────────────────── the cost of a match ─────────────────────────
/** A match counts as played for its cost once its acta says so or la mesa ended it (the carril's «final» or
 *  «publicado»); one that never reached la mesa («¿Se jugó?», B-HOY-11) is not, nor a cancelled or postponed one. */
export const isPlayed = (m: AdminMatch, now: number): boolean => {
  if (m.status === "cancelled" || m.status === "postponed") return false;
  if (m.status === "finished") return true;
  const ph = carrilPhase(m, now);
  return ph === "final" || ph === "publicado";
};
/** What is charged of a match: its non-void cargos (derived/caja's chargedAlready counts the same). */
export function chargedOf(movs: readonly CajaMov[], matchId: string): { n: number; total: number; date: string } {
  const xs = movs.filter((m) => !m.void && m.kind === "cargo" && m.matchId === matchId);
  return { n: xs.length, total: xs.reduce((s, m) => s + m.amount, 0), date: xs.map((m) => m.date).sort()[0] ?? "" };
}
/** The season's published matches that can be charged (played), newest first; `current` too when it is not one. */
export function costMatches(matches: readonly AdminMatch[], seasonId: string, now: number, current?: AdminMatch | null): AdminMatch[] {
  const played = matches.filter((m) => m.seasonId === seasonId && m.published && isPlayed(m, now)).reverse();
  return current && !played.some((m) => m.id === current.id) ? [current, ...played] : played;
}
/** The match «Coste del partido» opens: the latest played one not charged yet, else the latest played. */
export function costTarget(matches: readonly AdminMatch[], seasonId: string, now: number, movs: readonly CajaMov[]): AdminMatch | null {
  const played = costMatches(matches, seasonId, now);
  return played.find((m) => !chargedOf(movs, m.id).n) ?? played[0] ?? null;
}
/** The total a new cost starts with: the last charged match's (what campo y árbitro usually costs), else nothing. */
export function lastCostTotal(movs: readonly CajaMov[]): number {
  const byMatch = new Map<string, { total: number; at: string }>();
  for (const m of movs) {
    if (m.void || m.kind !== "cargo" || !m.matchId) continue;
    const e = byMatch.get(m.matchId) ?? { total: 0, at: "" };
    e.total += m.amount;
    const key = `${m.date}|${String(m.createdAt).padStart(15, "0")}`;
    if (key > e.at) e.at = key;
    byMatch.set(m.matchId, e);
  }
  let best: { total: number; at: string } | null = null;
  for (const e of byMatch.values()) if (!best || e.at > best.at) best = e;
  return best?.total ?? 0;
}
/** «7,28 € cada uno» or «de 7,27 € a 7,28 €» for a split (derived/caja's splitCost amounts). */
export function splitLine(total: number, amounts: readonly number[]): string {
  if (!amounts.length) return "Nadie a quien cargarlo";
  const hi = Math.max(...amounts);
  const lo = Math.min(...amounts);
  return `${euros(total)} entre ${amounts.length} · ${hi === lo ? `${euros(hi)} cada uno` : `de ${euros(lo)} a ${euros(hi)}`}`;
}
