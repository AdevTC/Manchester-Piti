// Pure rules of the push notices (functions/src/push.ts): which change of a match (or of the official
// seven on the pizarra) deserves a notice, to which topic, and its words. Apart so the app's tests can
// run them.
import { resultLetter, resultTitle } from "./result.js";

export const TOPICS = ["start", "goals", "final", "mvp", "dates", "lineup"] as const;
/** Personal notices of the vestuario door: "door" for admins (someone asks to come in), "access" for whoever asked. */
export const DOOR_TOPICS = ["door", "access"] as const;
/** Personal notices of the convocatoria: the reminders to whoever hasn't answered, and (captains) the
 *  answers changed at the last minute. The subscription carries the member's uid. */
export const PERSONAL_TOPICS = ["convocatoria"] as const;
export type Topic = (typeof TOPICS)[number] | (typeof DOOR_TOPICS)[number] | (typeof PERSONAL_TOPICS)[number];

export interface Notice {
  topic: Topic;
  title: string;
  body: string;
  /** Same tag replaces the previous notice of the same kind for that match on the phone. */
  tag: string;
  url: string;
}
interface Ev {
  id: string;
  type: string;
  minute?: number;
  playerId?: string;
}
export interface MatchLike {
  rival?: string;
  status?: string;
  date?: number;
  events?: Ev[];
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  voteClosesAt?: number;
  archived?: boolean;
  seasonId?: string;
  /** The convocatoria's titulares (its notice goes when they first appear on a published match). */
  starters?: string[];
  /** setConvocatoria's stamp (ms): the convocatoria is managed (and announced) by «Convocar y avisar». */
  convocatoriaAt?: number;
  /** v2 actas carry a server clock (matchClock.ts); only its start is the kick-off. */
  version?: number;
  clock?: { phase?: string };
}

const OURS = new Set(["goal", "goal_penalty", "goal_freekick", "opponent_own_goal"]);
const THEIRS = new Set(["opponent_goal", "own_goal"]);
const TZ = "Europe/Madrid";

export function liveScore(events: Ev[] | undefined) {
  let gf = 0, ga = 0;
  for (const e of events ?? []) {
    if (OURS.has(e.type)) gf++;
    else if (THEIRS.has(e.type)) ga++;
  }
  return { gf, ga };
}

const when = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms).replace(".", "");

/**
 * What changed between two versions of a match, as notices: the clock starting (the kick-off), each
 * goal written while it isn't finished, the final whistle (and the MVP vote opening), and a new match
 * or a new kick-off time. The MVP vote opens the match page on its Vestuario tab (`?tab=vestuario`,
 * the tab ids of src/lib/matchTabs.ts); the rest land on the first tab (crónica / directo / previa).
 */
export function noticesFor(id: string, before: MatchLike | undefined, after: MatchLike | undefined, nameOf: (playerId: string) => string, now: number): Notice[] {
  if (!after || after.archived) return [];
  const url = `/matches/${id}`;
  const rival = after.rival ?? "el rival";
  const out: Notice[] = [];
  const finishedNow = after.status === "finished" && before?.status !== "finished";
  if (after.status !== "finished" && after.status !== "cancelled") {
    // The kick-off is the clock going ready → first (an absent clock is a ready one), not the date.
    if (before && (before.clock?.phase ?? "ready") === "ready" && after.clock?.phase === "first") out.push(kickoffNotice(id, rival));
    const seen = new Set((before?.events ?? []).map((e) => e.id));
    const fresh = (after.events ?? []).filter((e) => !seen.has(e.id) && (OURS.has(e.type) || THEIRS.has(e.type)));
    if (fresh.length) {
      const { gf, ga } = liveScore(after.events);
      const last = fresh[fresh.length - 1];
      const ours = OURS.has(last.type);
      // a goal written live without its scorer yet («Lo completo luego») is still the Piti's
      const who = last.type === "opponent_own_goal" ? `Autogol de ${rival}` : ours ? (last.playerId ? nameOf(last.playerId) : "Manchester Piti") : rival;
      out.push({
        topic: "goals",
        title: ours ? `¡GOL del Piti! ${gf}–${ga}` : `Gol de ${rival}. ${gf}–${ga}`,
        body: `${who}${last.minute != null ? `, minuto ${last.minute}` : ""} · Manchester Piti ${gf}–${ga} ${rival}`,
        tag: `goal-${id}`,
        url,
      });
    }
  }
  if (finishedNow) {
    const gf = after.goalsFor ?? 0, ga = after.goalsAgainst ?? 0;
    const verdict = resultTitle(resultLetter(gf, ga));
    out.push({ topic: "final", title: `Final: Manchester Piti ${gf}–${ga} ${rival}`, body: `${verdict}. La crónica, los minutos y el pulso del partido ya están en la web.`, tag: `final-${id}`, url });
    if ((after.voteClosesAt ?? 0) > now) out.push({ topic: "mvp", title: "Vota al MVP", body: `¿Quién se salió ante ${rival}? La votación está abierta 48 horas.`, tag: `mvp-${id}`, url: `${url}?tab=vestuario` });
  }
  const scheduled = after.status === "scheduled" && typeof after.date === "number" && after.date > now;
  if (scheduled && (!before || before.date !== after.date)) {
    out.push({ topic: "dates", title: before ? `Cambio de hora: ${rival}` : `Nuevo partido: ${rival}`, body: `${when(after.date!).replace(/^./, (c) => c.toUpperCase())}. Añádelo a tu calendario desde la web.`, tag: `date-${id}`, url });
  }
  return out;
}

/** Whether the 5-minute job announces this match's kick-off by its date: only legacy matches without
 *  a clock. A v2 match (with its clock) is announced by pushOnMatch when the clock starts. */
export const legacyKickoff = (m: MatchLike): boolean => !m.clock && m.version !== 2;

/** The kick-off notice: the clock starting (pushOnMatch), or the 5-minute job for legacy matches.
 *  Same tag (and pushLog entry) for both, so a match never gets it twice. */
export const kickoffNotice = (id: string, rival: string): Notice => ({
  topic: "start",
  title: `¡Empieza el partido! Piti vs ${rival}`,
  body: "Sigue el marcador en directo en la web.",
  tag: `start-${id}`,
  url: `/matches/${id}`,
});

/** The fields of a `lineups` board the «Ya está el siete» notice looks at. */
export interface LineupLike {
  isOfficial?: boolean;
  /** The match it is official for (null = the whole season). */
  matchId?: string | null;
  /** The board's season: the link opens it there (`?season=`). */
  seasonId?: string;
  /** The seven (only who stands in each slot matters to the notices). */
  slots?: unknown;
}

/**
 * «Ya está el siete»: when a board BECOMES the official one, or the official's match (its alcance)
 * changes — never on the edits of an official that stays put. Not for a match already played or
 * cancelled. The tag is per board and match, so a phone keeps one notice for each.
 */
export function lineupNotice(id: string, before: LineupLike | undefined, after: LineupLike | undefined, match: MatchLike | null | undefined): Notice | null {
  if (!after?.isOfficial) return null;
  const mid = after.matchId ?? null;
  if (before?.isOfficial && (before.matchId ?? null) === mid) return null;
  if (mid && match && (match.archived || match.status === "finished" || match.status === "cancelled")) return null;
  const rival = mid ? match?.rival : undefined;
  const day = mid && typeof match?.date === "number" ? when(match.date) : "";
  const body = rival
    ? `Contra ${rival}${day ? ` (${day})` : ""}: el capitán ya ha publicado el siete. Ábrelo y mira la charla.`
    : mid
      ? "El capitán ya ha publicado el siete del partido. Ábrelo y mira la charla."
      : "El capitán ya ha publicado el siete de la temporada. Ábrelo y mira la charla.";
  const season = typeof after.seasonId === "string" && after.seasonId ? `&season=${encodeURIComponent(after.seasonId)}` : "";
  return { topic: "lineup", title: "Ya está el siete", body, tag: `lineup-${id}-${mid ?? "temporada"}`, url: `/pizarra?tablero=${encodeURIComponent(id)}${season}#charla` };
}

/**
 * «Ya está la convocatoria»: the first time a match still to be played is published WITH its titulares
 * (the match published with its convocatoria done). push.ts keeps it to once per match (pushLog),
 * whatever the corrections afterwards. A convocatoria managed by setConvocatoria (it stamps
 * `convocatoriaAt`) is never announced by the trigger: «Convocar y avisar» sends its own notice.
 * `jornada` is the match's number in its season (null when unknown).
 */
export function convocatoriaNotice(id: string, before: MatchLike | undefined, after: MatchLike | undefined, jornada: number | null, now: number): Notice | null {
  if (!after || after.archived || after.status !== "scheduled") return null;
  if (typeof after.convocatoriaAt === "number") return null;
  if (typeof after.date !== "number" || after.date <= now) return null;
  if (!(after.starters?.length ?? 0) || (before?.starters?.length ?? 0) > 0) return null;
  return convocatoriaMessage(id, "first", after, jornada);
}

/**
 * The convocatoria's notices: «Ya está la convocatoria de la J8» (first) and «Cambios en la convocatoria
 * de la J8» (an already-notified one changed). Same tag: the phone keeps only the latest.
 */
export function convocatoriaMessage(id: string, kind: "first" | "changes", match: Pick<MatchLike, "rival" | "date">, jornada: number | null): Notice {
  const rival = match.rival ?? "el rival";
  const day = typeof match.date === "number" ? ` · ${when(match.date).replace(/^./, (c) => c.toUpperCase())}` : "";
  const of = jornada ? ` de la J${jornada}` : "";
  return kind === "first"
    ? { topic: "lineup", title: `Ya está la convocatoria${of}`, body: `${rival}${day}. Mira si te toca en la web.`, tag: `conv-${id}`, url: `/matches/${id}` }
    : { topic: "lineup", title: `Cambios en la convocatoria${of}`, body: `${rival}${day}. Mira cómo queda en la web.`, tag: `conv-${id}`, url: `/matches/${id}` };
}

// ── «Cambio en el siete»: the official's seven changed after it was published ──

/** At most one «Cambio en el siete» per board every this long: the changes in between go together. */
export const SEVEN_DEBOUNCE_MS = 10 * 60_000;

/** Who stands in the seven, in slot order (an empty slot or a malformed one counts as nobody). */
export function sevenOf(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];
  const out: string[] = [];
  for (const s of slots) {
    const id = s && typeof s === "object" ? (s as { playerId?: unknown }).playerId : null;
    if (typeof id === "string" && id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Who comes in and who goes out from `from` to `to` (each in its own order). */
export function sevenDiff(from: readonly string[], to: readonly string[]): { ins: string[]; outs: string[] } {
  const a = new Set(from);
  const b = new Set(to);
  return { ins: to.filter((id) => !a.has(id)), outs: from.filter((id) => !b.has(id)) };
}

const andList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

/** «entra ERIK por KEVIN», «entran A y B por C y D», «sale KEVIN», «entra ERIK» (null = nobody changes). */
export function sevenChangeTxt(d: { ins: string[]; outs: string[] }, nameOf: (id: string) => string): string | null {
  const ins = d.ins.map(nameOf);
  const outs = d.outs.map(nameOf);
  if (!ins.length && !outs.length) return null;
  const verb = ins.length > 1 ? "entran " : "entra ";
  if (ins.length && outs.length) return verb + andList(ins) + " por " + andList(outs);
  if (ins.length) return verb + andList(ins);
  return (outs.length > 1 ? "salen " : "sale ") + andList(outs);
}

/** Whether the official's seven may still be news: a match still to be played (or the season's). */
export function sevenNewsworthy(after: LineupLike | undefined, match: MatchLike | null | undefined, now: number): boolean {
  if (!after?.isOfficial) return false;
  if (!after.matchId) return true;
  if (!match || match.archived || match.status === "finished" || match.status === "cancelled") return false;
  return typeof match.date !== "number" || match.date > now;
}

/**
 * The «Cambio en el siete» notice, from the seven the team was last told about (`baseline`) to the one
 * there is now; null when, all told, nobody comes in or goes out (moved around, or changed back).
 */
export function sevenChangeNotice(id: string, baseline: readonly string[], now7: readonly string[], after: LineupLike, match: MatchLike | null | undefined, nameOf: (id: string) => string): Notice | null {
  const txt = sevenChangeTxt(sevenDiff(baseline, now7), nameOf);
  if (!txt) return null;
  const rival = after.matchId ? match?.rival : undefined;
  const season = typeof after.seasonId === "string" && after.seasonId ? `&season=${encodeURIComponent(after.seasonId)}` : "";
  return {
    topic: "lineup",
    title: "Cambio en el siete",
    body: txt.replace(/^./, (c) => c.toUpperCase()) + (rival ? ` · contra ${rival}` : "") + ". Mira el oficial en la pizarra.",
    tag: `seven-${id}`,
    url: `/pizarra?tablero=${encodeURIComponent(id)}${season}`,
  };
}

/** The debounce: send now when the last notice of this board is older than SEVEN_DEBOUNCE_MS (or there
 *  was none), else hold it for the job (pushReminders) to send, grouped, once the window is over. */
export function sevenStep(lastSentAt: number | null, now: number): "send" | "hold" {
  return lastSentAt == null || now - lastSentAt >= SEVEN_DEBOUNCE_MS ? "send" : "hold";
}
