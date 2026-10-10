// The match's moment as the admin lives it (pure, tested in moments.test.ts): «antes» (before kick-off),
// «juego» (being played: from kick-off to the end of its duration plus a margin, or until a captain
// whistles the end on this device), «final» (played, the acta not published yet) and «publicado». Hoy
// picks its hero from them: the match being played, else the one just played (36 h), else the next one.
import { dateMillis } from "../../../../functions/src/matchEngine";

export type MatchMoment = "antes" | "juego" | "final" | "publicado";
const MIN = 60_000;
/** Minutes after the duration that still count as «en juego» (added time; the live window allows +15′). */
export const LIVE_MARGIN_MIN = 15;
/** How long the match just played stays as Hoy's hero (its FINAL / the vitrina). */
export const RECENT_HERO_MS = 36 * 60 * MIN;
/** …unless the next match kicks off within this long. */
export const NEXT_WINS_MS = 12 * 60 * MIN;
const DEFAULT_DURATION = 50;

export interface MomentMatch {
  id: string;
  date?: unknown;
  duration?: number;
  status?: string;
  /** In the public calendar (matches/{id}). */
  published?: boolean;
  /** A draft is waiting in matchDrafts. */
  draft?: boolean;
  archived?: boolean;
}

/** The acta is public and final: published, no draft over it, marked finished. */
export const isPublishedFinal = (m: MomentMatch) => !!m.published && !m.draft && m.status === "finished";
/** Cancelled / postponed / archived matches never get a moment on Hoy. */
export const isOff = (m: MomentMatch) => m.status === "cancelled" || m.status === "postponed" || !!m.archived;

/** When «en juego» ends for this match (kick-off + duration + margin), ms. */
export function liveUntil(m: Pick<MomentMatch, "date" | "duration">): number {
  return dateMillis(m.date) + ((m.duration ?? DEFAULT_DURATION) + LIVE_MARGIN_MIN) * MIN;
}

/**
 * The match's moment at `now`. `whistled` = a captain pressed «Pitar el final» (the match leaves «juego»
 * early). A published final acta is «publicado» whatever the clock says.
 */
export function matchMoment(m: MomentMatch, now: number, whistled = false): MatchMoment {
  if (isPublishedFinal(m)) return "publicado";
  const start = dateMillis(m.date);
  if (!Number.isFinite(start) || now < start) return "antes";
  if (m.status !== "finished" && !whistled && now < liveUntil(m)) return "juego";
  return "final";
}

export interface Hero<M extends MomentMatch> {
  match: M;
  moment: MatchMoment;
}
/**
 * Hoy's hero: the match being played (the earliest, if two overlap), else the one played in the last
 * 36 h (its FINAL, published or not) unless the next one kicks off within 12 h, else the next one to
 * play. Null = nothing to show (off-season).
 */
export function hoyHero<M extends MomentMatch>(matches: readonly M[], now: number, whistled: ReadonlySet<string> = new Set()): Hero<M> | null {
  const on = matches.filter((m) => !isOff(m) && Number.isFinite(dateMillis(m.date))).sort((a, b) => dateMillis(a.date) - dateMillis(b.date));
  const moment = (m: M) => matchMoment(m, now, whistled.has(m.id));
  const live = on.find((m) => moment(m) === "juego");
  if (live) return { match: live, moment: "juego" };
  const next = on.find((m) => dateMillis(m.date) > now);
  const recent = on.filter((m) => dateMillis(m.date) <= now && now - dateMillis(m.date) <= RECENT_HERO_MS).at(-1);
  // A match about to start (12 h) wins over the one just played: its convocatoria is what matters now.
  const soon = next && dateMillis(next.date) - now <= NEXT_WINS_MS;
  if (recent && !soon) return { match: recent, moment: moment(recent) };
  if (next) return { match: next, moment: "antes" };
  if (recent) return { match: recent, moment: moment(recent) };
  return null;
}

/** The first match to play after `after` (Hoy's «Después»). */
export function matchAfter<M extends MomentMatch>(matches: readonly M[], after: M | null, now: number): M | null {
  const from = after ? dateMillis(after.date) : now;
  return (
    matches
      .filter((m) => !isOff(m) && m.id !== after?.id && dateMillis(m.date) > Math.max(from, now) && m.status !== "finished")
      .sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0] ?? null
  );
}

/** «1d 14h 32m» / «14h 32m» / «32m» until `at` (never negative: «0m»). */
export function countdown(at: number, now: number): string {
  const total = Math.max(0, Math.floor((at - now) / MIN));
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}
/** The short form the phone's plaque uses: «1d 14h» / «14h 32m» / «32m». */
export function countdownShort(at: number, now: number): string {
  const full = countdown(at, now).split(" ");
  return full.length > 2 ? full.slice(0, 2).join(" ") : full.join(" ");
}

/** The running match clock since kick-off: «31:12» (minutes:seconds). */
export function clockText(start: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
