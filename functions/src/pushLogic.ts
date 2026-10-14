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
  /** The subscribers' topic; "personal" = news about one member (their ficha, their positions), to that
   *  member's own devices only (the subscriptions that carry their uid), whatever topics they chose. */
  topic: Topic | "personal";
  title: string;
  body: string;
  /** Same tag replaces the previous notice of the same kind for that match on the phone. */
  tag: string;
  url: string;
  /** pushLog id claimed before sending (it already there = the notice already went: never twice). */
  log?: string;
  /** pushLog id that must exist for this notice to go (e.g. «Gol anulado» only for a goal that was pushed). */
  requires?: string;
  /** pushLog id whose presence cancels this notice (a provisional final once the acta's «Final» went). */
  skipIf?: string;
}
const PUBLIC = new Set<string>(TOPICS);
/** The club's public topics among `topics` (what a device keeps when its member leaves or signs out). */
export function publicTopics(topics: unknown): string[] {
  return Array.isArray(topics) ? [...new Set(topics.filter((t): t is string => typeof t === "string" && PUBLIC.has(t)))] : [];
}

/**
 * Who a notice goes to, as the pushSubscriptions query sendTo runs: everyone on its topic, or only
 * `uid`'s devices on it; a personal notice goes to `uid`'s devices whatever their topics (`topic` null),
 * and to nobody without a uid (null).
 */
export function pushAudience(notice: Pick<Notice, "topic">, uid?: string | null): { topic: Topic | null; uid: string | null } | null {
  if (notice.topic === "personal") return uid ? { topic: null, uid } : null;
  return { topic: notice.topic, uid: uid || null };
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
  /** liveEvent «finish» on a legacy match without a clock: its final whistle (ms). */
  liveEndedAt?: number;
}

const notDone = (m: MatchLike | undefined) => !!m && m.status !== "finished" && m.status !== "cancelled";
/** The final whistle went (the clock ended, or a legacy match finished live): what changes after it are
 *  the acta's corrections, never news. */
const whistled = (m: MatchLike) => m.clock?.phase === "ended" || typeof m.liveEndedAt === "number";

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

const isGoal = (e: Ev) => OURS.has(e.type) || THEIRS.has(e.type);

/**
 * What changed between two versions of a match, as notices: the clock's whistles (the kick-off, the
 * descanso, the 2ª parte and the provisional final), each goal written while it isn't finished (and
 * «Gol anulado» when one that was pushed is undone), the acta's final (and the MVP vote opening), and a
 * new match or a new kick-off time. The MVP vote opens the match page on its Vestuario tab
 * (`?tab=vestuario`, the tab ids of src/lib/matchTabs.ts); the rest land on the first tab (crónica /
 * directo / previa). Each notice that could repeat (a trigger retry, a clock undone and done again)
 * carries its pushLog id (`log`): push.ts claims it first, so it goes once.
 */
export function noticesFor(id: string, before: MatchLike | undefined, after: MatchLike | undefined, nameOf: (playerId: string) => string, now: number): Notice[] {
  if (!after || after.archived) return [];
  const url = `/matches/${id}`;
  const rival = after.rival ?? "el rival";
  const out: Notice[] = [];
  const finishedNow = after.status === "finished" && before?.status !== "finished";
  if (notDone(after)) {
    // The kick-off is the clock going ready → first (an absent clock is a ready one), not the date.
    if (before && (before.clock?.phase ?? "ready") === "ready" && after.clock?.phase === "first") out.push(kickoffNotice(id, rival));
    const { gf, ga } = liveScore(after.events);
    const score = `Manchester Piti ${gf}–${ga} ${rival}`;
    // «Gol anulado»: a goal undone while the match is still being played, only if its «¡GOL!» went
    // (`requires` its pushLog): never for the corrections of an old acta. Same tag: it replaces it.
    const ended = whistled(after);
    if (notDone(before) && !ended) {
      const still = new Set((after.events ?? []).map((e) => e.id));
      for (const e of (before?.events ?? []).filter((x) => isGoal(x) && !still.has(x.id))) {
        const who = e.type === "opponent_own_goal" ? `el autogol de ${rival}` : OURS.has(e.type) ? (e.playerId ? `el gol de ${nameOf(e.playerId)}` : "el gol del Piti") : `el gol de ${rival}`;
        out.push({ topic: "goals", title: `Gol anulado. ${gf}–${ga}`, body: `Se anula ${who}${e.minute != null ? ` (minuto ${e.minute})` : ""} · ${score}`, tag: `goal-${id}`, url, requires: `goal-${id}-${e.id}`, log: `goal-off-${id}-${e.id}` });
      }
    }
    const seen = new Set((before?.events ?? []).map((e) => e.id));
    const fresh = (after.events ?? []).filter((e) => !seen.has(e.id) && isGoal(e));
    // (a goal written after the final whistle is a correction of the acta: silent, like its undo)
    if (fresh.length && !ended) {
      const last = fresh[fresh.length - 1];
      const ours = OURS.has(last.type);
      // a goal written live without its scorer yet («Lo completo luego») is still the Piti's
      const who = last.type === "opponent_own_goal" ? `Autogol de ${rival}` : ours ? (last.playerId ? nameOf(last.playerId) : "Manchester Piti") : rival;
      out.push({
        topic: "goals",
        title: ours ? `¡GOL del Piti! ${gf}–${ga}` : `Gol de ${rival}. ${gf}–${ga}`,
        body: `${who}${last.minute != null ? `, minuto ${last.minute}` : ""} · ${score}`,
        tag: `goal-${id}`,
        url,
        log: `goal-${id}-${last.id}`,
      });
    }
    // The clock's other whistles, once per match each (an undo and the same whistle again says nothing
    // new). The descanso and the 2ª parte share the kick-off's tag: the phone keeps the latest.
    const was = before?.clock?.phase ?? "ready";
    const phase = after.clock?.phase;
    if (before && was === "first" && phase === "halftime") out.push({ topic: "start", title: `Descanso · ${gf}–${ga}`, body: `${score}. Sigue el directo en la web.`, tag: `start-${id}`, url, log: `half-${id}` });
    if (before && was === "halftime" && phase === "second") out.push({ topic: "start", title: "Arranca la 2ª parte", body: `${score}. Sigue el directo en la web.`, tag: `start-${id}`, url, log: `second-${id}` });
    // The final whistle (clock ended), before the acta: provisional, with the acta's «Final» tag so the
    // official one replaces it on the phone when the captain publishes — and never after the official
    // one went (`skipIf`: an acta published, then reopened and ended again, or triggers out of order).
    if (before && (was === "first" || was === "second") && phase === "ended") out.push({ topic: "final", title: `Final (provisional) · ${gf}–${ga}`, body: `${score}. El resultado oficial llega con el acta del capitán.`, tag: `final-${id}`, url, log: `final-live-${id}`, skipIf: `final-${id}` });
  }
  if (finishedNow) {
    const gf = after.goalsFor ?? 0, ga = after.goalsAgainst ?? 0;
    const verdict = resultTitle(resultLetter(gf, ga));
    out.push({ topic: "final", title: `Final: Manchester Piti ${gf}–${ga} ${rival}`, body: `${verdict}. La crónica, los minutos y el pulso del partido ya están en la web.`, tag: `final-${id}`, url, log: `final-${id}` });
    if ((after.voteClosesAt ?? 0) > now) out.push({ topic: "mvp", title: "Vota al MVP", body: `¿Quién se salió ante ${rival}? La votación está abierta 48 horas.`, tag: `mvp-${id}`, url: `${url}?tab=vestuario`, log: `mvp-open-${id}` });
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
  log: `start-${id}`,
});

// ── The MVP's winner, when the vote closes (the 5-minute job, push.ts) ──

/** Who won a match's MVP vote once it has closed (ties share it), from mvpResults/{id} — the one rule
 *  of the web (src/lib/vestuario.ts mvpWinners) and the notice. Nobody before it closes or without votes. */
export function mvpWinnerIds(voteClosesAt: number | null | undefined, result: { counts?: Record<string, number>; total?: number } | null | undefined, now: number): string[] {
  if (!result?.total || !voteClosesAt || now < voteClosesAt) return [];
  const counts = result.counts ?? {};
  const top = Math.max(...Object.values(counts));
  return top > 0 ? Object.keys(counts).filter((id) => counts[id] === top) : [];
}

/** «MVP de la J5: ERIK» (a tie: «MVP compartido de la J5: ERIK y PABLO»), once per match. Same tag as
 *  «Vota al MVP»: the winner replaces the call to vote on the phone. Null without a winner. */
export function mvpWinnerNotice(id: string, match: Pick<MatchLike, "rival">, winners: readonly string[], nameOf: (playerId: string) => string, jornada: number | null): Notice | null {
  if (!winners.length) return null;
  const rival = match.rival ?? "el rival";
  const names = andList(winners.map(nameOf));
  const of = jornada ? ` de la J${jornada}` : " del partido";
  const shared = winners.length > 1;
  return {
    topic: "mvp",
    title: `${shared ? "MVP compartido" : "MVP"}${of}: ${names}`,
    body: shared ? `Empate en la votación ante ${rival}. Mira el recuento en la web.` : `Elegido por el vestuario ante ${rival}. Mira la votación en la web.`,
    tag: `mvp-${id}`,
    url: `/matches/${id}?tab=vestuario`,
    log: `mvp-win-${id}`,
  };
}

// ── Personal notices: news about one member, to their own devices ──

const millisOf = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = v as { toMillis?: () => number } | null | undefined;
  return t && typeof t.toMillis === "function" ? t.toMillis() : null;
};

/** The fields of playerClaims/{uid} the notice looks at. */
export interface ClaimLike {
  playerId?: string;
  status?: string;
  resolvedBy?: string;
}

/**
 * «Tu ficha ya es tuya»: a member's claim of a ficha becomes approved — by a captain (a captain's own
 * claim links at once: nothing to tell him). Once per member and ficha (pushLog).
 */
export function claimNotice(uid: string, before: ClaimLike | undefined, after: ClaimLike | undefined): Notice | null {
  if (after?.status !== "approved" || before?.status === "approved" || !after.playerId) return null;
  if (after.resolvedBy === uid) return null;
  return {
    topic: "personal",
    title: "Tu ficha ya es tuya",
    body: "El capitán ha aprobado tu ficha: tus partidos, tus goles y tu carta ya cuentan contigo.",
    tag: `claim-${uid}`,
    url: "/profile",
    log: `claim-${uid}-${after.playerId}`,
  };
}

const REVIEW_BODY: Record<string, string> = {
  aprobada: "Ha aprobado tus posiciones: tu ficha ya sale así.",
  ajustada: "Ha ajustado un poco tus posiciones. Mira cómo quedan en tu perfil.",
  rechazada: "Esta vez tus posiciones se quedan como estaban. Míralo en tu perfil.",
};

/**
 * «El capitán revisó tus posiciones»: a new `positionsReview` on a ficha (a new review date), to the
 * member linked to it (`memberUid`, from playerLinks) unless they reviewed it themselves. Once per
 * ficha and review (pushLog `positions-<playerId>-<reviewAt>`).
 */
export function positionsNotice(playerId: string, before: { positionsReview?: unknown } | undefined, after: { positionsReview?: unknown } | undefined, memberUid: string | null): Notice | null {
  const r = after?.positionsReview as { status?: unknown; at?: unknown; by?: unknown } | null | undefined;
  if (!memberUid || !r || typeof r !== "object" || typeof r.status !== "string" || !Object.hasOwn(REVIEW_BODY, r.status)) return null;
  const at = millisOf(r.at);
  if (at == null || r.by === memberUid) return null;
  const was = before?.positionsReview as { at?: unknown } | null | undefined;
  if (was && typeof was === "object" && millisOf(was.at) === at) return null;
  return { topic: "personal", title: "El capitán revisó tus posiciones", body: REVIEW_BODY[r.status], tag: `positions-${playerId}`, url: "/profile", log: `positions-${playerId}-${at}` };
}

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

// ── One «siete» per match: «Ya está el siete» and the convocatoria's notice never both ──
//
// Both tell the team the match's seven: the pizarra's official («Ya está el siete», pushOnLineup) and the
// convocatoria («Ya está la convocatoria» / «Cambios en la convocatoria», setConvocatoria and the legacy
// trigger). Each one, once its own pushLog is claimed, also goes through `pushLog/siete-<match>`: whoever
// told the team THIS seven in the last SIETE_WINDOW_MS wins, the other one stays quiet. Publishing the
// official with «Usar este siete como convocatoria» reserves the claim for the board's «Ya está el siete»
// (the publish's trigger may run before or after the convocatoria's call): the convocatoria is covered.

/** How long a «siete» notice covers the other one for the same seven. */
export const SIETE_WINDOW_MS = SEVEN_DEBOUNCE_MS;

/** The claim's pushLog id: one per match. */
export const sieteLog = (matchId: string): string => `siete-${matchId}`;

/** The seven as the claim compares it: who (order aside), never empty ids. */
export function sieteKey(seven: readonly unknown[] | null | undefined): string {
  const ids = (seven ?? []).filter((x): x is string => typeof x === "string" && x.length > 0);
  return [...new Set(ids)].sort().join(",");
}

/** `pushLog/siete-<match>` as stored. */
export interface SieteClaim {
  /** When it was claimed (ms). */
  at: number;
  /** Who told (or is about to tell) the team. */
  by: "lineup" | "conv";
  /** The seven told (sieteKey). */
  seven: string;
  /** The board, for «Ya está el siete». */
  board?: string | null;
  /** false = reserved for that board's «Ya está el siete», which hasn't gone yet. */
  sent: boolean;
}

/**
 * Who asks: «Ya está el siete» of `board` (lineup), a convocatoria notice (conv), or the convocatoria made
 * from the official just published, which leaves the telling to the board's notice (reserve).
 */
export type SieteAsk = { by: "lineup"; board: string; seven: string } | { by: "conv"; seven: string } | { by: "reserve"; board: string; seven: string };

/** The stored claim read back (null when missing or malformed). */
export function parseSiete(d: unknown): SieteClaim | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.at !== "number" || (o.by !== "lineup" && o.by !== "conv") || typeof o.seven !== "string") return null;
  return { at: o.at, by: o.by, seven: o.seven, board: typeof o.board === "string" ? o.board : null, sent: o.sent !== false };
}

/**
 * The one-siete step: whether the asker's notice goes (`send`) and what the claim becomes (`write`, null =
 * left as it is). A claim older than SIETE_WINDOW_MS (or from the future: a reset clock) counts as none.
 *   · lineup: its own reservation → it goes (and marks it sent); the same seven told within the window → quiet.
 *   · conv: the same seven told (or reserved for the board) within the window → quiet (covered).
 *   · reserve: never sends; it reserves the claim for the board unless that board already holds it or the
 *     same seven was already told (then the board's notice stays quiet too).
 */
export function sieteStep(prev: SieteClaim | null, ask: SieteAsk, now: number): { send: boolean; write: SieteClaim | null } {
  const fresh = !!prev && prev.at <= now && now - prev.at < SIETE_WINDOW_MS ? prev : null;
  if (ask.by === "lineup") {
    if (fresh && fresh.by === "lineup" && fresh.board === ask.board && !fresh.sent) return { send: true, write: { ...fresh, sent: true } };
    if (fresh && fresh.sent && fresh.seven === ask.seven) return { send: false, write: null };
    return { send: true, write: { at: now, by: "lineup", seven: ask.seven, board: ask.board, sent: true } };
  }
  if (ask.by === "conv") {
    if (fresh && fresh.seven === ask.seven) return { send: false, write: null };
    return { send: true, write: { at: now, by: "conv", seven: ask.seven, sent: true } };
  }
  if (fresh && ((fresh.by === "lineup" && fresh.board === ask.board) || (fresh.sent && fresh.seven === ask.seven))) return { send: false, write: null };
  return { send: false, write: { at: now, by: "lineup", seven: ask.seven, board: ask.board, sent: false } };
}

/**
 * Whether a convocatoria made from the official just published is covered by that board's «Ya está el
 * siete»: the board is the match's official (its scope doc names it, written within the window) and its
 * notice is still to go or went within the window (an older claim = it won't go again).
 */
export function boardCovers(o: {
  board: { isOfficial?: unknown; matchId?: unknown } | null | undefined;
  lock: { lineupId?: unknown; at?: number | null } | null | undefined;
  boardId: string;
  matchId: string;
  /** When that board's «Ya está el siete» for the match was claimed (null = not yet). */
  lineupLoggedAt: number | null;
  now: number;
}): boolean {
  if (o.board?.isOfficial !== true || o.board.matchId !== o.matchId) return false;
  if (o.lock?.lineupId !== o.boardId) return false;
  const within = (t: number) => t <= o.now && o.now - t < SIETE_WINDOW_MS;
  if (typeof o.lock.at !== "number" || !within(o.lock.at)) return false;
  return o.lineupLoggedAt == null || within(o.lineupLoggedAt);
}
