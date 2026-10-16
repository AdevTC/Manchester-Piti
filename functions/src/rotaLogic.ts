// Turnos del equipo («¿a quién le toca lavar las camisetas?»), the pure rules: shared by the backend (the
// freeze and the «Te toca…» notice, rota.ts) and the web (src/lib/derived/rota.ts re-exports them). Spec:
// docs/superpowers/specs/2026-10-16-turnos-design.md.
//
// The captains keep `rotas/{seasonId}` = { jobs: [{ id, name, icon, awayOnly, order }] }. The history is
// real: once a match is played (its date has passed and it isn't cancelled or postponed; the acta isn't
// awaited) the backend FREEZES its turns into `rotaTurns/{matchId}` = { seasonId, frozen: true, [jobId]:
// { playerId, swappedFrom?, at } }. The flag is doc-level (never per job) and only the backend sets it; a
// captain's pin or «Lo hizo otro» stays as he set it, and he can still edit a frozen turn.
//
// The next turn of a job: among the eligible members in the job's current order (not «No puedo», not
// absent that day, the car only away), the one whose last turn of THIS job this season is the oldest
// (never: oldest of all), ties by position in the order. So inserting, removing or reordering members, or
// deleting an absence, never reshuffles the past, and a newcomer comes up soon but fairly. No double jobs:
// a member already given a job of the match (pinned, or an earlier job) is skipped for the later ones, if
// anyone else is eligible. A played match the backend hasn't frozen yet counts as computed (pins kept).
import { madridDate } from "./madrid.js";

/** The icons a job can wear (the same list as firestore.rules). */
export const ROTA_ICONS = ["shirt", "ball", "car", "bottle", "bag", "key"] as const;
export type RotaIconId = (typeof ROTA_ICONS)[number];
export const ROTA_ICON_LABEL: Record<RotaIconId, string> = { shirt: "Camiseta", ball: "Balón", car: "Coche", bottle: "Agua", bag: "Bolsa", key: "Llaves" };
/** The caps (the same as firestore.rules). */
export const ROTA_LIMITS = { jobs: 6, name: 30, order: 40, id: 40 } as const;
/** A job id can't be "frozen": rotaTurns keeps its freeze flag at that key (the same as firestore.rules). */
const RESERVED_IDS: readonly string[] = ["frozen"];

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
/** An absence as the rota needs it (derived/absences Absence fits). */
export interface RotaAbsence {
  playerId: string | null;
  from: string;
  to: string;
}
/** One job's entry in rotaTurns/{matchId}: a captain's pin or swap, or the backend's freeze. */
export interface PinnedTurn {
  playerId: string;
  /** Who the rota had (a swap, or «Lo hizo otro»). */
  swappedFrom?: string;
}
/** rotaTurns/{matchId} as read. */
export interface RotaTurnsDoc {
  /** The backend froze it (the match was played): its entries are the turns that count, as they are. */
  frozen: boolean;
  /** jobId → its entry. */
  turns: Readonly<Record<string, PinnedTurn | undefined>>;
}
export const NO_ROTA_TURNS: RotaTurnsDoc = { frozen: false, turns: {} };
/** A played match's turns as the history reads them: jobId → who did it. */
export interface PlayedTurns {
  id: string;
  turns: Readonly<Record<string, string>>;
}

export interface Turn {
  job: RotaJob;
  /** Who does it: the pin when there is one, else the computed member (null: nobody can). */
  playerId: string | null;
  /** Who the rota gives it to (null: everyone in the order is out, or the order is empty). A frozen
   *  turn's: who the rota had when it froze. */
  computed: string | null;
  /** A captain set it (a pin; once frozen: a swap or «Lo hizo otro»). */
  pinned: boolean;
  /** The entry's `swappedFrom` (null without one). */
  swappedFrom: string | null;
  /** The members passed over for this match (a «No puedo» or an absence), most overdue first. */
  skipped: string[];
  /** The match's turns are frozen (played): history now. */
  frozen: boolean;
}

const ids = (order: readonly string[]): string[] => [...new Set(order.filter((x) => typeof x === "string" && x.length > 0))];
const at = (m: RotaMatch) => (typeof m.date === "number" && Number.isFinite(m.date) ? m.date : null);

/** Is `playerId` out of `m`: he answered «No puedo» (`answers`: that match's), or one of his absences
 *  covers its Madrid day. */
export function outOf(playerId: string, m: RotaMatch, answers: readonly RotaAnswer[], absences: readonly RotaAbsence[]): boolean {
  if (answers.some((a) => a.playerId === playerId && a.response === "no")) return true;
  const t = at(m);
  if (t === null) return false;
  const day = madridDate(t);
  return absences.some((a) => a.playerId === playerId && a.from <= day && day <= a.to);
}

/** Does `job` have a turn in `m`? (The car's: away matches only.) */
export const jobApplies = (job: Pick<RotaJob, "awayOnly">, m: Pick<RotaMatch, "home">): boolean => !(job.awayOnly && m.home === true);

/** Played: its date has passed (or its acta is out) and it isn't cancelled or postponed. */
export function rotaPlayed(m: RotaMatch, now: number): boolean {
  if (m.status === "cancelled" || m.status === "postponed") return false;
  const t = at(m);
  return t !== null && (t <= now || m.status === "finished");
}

/** `a` (dated) comes before `b` (an undated `b`: everything does). */
const earlier = (a: RotaMatch, b: RotaMatch): boolean => {
  const ta = at(a) as number;
  const tb = at(b);
  return tb === null || ta < tb || (ta === tb && a.id < b.id);
};
const byDate = (a: RotaMatch, b: RotaMatch) => (at(a) as number) - (at(b) as number) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The season's played matches before `match`, oldest first (date, then id: deterministic). */
export function rotaPast(match: RotaMatch, matches: readonly RotaMatch[], now: number): RotaMatch[] {
  return matches
    .filter((m) => m.id !== match.id && rotaPlayed(m, now) && earlier(m, match))
    .filter((m) => !match.seasonId || !m.seasonId || m.seasonId === match.seasonId)
    .sort(byDate);
}

/** Who does each job, of a list of turns (the ones nobody can do left out). */
export const playedTurns = (turns: readonly Turn[]): Record<string, string> =>
  Object.fromEntries(turns.filter((t) => t.playerId).map((t) => [t.job.id, t.playerId as string]));

/** A frozen doc's entries as history. */
const frozenTurns = (doc: RotaTurnsDoc): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(doc.turns)) if (v?.playerId) out[k] = v.playerId;
  return out;
};

/**
 * The season's history before `match`, oldest first: each played match's frozen turns (`docs`: the
 * season's rotaTurns, by match id), or, not frozen yet, its turns as computed now (its pins kept; without
 * answers or absences: the client never reads the history's, the backend freezes with them).
 */
export function rotaHistory(match: RotaMatch, matches: readonly RotaMatch[], docs: Readonly<Record<string, RotaTurnsDoc | undefined>>, rota: Rota | null | undefined, now: number): PlayedTurns[] {
  const out: PlayedTurns[] = [];
  for (const m of rotaPast(match, matches, now)) out.push(playedEntry(m, docs[m.id], rota, out));
  return out;
}

/** One played match as history: its frozen entries, or its turns computed after `soFar`. */
export const playedEntry = (m: RotaMatch, doc: RotaTurnsDoc | undefined, rota: Rota | null | undefined, soFar: readonly PlayedTurns[]): PlayedTurns => ({
  id: m.id,
  turns: doc?.frozen ? frozenTurns(doc) : playedTurns(turnsFor(m, rota, soFar, [], [], doc)),
});

/** The job's next member: the eligible one longest without it (never: first), ties by order; one already
 *  `taken` in this match only when nobody else can. `skipped`: the out ones ranked before him. */
function nextFor(job: RotaJob, m: RotaMatch, history: readonly PlayedTurns[], answers: readonly RotaAnswer[], absences: readonly RotaAbsence[], taken: ReadonlySet<string>) {
  const last = new Map<string, number>();
  history.forEach((h, i) => {
    const p = h.turns[job.id];
    if (p) last.set(p, i);
  });
  const ranked = ids(job.order)
    .map((p, pos) => ({ p, pos, last: last.get(p) ?? -1 }))
    .sort((a, b) => a.last - b.last || a.pos - b.pos);
  const skipped: string[] = [];
  let fallback: { p: string; skipped: string[] } | null = null;
  for (const r of ranked) {
    if (outOf(r.p, m, answers, absences)) skipped.push(r.p);
    else if (taken.has(r.p)) fallback ??= { p: r.p, skipped: [...skipped] };
    else return { chosen: r.p, skipped };
  }
  return fallback ? { chosen: fallback.p, skipped: fallback.skipped } : { chosen: null, skipped };
}

/**
 * The turns of `match`: one per job that applies to it (the car's: away only), in the rota's job order.
 * `history`: rotaHistory's; `answers` and `absences`: this match's (absences: any that may cover its day);
 * `doc`: its rotaTurns (null: none). A frozen match shows its entries as they are.
 */
export function turnsFor(
  match: RotaMatch,
  rota: Rota | null | undefined,
  history: readonly PlayedTurns[],
  answers: readonly RotaAnswer[],
  absences: readonly RotaAbsence[],
  doc: RotaTurnsDoc | null | undefined,
): Turn[] {
  if (!rota) return [];
  const pins = doc?.turns ?? {};
  const pinOf = (job: RotaJob): PinnedTurn | null => {
    const p = pins[job.id];
    return p && typeof p.playerId === "string" && p.playerId ? p : null;
  };
  const swapOf = (p: PinnedTurn | null) => (p && typeof p.swappedFrom === "string" && p.swappedFrom ? p.swappedFrom : null);
  const out: Turn[] = [];
  if (doc?.frozen) {
    for (const job of rota.jobs) {
      const p = pinOf(job);
      if (!p && !jobApplies(job, match)) continue;
      const from = swapOf(p);
      out.push({ job, playerId: p?.playerId ?? null, computed: from ?? p?.playerId ?? null, pinned: !!from, swappedFrom: from, skipped: [], frozen: true });
    }
    return out;
  }
  const jobs = rota.jobs.filter((j) => jobApplies(j, match));
  // (the pinned members are taken first, then each job's member as it is given)
  const taken = new Set<string>(jobs.flatMap((j) => pinOf(j)?.playerId ?? []));
  for (const job of jobs) {
    const p = pinOf(job);
    const next = nextFor(job, match, history, answers, absences, p ? new Set([...taken].filter((x) => x !== p.playerId)) : taken);
    if (!p && next.chosen) taken.add(next.chosen);
    out.push({ job, playerId: p ? p.playerId : next.chosen, computed: next.chosen, pinned: !!p, swappedFrom: swapOf(p), skipped: next.skipped, frozen: false });
  }
  return out;
}

/**
 * `playerId` just went out of an upcoming match (his «No puedo», or an absence that covers its day): the
 * turns that pass to someone else because of it, with who has them now — the jobs he held, and any job
 * whose member moved up to cover one of his (no double jobs). Never a pinned job (the captain's word
 * stands: he sorts it out). Empty when the match is frozen, when he held no computed turn, or when he isn't out after all
 * (he changed back to «Voy»). `answers` and `absences`: the match's as they are now (his own included).
 */
export function handoverTurns(
  match: RotaMatch,
  rota: Rota | null | undefined,
  history: readonly PlayedTurns[],
  answers: readonly RotaAnswer[],
  absences: readonly RotaAbsence[],
  doc: RotaTurnsDoc | null | undefined,
  playerId: string,
): Turn[] {
  if (!rota || doc?.frozen || !outOf(playerId, match, answers, absences)) return [];
  // (the turns as they were with him in)
  const before = turnsFor(
    match,
    rota,
    history,
    answers.filter((a) => a.playerId !== playerId),
    absences.filter((a) => a.playerId !== playerId),
    doc,
  );
  if (!before.some((t) => t.playerId === playerId && !t.pinned)) return [];
  const was = new Map(before.map((t) => [t.job.id, t.playerId]));
  return turnsFor(match, rota, history, answers, absences, doc).filter((t) => !t.pinned && t.playerId !== null && t.playerId !== was.get(t.job.id));
}

// ── Words ──

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const DEFAULT_NAME: Readonly<Record<string, string>> = Object.fromEntries(DEFAULT_JOBS.map((j) => [j.id, j.name]));
/** The job still wears its default name (a renamed one speaks with its own). */
const isDefault = (job: Pick<RotaJob, "id" | "name">, id: string) => job.id === id && DEFAULT_NAME[id] === job.name.trim();
/** The short label of a job in «Lava: Hugo · Balones: Dani» (the defaults have their own; others: the name). */
export function jobShort(job: Pick<RotaJob, "id" | "name">): string {
  if (isDefault(job, "lavar")) return "Lava";
  if (isDefault(job, "balones")) return "Balones";
  if (isDefault(job, "coche")) return "Coche";
  return job.name.trim();
}
/** What the member does, as a verb phrase: «lavar la equipación», «llevar los balones y petos». */
export function jobTask(job: Pick<RotaJob, "id" | "name">): string {
  if (isDefault(job, "balones")) return "llevar los balones y petos";
  if (isDefault(job, "coche")) return "poner el coche";
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
  if (mine.length) return { mine: true, text: `Te toca: ${joinY(mine.map((t) => jobTask(t.job)))}` };
  const parts = turns.filter((t) => t.playerId).map((t) => `${jobShort(t.job)}: ${nameOf(t.playerId as string)}`);
  return parts.length ? { mine: false, text: parts.join(" · ") } : null;
}

// ── Validation (the same as firestore.rules) ──

/** A job id: also the rotaTurns keys' pattern. */
export const ROTA_ID_RE = /^[a-z0-9-]{1,40}$/;
const validId = (id: string) => ROTA_ID_RE.test(id) && !RESERVED_IDS.includes(id);
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
    if (!validId(j.id) || seen.has(j.id)) errs.push(`«${n}»: identificador no válido.`);
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
    if (typeof r.id !== "string" || !validId(r.id) || typeof r.name !== "string" || !r.name.trim()) continue;
    const icon = (ROTA_ICONS as readonly string[]).includes(r.icon as string) ? (r.icon as RotaIconId) : "shirt";
    const order = Array.isArray(r.order) ? ids(r.order.filter((x): x is string => typeof x === "string")).slice(0, ROTA_LIMITS.order) : [];
    out.push({ id: r.id, name: r.name.slice(0, ROTA_LIMITS.name), icon, awayOnly: r.awayOnly === true, order });
  }
  return { jobs: out };
}

/** A rotaTurns doc as read: its freeze flag and the well-formed entries (keys with a job id's shape). */
export function parseRotaTurns(d: unknown): RotaTurnsDoc {
  if (!d || typeof d !== "object") return NO_ROTA_TURNS;
  const turns: Record<string, PinnedTurn> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (!validId(k) || !v || typeof v !== "object") continue;
    const t = v as Record<string, unknown>;
    if (typeof t.playerId !== "string" || !t.playerId) continue;
    turns[k] = { playerId: t.playerId, ...(typeof t.swappedFrom === "string" && t.swappedFrom ? { swappedFrom: t.swappedFrom } : {}) };
  }
  return { frozen: (d as { frozen?: unknown }).frozen === true, turns };
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
  for (let n = 2; taken.includes(id) || RESERVED_IDS.includes(id); n++) id = `${base}-${n}`;
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

/** The personal notice «Te toca lavar la equipación tras el partido del sábado» (once per match, job and
 *  member: a swap tells the new one too). */
export interface RotaNotice {
  topic: "personal";
  title: string;
  body: string;
  tag: string;
  url: string;
  log: string;
}
export function rotaNotice(matchId: string, job: Pick<RotaJob, "id" | "name">, playerId: string, match: { date: number | null; rival?: string }, now: number): RotaNotice {
  const day = matchDayText(match.date, now);
  const when = isDefault(job, "lavar") ? `tras el partido ${day}` : `en el partido ${day}`;
  const rival = match.rival?.trim();
  return {
    topic: "personal",
    title: `Te toca ${jobTask(job)} ${when}`,
    body: `${rival ? `Contra ${rival}. ` : ""}Si no puedes, marca «No puedo» y pasa al siguiente.`,
    tag: `rota-${matchId}-${job.id}`,
    url: `/matches/${encodeURIComponent(matchId)}?tab=vestuario`,
    log: `rota-${matchId}-${job.id}-${playerId}`,
  };
}
