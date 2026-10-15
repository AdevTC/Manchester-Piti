// Ausencias («no puedo del 12 al 19»), the pure rules: shared by the backend (functions/src/absences.ts,
// the triggers that answer «No puedo» for the member) and the web (src/lib/derived/absences.ts re-exports
// them). An absence is a member's own range of Madrid calendar days, inclusive, at most ABSENCE_MAX_DAYS
// long. Every published, scheduled match still to be played (the availability rule's upcoming()) whose
// Madrid date falls in it gets `matchPrivate/{match}/availability/{uid}` = «No puedo», marked as the
// absence's (`source: "absence"`, `absenceId`). A hand answer is written by the web without them, so it
// replaces the absence's and is never touched again:
//   · an absence just created overwrites the answers in its range given before it (it is the newer
//     intent); one given after it stays, however late or often the create event arrives;
//   · a match published, or moved, into a range gets «No puedo» only if the member hasn't answered;
//   · an absence deleted (or a match moved out of its range) takes back only the answers it wrote that
//     are still its own — or hands them to another absence of the member that still covers the match.

import { madridDate, MONTHS_SHORT } from "./madrid.js";

/** (re-exported: the absences' callers already take the Madrid day from here) */
export { madridDate };

/** The longest absence, in days (both ends counted): «del 1 al 120» is the most one can say at once. */
export const ABSENCE_MAX_DAYS = 120;
/** The optional note's cap (the members see it). */
export const ABSENCE_NOTE_MAX = 140;
/** What the backend writes on the answers it makes (`source`). */
export const ABSENCE_SOURCE = "absence";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** A real calendar day `YYYY-MM-DD` → its index (days since 1970-01-01); NaN when it isn't one. */
function dayIndex(day: unknown): number {
  if (typeof day !== "string" || !DAY_RE.test(day)) return NaN;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return NaN;
  return ms / DAY_MS;
}
/** Is it a real `YYYY-MM-DD` day? */
export const isDay = (day: unknown): day is string => Number.isFinite(dayIndex(day));

/** How many days a range spans, both ends counted (calendar days: a DST change doesn't shorten one); NaN
 *  when either end is not a day. «del 12 al 19» = 8. */
export function absenceDays(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from) + 1;
}

/** Why a range can't be an absence (null = it can), as the rules check it, in the words the member reads
 *  (the vestuario's form adds «Esa fecha ya pasó»: absenceFormProblem). */
export function absenceRangeProblem(from: string, to: string): string | null {
  if (!isDay(from) || !isDay(to)) return "Elige las dos fechas.";
  const days = absenceDays(from, to);
  if (days < 1) return "La fecha final va después de la inicial.";
  if (days > ABSENCE_MAX_DAYS) return `Como mucho ${ABSENCE_MAX_DAYS} días.`;
  return null;
}

export interface Absence {
  id: string;
  /** The member (their own doc). */
  uid: string;
  /** Their linked ficha, null without one. */
  playerId: string | null;
  /** Their nickname when they wrote it. */
  name: string;
  /** First day, `YYYY-MM-DD` (Madrid), inclusive. */
  from: string;
  /** Last day, `YYYY-MM-DD` (Madrid), inclusive. */
  to: string;
  /** "" without one. */
  note: string;
  /** ms (0 while the server time is pending). */
  createdAt: number;
}

const millisOf = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = v as { toMillis?: () => unknown } | null | undefined;
  const ms = t && typeof t.toMillis === "function" ? t.toMillis() : 0;
  return typeof ms === "number" && Number.isFinite(ms) ? ms : 0;
};

/** An absences doc, or null when it isn't a valid absence (never applied, never shown). */
export function parseAbsence(id: string, d: unknown): Absence | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (typeof o.uid !== "string" || !o.uid) return null;
  if (typeof o.from !== "string" || typeof o.to !== "string" || absenceRangeProblem(o.from, o.to)) return null;
  return {
    id,
    uid: o.uid,
    playerId: typeof o.playerId === "string" && o.playerId ? o.playerId : null,
    name: typeof o.name === "string" ? o.name : "",
    from: o.from,
    to: o.to,
    note: typeof o.note === "string" ? o.note : "",
    createdAt: millisOf(o.createdAt),
  };
}

/** The captains' one notice goes only for an absence the trigger's transaction still saw (`seen`: not
 *  deleted before the trigger ran) that is not entirely past (its `to` is today or later, Madrid). */
export const absenceNoticeDue = (a: Pick<Absence, "to">, seen: boolean, now: number): boolean => seen && a.to >= madridDate(now);

/** Does the absence cover this Madrid day? */
export const covers = (a: Pick<Absence, "from" | "to">, day: string): boolean => a.from <= day && day <= a.to;

export interface MatchSlot {
  id: string;
  status?: unknown;
  /** Kick-off, ms (null: no date). */
  date: number | null;
}
/** A match the member can still answer: the availability rule's upcoming() — scheduled, its date ahead. */
export const answerable = (m: Pick<MatchSlot, "status" | "date">, now: number): boolean => m.status === "scheduled" && typeof m.date === "number" && m.date > now;

/** The matches an absence answers: answerable ones whose Madrid date is in the range, soonest first. */
export function matchesInRange<T extends MatchSlot>(matches: readonly T[], range: Pick<Absence, "from" | "to">, now: number): T[] {
  return matches.filter((m) => answerable(m, now) && covers(range, madridDate(m.date as number))).sort((a, b) => (a.date as number) - (b.date as number));
}

/** What the plan looks at in an availability doc. */
export interface AvailabilityLike {
  response?: unknown;
  source?: unknown;
  absenceId?: unknown;
  /** When it was answered (a Timestamp or ms; none: an old answer). */
  at?: unknown;
}
/** Was this answer written by an absence (not by the member's hand)? */
export const byAbsence = (a: AvailabilityLike | null | undefined): boolean => a?.source === ABSENCE_SOURCE;

export interface ExistingAnswer {
  matchId: string;
  uid: string;
  doc: AvailabilityLike;
}
export interface AvailabilityRef {
  matchId: string;
  uid: string;
}
/** An answer to write: «No puedo», the absence's (the writer adds `at`, the server's time). */
export interface AvailabilityWrite extends AvailabilityRef {
  data: { response: "no"; name: string; playerId: string | null; source: typeof ABSENCE_SOURCE; absenceId: string };
}
export interface AbsencePlan {
  writes: AvailabilityWrite[];
  deletes: AvailabilityRef[];
}

export interface PlanInput {
  /**
   * The absences in force that may cover `matches`, for every member whose answers are in `existing`:
   * after an absence is written, all of that member's; after a match is written, all that cover its day.
   * (Their `name` / `playerId` sign the answers written: pass the member's current ones.)
   */
  absences: readonly Absence[];
  matches: readonly MatchSlot[];
  /** The answers stored now for those matches (and members). */
  existing: readonly ExistingAnswer[];
  /** An absence just created: it overwrites the hand answers in its range given before it (their `at`
   *  older than its `createdAt`; an answer without `at` counts as older). A hand answer given after it
   *  stays, so a late or repeated create event never undoes a «Voy» said over the absence. Otherwise only
   *  unanswered matches get «No puedo». */
  fresh?: string | null;
  now: number;
}

/** Was this hand answer given before the absence was written? (No `at`: an old answer, so yes. An absence
 *  whose `createdAt` is unknown — the server's time still pending, never so in a trigger — can't show it is
 *  the newer intent: no.) */
export function answeredBefore(doc: AvailabilityLike, a: Pick<Absence, "createdAt">): boolean {
  if (!(a.createdAt > 0)) return false;
  return millisOf(doc.at) < a.createdAt;
}

/**
 * What to write and delete so the answers follow the absences (idempotent: run it twice, the second time
 * there is nothing to do — and a hand answer given in between, being newer than the fresh absence, stays).
 * Only answerable matches are touched: once a match has kicked off (or was called off), its answers stay
 * as they are.
 */
export function absenceAvailabilityPlan({ absences, matches, existing, fresh = null, now }: PlanInput): AbsencePlan {
  const writes: AvailabilityWrite[] = [];
  const deletes: AvailabilityRef[] = [];
  // (the fresh absence first, then the earliest; ties by id: always the same one signs)
  const order = [...absences].sort((a, b) => Number(b.id === fresh) - Number(a.id === fresh) || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const stored = new Map<string, Map<string, AvailabilityLike>>();
  for (const e of existing) {
    const byUid = stored.get(e.matchId) ?? new Map<string, AvailabilityLike>();
    byUid.set(e.uid, e.doc);
    stored.set(e.matchId, byUid);
  }
  const write = (matchId: string, a: Absence): void => {
    writes.push({ matchId, uid: a.uid, data: { response: "no", name: a.name, playerId: a.playerId, source: ABSENCE_SOURCE, absenceId: a.id } });
  };
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.id) || !answerable(m, now)) continue;
    seen.add(m.id);
    const day = madridDate(m.date as number);
    const covering = new Map<string, Absence[]>();
    for (const a of order) if (covers(a, day)) covering.set(a.uid, [...(covering.get(a.uid) ?? []), a]);
    const answers = stored.get(m.id) ?? new Map<string, AvailabilityLike>();
    const uids = new Set([...covering.keys(), ...[...answers.entries()].filter(([, d]) => byAbsence(d)).map(([uid]) => uid)]);
    for (const uid of uids) {
      const cover = covering.get(uid) ?? [];
      const doc = answers.get(uid);
      if (byAbsence(doc)) {
        // still one of an absence that covers it: nothing to do
        if (doc!.response === "no" && cover.some((a) => a.id === doc!.absenceId)) continue;
        // its absence is gone (or no longer covers the match): another one takes it over, or it goes
        if (cover.length) write(m.id, cover[0]);
        else deletes.push({ matchId: m.id, uid });
      } else if (doc) {
        // the member's own answer: only an absence just created replaces it, and only if it was given
        // before the absence (the absence is then the newer intent; one given after it is)
        const newer = fresh ? cover.find((a) => a.id === fresh) : undefined;
        if (newer && answeredBefore(doc, newer)) write(m.id, newer);
      } else if (cover.length) write(m.id, cover[0]);
    }
  }
  return { writes, deletes };
}

// ── In words ──

const dayTxt = (day: string, year: boolean) => `${Number(day.slice(8, 10))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}${year ? ` ${day.slice(0, 4)}` : ""}`;

/** «el 12 oct», «del 12 al 19 oct», «del 28 oct al 3 nov», «del 28 dic 2026 al 3 ene 2027». */
export function absenceRangeText(from: string, to: string): string {
  if (!isDay(from) || !isDay(to)) return "";
  if (from === to) return `el ${dayTxt(from, false)}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  if (sameYear && from.slice(5, 7) === to.slice(5, 7)) return `del ${Number(from.slice(8, 10))} al ${dayTxt(to, false)}`;
  return `del ${dayTxt(from, !sameYear)} al ${dayTxt(to, !sameYear)}`;
}

/** «hasta 19 oct» (an absence's end, for the «Ausente · hasta 19 oct» badges). */
export const absenceUntilText = (to: string): string => (isDay(to) ? `hasta ${dayTxt(to, false)}` : "");
