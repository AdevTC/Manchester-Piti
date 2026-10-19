// What the live island says, through the whole match day. Its base state, by priority: a match being played
// (half-time apart) → one waiting for its whistle → one that ended under half an hour ago («Final», or «Ya está
// el acta» once published) → «Pendiente del acta» for one nobody started past its window → the open MVP vote for a member who hasn't voted → and on the match's own day, before
// the clock starts, «Hoy anotas tú» for the member assigned to la mesa, «¿Vas hoy?» for a member who hasn't
// answered, and «Antes del partido» for everyone in the two hours before kick-off. Over the base state, each
// fresh play (lib/derived/moments) unfolds for a few seconds, and a live score the server hasn't confirmed
// turns the score to «Sin conexión». Pure: the live system (components/vidrio/live) renders it, the tests drive
// it with a controlled `now`.
import type { ClubMatch } from "../clubData";
import { eventMinute, OURS, scoreOf } from "../partidos";
import { kickoffState, whistleDeadline } from "./kickoff";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../functions/src/matchEngine";
import { withGuestNames } from "./guests";
import { madridDate, madridTime } from "./madrid";
import { endSentence } from "./words";
import { boardSaid } from "./moments";

/** How long «FINAL» stays in the island after the whistle. */
export const FINAL_HOLD_MS = 30 * 60_000;
/** How long before kick-off «Antes del partido» shows for everyone. */
export const PREVIA_MS = 2 * 3_600_000;

export type IslandState =
  /** The match of today, in the two hours before its kick-off. */
  | { kind: "previa"; match: ClubMatch }
  /** The match of today, before its clock starts, for a member who hasn't answered the convocatoria. */
  | { kind: "rsvp"; match: ClubMatch }
  /** The match of today, before its clock starts, for the member assigned to la mesa. */
  | { kind: "anotador"; match: ClubMatch }
  | { kind: "pending"; match: ClubMatch }
  | { kind: "live"; match: ClubMatch }
  | { kind: "halftime"; match: ClubMatch }
  /** `published`: the acta is out already (the vote may be open) — otherwise «acta pendiente». */
  | { kind: "final"; match: ClubMatch; published: boolean }
  /** «Pendiente del acta»: the window for the whistle went by and nobody started la mesa's clock (no score). */
  | { kind: "unplayed"; match: ClubMatch }
  | { kind: "vote"; match: ClubMatch };

/** What only a member's own data can tell about the match of today (todayMatch). */
export interface TodayViewer {
  /** He is one of la mesa's designated scorers. */
  anotador?: boolean;
  /** He hasn't answered the convocatoria (or just did, from the island: it stays to show the answer). */
  rsvp?: boolean;
}

/** When the whistle went: the clock's end (a clock, when there is one, is the only judge, as in matchPhase),
 *  or for matches without a clock the server-controlled `liveEndedAt`. */
export function whistleAt(m: Pick<ClubMatch, "clock" | "liveEndedAt">): number | null {
  if (m.clock) return m.clock.phase === "ended" && typeof m.clock.endedAt === "number" ? m.clock.endedAt : null;
  return typeof m.liveEndedAt === "number" ? m.liveEndedAt : null;
}

/** The match whose MVP vote is open (the latest by date), for a member; undefined otherwise. */
export function voteMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  return matches
    .filter(isVisibleMatch)
    .filter((m) => m.status === "finished" && typeof m.voteClosesAt === "number" && m.voteClosesAt > now)
    .sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}

/** The match of today (Madrid's calendar) whose clock hasn't started: one waiting for its whistle first, else
 *  the earliest still to kick off. Its convocatoria and its scorers are what a member's island reads. */
export function todayMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  const today = madridDate(now);
  const visible = matches.filter(isVisibleMatch);
  const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);
  const waiting = visible.filter((m) => kickoffState(m, now) === "pending_whistle").sort(byDate)[0];
  if (waiting) return waiting;
  return visible
    .filter((m) => {
      const at = dateMillis(m.date);
      return Number.isFinite(at) && at > now && madridDate(at) === today && kickoffState(m, now) === "scheduled" && matchPhase(m, now) === "scheduled";
    })
    .sort(byDate)[0];
}

/**
 * The island's base state at `now`, by priority: a match being played (its half-time apart) → one waiting for
 * its whistle (the earliest) → one that ended under FINAL_HOLD_MS ago (the latest) → the open MVP vote, only when
 * `voteOpen` (a member who hasn't voted) → the match of today: «anotador», «rsvp» (from `today`), «previa» in the
 * last PREVIA_MS. Null: no island.
 */
export function islandOf(matches: readonly ClubMatch[], now: number, voteOpen: boolean, today: TodayViewer = {}): IslandState | null {
  matches = matches.filter(isVisibleMatch);
  // (two at once: the earliest kick-off, whatever the list's order)
  const live = matches.filter((m) => matchPhase(m, now) === "playing").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (live) return { kind: kickoffState(live, now) === "halftime" ? "halftime" : "live", match: live };
  const waiting = matches.filter((m) => kickoffState(m, now) === "pending_whistle").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (waiting) return { kind: today.anotador ? "anotador" : "pending", match: waiting };
  let final: { match: ClubMatch; at: number } | undefined;
  for (const m of matches) {
    const phase = matchPhase(m, now);
    if (phase !== "awaiting_result" && phase !== "finished") continue;
    const at = whistleAt(m);
    // (a whistle stamped «after» now still counts: the island's clock ticks every 15 s and is only the server
    // time as this phone estimates it, so the end can arrive looking a few seconds ahead)
    if (at === null || now - at >= FINAL_HOLD_MS) continue;
    if (!final || at > final.at) final = { match: m, at };
  }
  if (final) return { kind: "final", match: final.match, published: final.match.status === "finished" };
  // (a clock nobody started past its window: «Pendiente del acta» for as long as a final would show)
  const unplayed = matches
    .filter((m) => kickoffState(m, now) === "awaiting_result")
    .map((m) => ({ match: m, at: whistleDeadline(m) }))
    .filter((x) => now - x.at < FINAL_HOLD_MS)
    .sort((a, b) => b.at - a.at)[0];
  if (unplayed) return { kind: "unplayed", match: unplayed.match };
  const vote = voteOpen ? voteMatch(matches, now) : undefined;
  if (vote) return { kind: "vote", match: vote };
  const day = todayMatch(matches, now);
  if (!day) return null;
  if (today.anotador) return { kind: "anotador", match: day };
  if (today.rsvp) return { kind: "rsvp", match: day };
  return dateMillis(day.date) - now <= PREVIA_MS ? { kind: "previa", match: day } : null;
}

export interface GoalMoment {
  ours: boolean;
  /** «¡GOL!» for ours; null for theirs (calmer). */
  head: string | null;
  /** «ERIK 19′ · 2–1» for ours, «Gol de MAD SKY · 2–2» for theirs. */
  rest: string;
  /** What the pill reads: head and rest. */
  text: string;
  /** The line a screen reader hears once. */
  said: string;
}

/** The old pill's line for goal `goalId` of `match` (the score is the match's now, PITI first); null when the
 *  goal is gone (undone) or isn't a goal. `nameOf` names a player in the match's season (nameFor). The island
 *  now tells every play through lib/derived/moments; this stays for the guests' naming tests. */
export function goalMoment(match: Pick<ClubMatch, "events" | "rival" | "status" | "goalsFor" | "goalsAgainst" | "guests">, goalId: string, nameOf: (id: string) => string): GoalMoment | null {
  if (!isVisibleMatch(match)) return null;
  const e = match.events?.find((x) => x.id === goalId);
  if (!e) return null;
  const ours = OURS.has(e.type);
  if (!ours && e.type !== "opponent_goal" && e.type !== "own_goal") return null;
  const rival = match.rival ?? "Rival";
  const { gf, ga } = scoreOf(match);
  const score = `${gf}–${ga}`;
  const board = `Manchester Piti ${gf}, ${rival} ${ga}.`;
  if (!ours) {
    const rest = `Gol de ${rival} · ${score}`;
    return { ours, head: null, rest, text: rest, said: `${endSentence(`Gol de ${rival}`)} ${board}` };
  }
  const minute = eventMinute(e);
  const who = e.type === "opponent_own_goal" ? `autogol de ${rival}` : e.playerId ? withGuestNames(match, nameOf)(e.playerId) : "el Piti";
  const rest = `${who.toLocaleUpperCase("es")}${minute !== null ? ` ${minute}′` : ""} · ${score}`;
  return { ours, head: "¡GOL!", rest, text: `¡GOL! ${rest}`, said: `¡Gol del Piti! ${endSentence(`${who}${minute !== null ? `, minuto ${minute}` : ""}`)} ${board}` };
}

/** The line a screen reader hears once when the island changes state (never on every minute). */
export function islandAnnouncement(state: IslandState, previous: IslandState["kind"] | null): string {
  const m = state.match;
  const rival = m.rival ?? "Rival";
  const { gf, ga } = scoreOf(m);
  const board = boardSaid(rival, gf, ga);
  const time = madridTime(dateMillis(m.date));
  switch (state.kind) {
    case "previa":
      return endSentence(`Hoy a las ${time}, Manchester Piti contra ${rival}`);
    case "rsvp":
      return "¿Vas hoy? Responde desde aquí.";
    case "anotador":
      return `Hoy anotas tú: la mesa del partido contra ${rival} se abre desde aquí.`;
    case "pending":
      return `Manchester Piti contra ${rival}: pendiente del pitido inicial.`;
    case "live":
      return previous === "halftime" ? `Arranca la segunda parte. ${board}.` : endSentence(`Empieza el partido contra ${rival}`);
    case "halftime":
      return `Descanso. ${board}.`;
    case "final":
      return state.published ? (previous === "final" ? "Acta publicada." : `Final. ${board}. Acta publicada.`) : `Final. ${board}. Acta pendiente.`;
    case "unplayed":
      return `Manchester Piti contra ${rival}: pendiente del acta.`;
    case "vote":
      return endSentence(`Ya puedes votar al mejor del partido contra ${rival}`);
  }
}
