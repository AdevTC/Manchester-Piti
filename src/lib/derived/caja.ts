// La caja: the team's money as a shared ledger (pure). Integer cents everywhere; no real payments, no fines.
// `caja/{seasonId}` holds the season's settings (cuota, its period, «Cómo pagar»); `cajaMovs/{id}` the
// append-only movements: a cargo (cuota or a match's share) or a pago belong to a player, a gasto (money out
// of the jar) or an ingreso (other money in) to nobody. A correction never deletes: it sets `void`.
// A player's balance is his pagos minus his cargos (negative = he owes); the jar is pagos + ingresos −
// gastos. The admin's Caja section and the vestuario's «La caja» both read these, so they add up the same.
import type { ClubMatch } from "../clubData";
import { minutesOf } from "./minutesOf";
import { madridDate, MONTHS_SHORT } from "./madrid";

export type CajaKind = "cargo" | "pago" | "gasto" | "ingreso";
export const CAJA_KINDS: readonly CajaKind[] = ["cargo", "pago", "gasto", "ingreso"];
/** The kinds that belong to a player (`playerId` set); gasto and ingreso have none. */
export const isPlayerKind = (k: CajaKind) => k === "cargo" || k === "pago";
export const KIND_LABEL: Record<CajaKind, string> = { cargo: "Cargo", pago: "Pago", gasto: "Gasto", ingreso: "Ingreso" };

export type CuotaPeriod = "temporada" | "mensual";
/** The caps (the same as firestore.rules). */
export const CAJA_LIMITS = { amount: 10_000_000, concept: 80, howToPay: 500, id: 128 } as const;

export interface CajaSettings {
  /** The cuota, in cents (0 = none set). */
  cuota: number;
  cuotaPeriod: CuotaPeriod;
  /** Free text shown to the members (e.g. the Bizum number). */
  howToPay: string;
  /** ms (0 when unknown). */
  updatedAt: number;
}
export const EMPTY_CAJA_SETTINGS: CajaSettings = { cuota: 0, cuotaPeriod: "temporada", howToPay: "", updatedAt: 0 };

export interface CajaMov {
  id: string;
  seasonId: string;
  kind: CajaKind;
  /** Set for cargo and pago; null for gasto and ingreso. */
  playerId: string | null;
  /** Positive cents. */
  amount: number;
  concept: string;
  /** The movement's Madrid date, `YYYY-MM-DD`. */
  date: string;
  matchId: string | null;
  /** The captain's uid. */
  by: string;
  /** ms (0 while the server time is pending). */
  createdAt: number;
  void: boolean;
  /** Who voided it (the captain's uid), only on a void movement (null on an older one without it). */
  voidedBy?: string | null;
  /** When it was voided (ms; 0 while the server time is pending or unknown), only on a void movement. */
  voidedAt?: number;
}

// ───────────────────────── reading the docs ─────────────────────────
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** A Firestore Timestamp (anything with toMillis) or a number → ms; anything else 0. */
function millisOf(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (isRecord(v) && typeof v.toMillis === "function") {
    const ms: unknown = (v.toMillis as () => unknown)();
    return typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
  }
  return 0;
}
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const okCents = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= CAJA_LIMITS.amount;

/** A cajaMovs doc, or null when it is not a movement (never counted). */
export function parseCajaMov(id: string, d: unknown): CajaMov | null {
  if (!isRecord(d)) return null;
  const kind = d.kind;
  if (typeof kind !== "string" || !(CAJA_KINDS as readonly string[]).includes(kind)) return null;
  const k = kind as CajaKind;
  const playerId = typeof d.playerId === "string" && d.playerId ? d.playerId : null;
  if (isPlayerKind(k) !== !!playerId) return null;
  if (!okCents(d.amount) || typeof d.seasonId !== "string" || !d.seasonId) return null;
  return {
    id,
    seasonId: d.seasonId,
    kind: k,
    playerId,
    amount: d.amount,
    concept: typeof d.concept === "string" ? d.concept : "",
    date: typeof d.date === "string" && DAY_RE.test(d.date) ? d.date : "",
    matchId: typeof d.matchId === "string" && d.matchId ? d.matchId : null,
    by: typeof d.by === "string" ? d.by : "",
    createdAt: millisOf(d.createdAt),
    void: d.void === true,
    ...(d.void === true ? { voidedBy: typeof d.voidedBy === "string" && d.voidedBy ? d.voidedBy : null, voidedAt: millisOf(d.voidedAt) } : {}),
  };
}

/** caja/{seasonId}, or the empty settings when there is no doc yet (or a field is off). */
export function parseCajaSettings(d: unknown): CajaSettings {
  if (!isRecord(d)) return EMPTY_CAJA_SETTINGS;
  return {
    cuota: typeof d.cuota === "number" && Number.isInteger(d.cuota) && d.cuota >= 0 ? d.cuota : 0,
    cuotaPeriod: d.cuotaPeriod === "mensual" ? "mensual" : "temporada",
    howToPay: typeof d.howToPay === "string" ? d.howToPay : "",
    updatedAt: millisOf(d.updatedAt),
  };
}

// ───────────────────────── balances ─────────────────────────
const counted = (movs: readonly CajaMov[]) => movs.filter((m) => !m.void);

/** Every player's balance (pagos − cargos, non-void), by player id. Negative = he owes. */
export function balances(movs: readonly CajaMov[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of counted(movs)) {
    if (!m.playerId || !isPlayerKind(m.kind)) continue;
    out.set(m.playerId, (out.get(m.playerId) ?? 0) + (m.kind === "pago" ? m.amount : -m.amount));
  }
  return out;
}
export const balanceOf = (movs: readonly CajaMov[], playerId: string): number => balances(movs).get(playerId) ?? 0;

/** The jar: pagos + ingresos − gastos (non-void). Cargos are what is owed, not money in. */
export function jarBalance(movs: readonly CajaMov[]): number {
  let jar = 0;
  for (const m of counted(movs)) {
    if (m.kind === "pago" || m.kind === "ingreso") jar += m.amount;
    else if (m.kind === "gasto") jar -= m.amount;
  }
  return jar;
}

/** What the team owes the jar in total (the sum of the negative balances, as a positive number). */
export function owedTotal(movs: readonly CajaMov[]): number {
  let owed = 0;
  for (const b of balances(movs).values()) if (b < 0) owed -= b;
  return owed;
}

export type BalanceState = "debe" | "al-dia" | "a-favor";
export const balanceState = (cents: number): BalanceState => (cents < 0 ? "debe" : cents > 0 ? "a-favor" : "al-dia");

export interface BalancePlayer {
  id: string;
  name: string;
  number: number | null;
}
export interface BalanceRow extends BalancePlayer {
  balance: number;
  state: BalanceState;
}
/**
 * Everyone's balance: the squad's players plus anyone else with a movement (his name from `nameOf`, else
 * «Jugador»). Those who owe first (the biggest debt first), then by dorsal (no dorsal last), then by name.
 */
export function balanceRows(movs: readonly CajaMov[], squad: readonly BalancePlayer[], nameOf: (id: string) => string = () => "Jugador"): BalanceRow[] {
  const map = balances(movs);
  const rows = new Map<string, BalancePlayer>(squad.map((p) => [p.id, p]));
  for (const id of map.keys()) if (!rows.has(id)) rows.set(id, { id, name: nameOf(id), number: null });
  return [...rows.values()]
    .map((p) => {
      const balance = map.get(p.id) ?? 0;
      return { ...p, balance, state: balanceState(balance) };
    })
    .sort((a, b) => {
      const da = Math.min(a.balance, 0);
      const db = Math.min(b.balance, 0);
      if (da !== db) return da - db;
      return (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, "es");
    });
}

// ───────────────────────── money in words ─────────────────────────
const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
/** «12,50 €» (es-ES; a negative amount keeps its sign). */
export const fmtEuros = (cents: number): string => EUR.format(cents / 100);

/** A balance in words, never colour alone: «Debe 12,50 €» / «Al día» / «A favor 3,00 €»; `you` speaks to
 *  the reader («Debes 12,50 €», «Tienes 3,00 € a favor»). */
export function balanceText(cents: number, you = false): string {
  const st = balanceState(cents);
  if (st === "al-dia") return "Al día";
  if (st === "debe") return `${you ? "Debes" : "Debe"} ${fmtEuros(-cents)}`;
  return you ? `Tienes ${fmtEuros(cents)} a favor` : `A favor ${fmtEuros(cents)}`;
}

/** A typed amount in euros («12», «12,5», «12,50», «12.50», «1.234,50 €») → cents; null when it is not
 *  one (or has more than two decimals). */
export function parseEuros(input: string): number | null {
  let s = input.replace(/[\s €]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
/** Cents back to what the captain types («12,50»; «12» when whole). */
export const centsInput = (cents: number): string => (cents % 100 ? (cents / 100).toFixed(2).replace(".", ",") : String(cents / 100));

// ───────────────────────── dates ─────────────────────────
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** «octubre» for a month index 0–11. */
export const monthName = (i: number): string => MONTHS[((i % 12) + 12) % 12];
/** The Madrid month (0–11) of an instant. */
export const madridMonth = (ms: number): number => Number(madridDate(ms).slice(5, 7)) - 1;
/** «15 oct» from `YYYY-MM-DD` («—» when there is none). */
export function dayLabel(day: string): string {
  if (!DAY_RE.test(day)) return "—";
  return `${Number(day.slice(8, 10))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}`;
}

// ───────────────────────── the captain's actions ─────────────────────────
export interface Cargo {
  playerId: string;
  amount: number;
}
const unique = (ids: readonly string[]) => [...new Set(ids.filter(Boolean))];

/**
 * Splits a cost among players, to the cent: each pays the floor of the share and the leftover cents go one
 * each to the first players (in the order given: dorsal order). Nobody gets a 0 cargo (3 cents among 7 =
 * three cargos of 1). The cargos always add up to `totalCents`; nothing when the total or the list is empty.
 */
export function splitCost(totalCents: number, playerIds: readonly string[]): Cargo[] {
  const ids = unique(playerIds);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || !ids.length) return [];
  const base = Math.floor(totalCents / ids.length);
  const rest = totalCents - base * ids.length;
  return ids.map((playerId, i) => ({ playerId, amount: base + (i < rest ? 1 : 0) })).filter((c) => c.amount > 0);
}

/** «Cobrar cuota»: one cargo of the cuota per squad player (nothing without a cuota). */
export function cuotaCargos(cuotaCents: number, playerIds: readonly string[]): Cargo[] {
  if (!Number.isSafeInteger(cuotaCents) || cuotaCents <= 0) return [];
  return unique(playerIds).map((playerId) => ({ playerId, amount: cuotaCents }));
}

/** «Cuota Temporada 1» (per season) or «Cuota octubre» (monthly, `month` 0–11). */
export const cuotaConcept = (period: CuotaPeriod, seasonName: string, month: number): string =>
  period === "mensual" ? `Cuota ${monthName(month)}` : `Cuota ${seasonName.trim() || "de la temporada"}`;

/** «Campo y árbitro · J5 vs Rival» (without its jornada: «Campo y árbitro · vs Rival»). */
export const matchCostConcept = (jornada: number | null, rival: string | undefined): string =>
  `Campo y árbitro · ${jornada ? `J${jornada} ` : ""}vs ${rival?.trim() || "Rival"}`;

export type CostMatch = Pick<ClubMatch, "status" | "ledger" | "events" | "duration" | "starters" | "bench">;
export interface CostPlayers {
  /** Who pays, in dorsal order. */
  ids: string[];
  /** `acta`: who played; `convocatoria`: no acta yet, the convocados. */
  source: "acta" | "convocatoria";
}
/**
 * Who pays a match's campo y árbitro. With an acta (a finished match): who played — the one minutes rule
 * (derived/minutesOf): minutes > 0, or played with unknown minutes (a legacy acta); and on a legacy acta
 * (no ledger) every starter too. Without an acta (or when it names nobody): the convocados (starters +
 * bench). Sorted by `order` (the dorsal; ties by id).
 */
export function matchCostPlayers(m: CostMatch, order: (playerId: string) => number): CostPlayers {
  const starters = m.starters ?? [];
  const convocados = unique([...starters, ...(m.bench ?? [])]);
  const sort = (ids: string[]) => [...ids].sort((a, b) => order(a) - order(b) || (a < b ? -1 : a > b ? 1 : 0));
  if (m.status === "finished") {
    const legacy = !m.ledger || !Object.keys(m.ledger).length;
    const named = unique([...convocados, ...Object.keys(m.ledger ?? {}), ...(m.events ?? []).flatMap((e) => [e.playerId ?? "", e.assistPlayerId ?? ""])]);
    const played = named.filter((pid) => {
      const min = minutesOf(m, pid);
      return min === null || min > 0 || (legacy && starters.includes(pid));
    });
    if (played.length) return { ids: sort(played), source: "acta" };
  }
  return { ids: sort(convocados), source: "convocatoria" };
}

// ───────────────────────── the log ─────────────────────────
/** Newest first: by date, then by when it was written. */
export const sortMovs = (movs: readonly CajaMov[]): CajaMov[] =>
  [...movs].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

export interface MovFilter {
  kind: CajaKind | "";
  playerId: string;
}
export const filterMovs = (movs: readonly CajaMov[], f: MovFilter): CajaMov[] => movs.filter((m) => (!f.kind || m.kind === f.kind) && (!f.playerId || m.playerId === f.playerId));

/** A movement's effect on the reader's eye: + money in (pago, ingreso), − money out or owed (gasto, cargo). */
export const movSign = (k: CajaKind): 1 | -1 => (k === "pago" || k === "ingreso" ? 1 : -1);

/** Is there a non-void cargo with this concept already (a cuota charged twice)? How many. */
export const chargedAlready = (movs: readonly CajaMov[], concept: string, matchId: string | null = null): number =>
  counted(movs).filter((m) => m.kind === "cargo" && (matchId ? m.matchId === matchId : m.concept === concept)).length;

// ───────────────────────── what the admin writes ─────────────────────────
/** A movement as the captain writes it (createdAt is the server's time, added by the writer). */
export interface NewCajaMov {
  kind: CajaKind;
  playerId: string | null;
  amount: number;
  concept: string;
  date: string;
  matchId: string | null;
}
/** The cajaMovs doc fields (all but createdAt), as firestore.rules validates them. */
export function cajaMovFields(seasonId: string, m: NewCajaMov, by: string) {
  return {
    seasonId,
    kind: m.kind,
    playerId: isPlayerKind(m.kind) ? m.playerId : null,
    amount: m.amount,
    concept: m.concept.trim().slice(0, CAJA_LIMITS.concept),
    date: m.date,
    matchId: m.matchId,
    by,
    void: false,
  };
}
/** «Anular»: the update the rules allow (all but voidedAt, the server's time, added by the writer): `void`
 *  false → true, signed by the captain who voids it. Nothing else changes. */
export const cajaVoidFields = (by: string) => ({ void: true as const, voidedBy: by });
/** The caja/{seasonId} fields (all but updatedAt). */
export function cajaSettingsFields(s: Pick<CajaSettings, "cuota" | "cuotaPeriod" | "howToPay">) {
  return { cuota: s.cuota, cuotaPeriod: s.cuotaPeriod, howToPay: s.howToPay.trim().slice(0, CAJA_LIMITS.howToPay) };
}
