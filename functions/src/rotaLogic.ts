// Turnos del equipo («¿a quién le toca lavar las camisetas?»), the pure rules: shared by the backend (the
// convocatoria's «Te toca…» notice, rota.ts) and the web (src/lib/derived/rota.ts re-exports them). Spec:
// docs/superpowers/specs/2026-10-16-turnos-design.md.
//
// The captains keep `rotas/{seasonId}` = { jobs: [{ id, name, icon, awayOnly, order }] }. For each job the
// turn walks its `order` (player ids), one member per match, from the season's completed matches in date
// order: a cursor starts at the first member; at each match the first ELIGIBLE member from the cursor does
// it, and the cursor moves to the member after him — so whoever was skipped (a «No puedo», an absence that
// covers the match's Madrid day) waits until the order comes round again («counting skips»). A job with
// `awayOnly` (the car) only counts away matches, and has no turn at home. A captain's `rotaTurns/{matchId}`
// overrides one match («Cambiar» / «Lo hizo otro»: `{ playerId, swappedFrom? }`) without moving the cursor:
// the rota goes on as computed, so one override never reshuffles everyone else's turns.
import { madridDate } from "./madrid.js";

/** The icons a job can wear (the same list as firestore.rules). */
export const ROTA_ICONS = ["shirt", "ball", "car", "bottle", "bag", "key"] as const;
export type RotaIconId = (typeof ROTA_ICONS)[number];
export const ROTA_ICON_LABEL: Record<RotaIconId, string> = { shirt: "Camiseta", ball: "Balón", car: "Coche", bottle: "Agua", bag: "Bolsa", key: "Llaves" };
/** The caps (the same as firestore.rules). */
export const ROTA_LIMITS = { jobs: 6, name: 30, order: 40, id: 40 } as const;

export interface RotaJob {
  id: string;
  /** «Lavar la equipación» (≤ 30). */
  name: string;
  icon: RotaIconId;
  /** Only away matches (the car): no turn at home. */
  awayOnly: boolean;
  /** The members' player ids, in turn order (≤ 40). */
  order: string[];
}
export interface Rota {
  jobs: RotaJob[];
}

/** The jobs offered when a season has none yet (the order is filled with the season's roster). */
export const DEFAULT_JOBS: readonly Omit<RotaJob, "order">[] = [
  { id: "lavar", name: "Lavar la equipación", icon: "shirt", awayOnly: false },
  { id: "balones", name: "Balones y petos", icon: "ball", awayOnly: false },
  { id: "coche", name: "Coche a los partidos fuera", icon: "car", awayOnly: true },
];

/** What the rota reads of a match. */
export interface RotaMatch {
  id: string;
  /** Kick-off, ms (null: no date yet). */
  date: number | null;
  /** Home match (the car's job skips it). */
  home?: boolean;
  status?: unknown;
  seasonId?: string;
}
/** A convocatoria answer (vestuario Availability / matchPrivate/{m}/availability/{uid}). */
export interface RotaAnswer {
  playerId?: string | null;
  response?: unknown;
}
/** Each match's answers, by match id (a match without answers: everyone available). */
export type RotaAvailability = Readonly<Record<string, readonly RotaAnswer[] | undefined>>;
/** An absence as the rota needs it (derived/absences Absence fits). */
export interface RotaAbsence {
  playerId: string | null;
  from: string;
  to: string;
}
/** A captain's override of one job for one match (rotaTurns/{matchId}[jobId]). */
export interface PinnedTurn {
  playerId: string;
  /** Who the rota had (a swap, or «Lo hizo otro»). */
  swappedFrom?: string;
}
/** rotaTurns/{matchId}: jobId → its override. */
export type RotaTurnsDoc = Readonly<Record<string, PinnedTurn | undefined>>;

export interface Turn {
  job: RotaJob;
  /** Who does it: the override when there is one, else the computed member (null: nobody can). */
  playerId: string | null;
  /** Who the rota gives it to (null: everyone in the order is out, or the order is empty). */
  computed: string | null;
  /** A captain set it (rotaTurns). */
  pinned: boolean;
  /** The override's `swappedFrom` (null without one). */
  swappedFrom: string | null;
  /** The members passed over for this match, in order (a «No puedo» or an absence). */
  skipped: string[];
}

const ids = (order: readonly string[]): string[] => [...new Set(order.filter((x) => typeof x === "string" && x.length > 0))];
const at = (m: RotaMatch) => (typeof m.date === "number" && Number.isFinite(m.date) ? m.date : null);

/** Is `playerId` out of `m`: he answered «No puedo», or one of his absences covers its Madrid day. */
export function outOf(playerId: string, m: RotaMatch, availability: RotaAvailability, absences: readonly RotaAbsence[]): boolean {
  if ((availability[m.id] ?? []).some((a) => a.playerId === playerId && a.response === "no")) return true;
  const t = at(m);
  if (t === null) return false;
  const day = madridDate(t);
  return absences.some((a) => a.playerId === playerId && a.from <= day && day <= a.to);
}

/** Does `job` have a turn in `m`? (The car's: away matches only.) */
export const jobApplies = (job: Pick<RotaJob, "awayOnly">, m: Pick<RotaMatch, "home">): boolean => !(job.awayOnly && m.home === true);

/** The season's completed matches before `match`, oldest first (date, then id: deterministic). */
export function rotaHistory(match: RotaMatch, played: readonly RotaMatch[]): RotaMatch[] {
  const t = at(match);
  return played
    .filter((m) => m.id !== match.id && m.status === "finished" && at(m) !== null)
    .filter((m) => !match.seasonId || !m.seasonId || m.seasonId === match.seasonId)
    .filter((m) => t === null || (at(m) as number) < t || ((at(m) as number) === t && m.id < match.id))
    .sort((a, b) => (at(a) as number) - (at(b) as number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** From `cursor`, the first member not out of `m` (index in `order`, -1: nobody) and who was passed over. */
function pick(order: readonly string[], cursor: number, m: RotaMatch, availability: RotaAvailability, absences: readonly RotaAbsence[]) {
  const skipped: string[] = [];
  for (let k = 0; k < order.length; k++) {
    const i = (cursor + k) % order.length;
    if (!outOf(order[i], m, availability, absences)) return { index: i, skipped };
    skipped.push(order[i]);
  }
  return { index: -1, skipped };
}

/**
 * The turns of `match`: one per job that applies to it (the car's: away only), in the rota's job order.
 * `playedMatches`: the club's matches (the season's completed ones before `match` count); `availability`:
 * each match's answers (the history's and this match's); `absences`: the team's; `pinned`: this match's
 * rotaTurns doc (null: none).
 */
export function turnsFor(
  match: RotaMatch,
  rota: Rota | null | undefined,
  playedMatches: readonly RotaMatch[],
  availability: RotaAvailability,
  absences: readonly RotaAbsence[],
  pinned: RotaTurnsDoc | null | undefined,
): Turn[] {
  if (!rota) return [];
  const history = rotaHistory(match, playedMatches);
  const out: Turn[] = [];
  for (const job of rota.jobs) {
    if (!jobApplies(job, match)) continue;
    const order = ids(job.order);
    let cursor = 0;
    if (order.length) {
      for (const h of history) {
        if (!jobApplies(job, h)) continue;
        const p = pick(order, cursor, h, availability, absences);
        if (p.index >= 0) cursor = (p.index + 1) % order.length;
      }
    }
    const p = order.length ? pick(order, cursor, match, availability, absences) : { index: -1, skipped: [] };
    const computed = p.index >= 0 ? order[p.index] : null;
    const pin = pinned?.[job.id];
    const own = pin && typeof pin.playerId === "string" && pin.playerId ? pin : null;
    out.push({
      job,
      playerId: own ? own.playerId : computed,
      computed,
      pinned: !!own,
      swappedFrom: own && typeof own.swappedFrom === "string" && own.swappedFrom ? own.swappedFrom : null,
      skipped: p.skipped,
    });
  }
  return out;
}

// ── Words ──

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** The short label of a job in «Lava: Hugo · Balones: Dani» (the defaults have their own; others: the name). */
export function jobShort(job: Pick<RotaJob, "id" | "name">): string {
  if (job.id === "lavar") return "Lava";
  if (job.id === "balones") return "Balones";
  if (job.id === "coche") return "Coche";
  return job.name;
}
/** What the member does, as a verb phrase: «lavar la equipación», «llevar los balones y petos». */
export function jobTask(job: Pick<RotaJob, "id" | "name">): string {
  if (job.id === "balones") return "llevar los balones y petos";
  if (job.id === "coche") return "poner el coche";
  return lower(job.name.trim());
}
const joinY = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);

/**
 * The one line of «Hoy» and the vestuario's hero: «Te toca: lavar la equipación» when one of the turns is
 * `me` (a player id), else «Lava: Hugo · Balones: Dani» (the turns nobody can do are left out). Null when
 * there is nothing to say.
 */
export function turnsLine(turns: readonly Turn[], nameOf: (playerId: string) => string, me: string | null | undefined): { mine: boolean; text: string } | null {
  const mine = me ? turns.filter((t) => t.playerId === me) : [];
  if (mine.length) return { mine: true, text: `Te toca: ${joinY(mine.map((t) => lower(t.job.name.trim())))}` };
  const parts = turns.filter((t) => t.playerId).map((t) => `${jobShort(t.job)}: ${nameOf(t.playerId as string)}`);
  return parts.length ? { mine: false, text: parts.join(" · ") } : null;
}

// ── Validation (the same as firestore.rules) ──

const ID_RE = /^[a-z0-9-]{1,40}$/;
/** Why the rota can't be saved (empty: it can), in the words the captain reads. */
export function rotaErrors(rota: Rota): string[] {
  const errs: string[] = [];
  if (rota.jobs.length > ROTA_LIMITS.jobs) errs.push(`Como mucho ${ROTA_LIMITS.jobs} turnos.`);
  const seen = new Set<string>();
  for (const [i, j] of rota.jobs.entries()) {
    const n = j.name.trim() || `El turno ${i + 1}`;
    if (!j.name.trim()) errs.push(`El turno ${i + 1} necesita un nombre.`);
    if (j.name.trim().length > ROTA_LIMITS.name) errs.push(`«${n}»: como mucho ${ROTA_LIMITS.name} letras.`);
    if (j.order.length > ROTA_LIMITS.order) errs.push(`«${n}»: como mucho ${ROTA_LIMITS.order} jugadores en el orden.`);
    if (!ID_RE.test(j.id) || seen.has(j.id)) errs.push(`«${n}»: identificador no válido.`);
    if (!(ROTA_ICONS as readonly string[]).includes(j.icon)) errs.push(`«${n}»: elige un icono.`);
    seen.add(j.id);
  }
  return errs;
}

/** A rota doc as read (rotas/{seasonId}): null when it isn't one; bad jobs are dropped, orders cleaned. */
export function parseRota(d: unknown): Rota | null {
  if (!d || typeof d !== "object") return null;
  const jobs = (d as { jobs?: unknown }).jobs;
  if (!Array.isArray(jobs)) return null;
  const out: RotaJob[] = [];
  for (const j of jobs.slice(0, ROTA_LIMITS.jobs)) {
    if (!j || typeof j !== "object") continue;
    const r = j as Record<string, unknown>;
    if (typeof r.id !== "string" || !r.id || typeof r.name !== "string" || !r.name.trim()) continue;
    const icon = (ROTA_ICONS as readonly string[]).includes(r.icon as string) ? (r.icon as RotaIconId) : "shirt";
    const order = Array.isArray(r.order) ? ids(r.order.filter((x): x is string => typeof x === "string")).slice(0, ROTA_LIMITS.order) : [];
    out.push({ id: r.id, name: r.name.slice(0, ROTA_LIMITS.name), icon, awayOnly: r.awayOnly === true, order });
  }
  return { jobs: out };
}

/** A rotaTurns doc as read: only the well-formed overrides. */
export function parseRotaTurns(d: unknown): RotaTurnsDoc {
  if (!d || typeof d !== "object") return {};
  const out: Record<string, PinnedTurn> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const t = v as Record<string, unknown>;
    if (typeof t.playerId !== "string" || !t.playerId) continue;
    out[k] = { playerId: t.playerId, ...(typeof t.swappedFrom === "string" && t.swappedFrom ? { swappedFrom: t.swappedFrom } : {}) };
  }
  return out;
}

/** A fresh job id from its name («Lavar la equipación» → "lavar-la-equipacion"), unique among `taken`. */
export function jobIdFor(name: string, taken: readonly string[]): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "turno";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

// ── The notice ──

const TZ = "Europe/Madrid";
const WEEKDAY = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long" });
const DAY_NUM = new Intl.DateTimeFormat("es-ES", { timeZone: TZ, day: "numeric" });

/** «del sábado» within a week of `now`, «del sábado 24» further away (no date: «del próximo partido»). */
export function matchDayText(date: number | null, now: number): string {
  if (date === null || !Number.isFinite(date)) return "del próximo partido";
  const wd = WEEKDAY.format(date);
  return date - now <= 6 * 86_400_000 ? `del ${wd}` : `del ${wd} ${DAY_NUM.format(date)}`;
}

/** The personal notice «Te toca lavar la equipación tras el partido del sábado» (once per match and job). */
export interface RotaNotice {
  topic: "personal";
  title: string;
  body: string;
  tag: string;
  url: string;
  log: string;
}
export function rotaNotice(matchId: string, job: Pick<RotaJob, "id" | "name">, match: { date: number | null; rival?: string }, now: number): RotaNotice {
  const day = matchDayText(match.date, now);
  const when = job.id === "lavar" ? `tras el partido ${day}` : `en el partido ${day}`;
  const rival = match.rival?.trim();
  return {
    topic: "personal",
    title: `Te toca ${jobTask(job)} ${when}`,
    body: `${rival ? `Contra ${rival}. ` : ""}Si no puedes, díselo al capitán para que lo cambie.`,
    tag: `rota-${matchId}-${job.id}`,
    url: `/matches/${encodeURIComponent(matchId)}?tab=vestuario`,
    log: `rota-${matchId}-${job.id}`,
  };
}
