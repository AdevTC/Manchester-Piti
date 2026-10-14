// What the live island says, through the whole match day: «Pendiente del pitido inicial» once the date
// has come and nobody has started the clock → the live minute → «Descanso» → «FINAL 2–1 · acta
// pendiente» for half an hour after the whistle → «Vota al MVP» for a member while the vote is open.
// Pure: LiveIsland renders it, the tests drive it with a controlled `now` (the server-time estimate).
import { dateMillis, matchPhase, type ClubMatch } from "../clubData";
import { OURS, scoreOf } from "../partidos";
import { kickoffState } from "./kickoff";

/** How long «FINAL» stays in the island after the whistle. */
export const FINAL_HOLD_MS = 30 * 60_000;

export type IslandState =
  | { kind: "pending"; match: ClubMatch }
  | { kind: "live"; match: ClubMatch }
  | { kind: "halftime"; match: ClubMatch }
  /** `published`: the acta is out already (the vote may be open) — otherwise «acta pendiente». */
  | { kind: "final"; match: ClubMatch; published: boolean }
  | { kind: "vote"; match: ClubMatch };

/** When the whistle went: the clock's end (a clock, when there is one, is the only judge, as in matchPhase),
 *  or for matches without a clock the server-controlled `liveEndedAt`. */
export function whistleAt(m: Pick<ClubMatch, "clock" | "liveEndedAt">): number | null {
  if (m.clock) return m.clock.phase === "ended" && typeof m.clock.endedAt === "number" ? m.clock.endedAt : null;
  return typeof m.liveEndedAt === "number" ? m.liveEndedAt : null;
}

/** The match whose MVP vote is open (the latest by date), for a member; undefined otherwise. */
export function voteMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  return matches
    .filter((m) => m.status === "finished" && typeof m.voteClosesAt === "number" && m.voteClosesAt > now)
    .sort((a, b) => dateMillis(b.date) - dateMillis(a.date))[0];
}

/**
 * The island's state at `now`, by priority: a match being played (its half-time apart) → one waiting for its
 * whistle (the earliest) → one that ended under FINAL_HOLD_MS ago (the latest) → the open MVP vote, only when
 * `voteOpen` (a member who hasn't voted). Null: no island.
 */
export function islandOf(matches: readonly ClubMatch[], now: number, voteOpen: boolean): IslandState | null {
  const live = matches.find((m) => matchPhase(m, now) === "playing");
  if (live) return { kind: kickoffState(live, now) === "halftime" ? "halftime" : "live", match: live };
  const waiting = matches.filter((m) => kickoffState(m, now) === "pending_whistle").sort((a, b) => dateMillis(a.date) - dateMillis(b.date))[0];
  if (waiting) return { kind: "pending", match: waiting };
  let final: { match: ClubMatch; at: number } | undefined;
  for (const m of matches) {
    const phase = matchPhase(m, now);
    if (phase !== "awaiting_result" && phase !== "finished") continue;
    const at = whistleAt(m);
    if (at === null || now < at || now - at >= FINAL_HOLD_MS) continue;
    if (!final || at > final.at) final = { match: m, at };
  }
  if (final) return { kind: "final", match: final.match, published: final.match.status === "finished" };
  const vote = voteOpen ? voteMatch(matches, now) : undefined;
  return vote ? { kind: "vote", match: vote } : null;
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

/** The island's line for goal `goalId` of `match` (the score is the match's now, PITI first); null when the
 *  goal is gone (undone) or isn't a goal. `nameOf` names a player in the match's season (nameFor). */
export function goalMoment(match: Pick<ClubMatch, "events" | "rival" | "status" | "goalsFor" | "goalsAgainst">, goalId: string, nameOf: (id: string) => string): GoalMoment | null {
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
    return { ours, head: null, rest, text: rest, said: `Gol de ${rival}. ${board}` };
  }
  const minute = typeof e.minute === "number" ? e.minute : typeof e.elapsedSeconds === "number" ? Math.floor(e.elapsedSeconds / 60) : null;
  const who = e.type === "opponent_own_goal" ? `autogol de ${rival}` : e.playerId ? nameOf(e.playerId) : "el Piti";
  const rest = `${who.toLocaleUpperCase("es")}${minute !== null ? ` ${minute}′` : ""} · ${score}`;
  return { ours, head: "¡GOL!", rest, text: `¡GOL! ${rest}`, said: `¡Gol del Piti! ${who}${minute !== null ? `, minuto ${minute}` : ""}. ${board}` };
}

/** The line a screen reader hears once when the island changes state (never on every minute). */
export function islandAnnouncement(state: IslandState, previous: IslandState["kind"] | null): string {
  const m = state.match;
  const rival = m.rival ?? "Rival";
  const { gf, ga } = scoreOf(m);
  const board = `Manchester Piti ${gf}, ${rival} ${ga}`;
  switch (state.kind) {
    case "pending":
      return `Manchester Piti contra ${rival}: pendiente del pitido inicial.`;
    case "live":
      return previous === "halftime" ? `Arranca la segunda parte. ${board}.` : `Empieza el partido contra ${rival}.`;
    case "halftime":
      return `Descanso. ${board}.`;
    case "final":
      return `Final. ${board}.${state.published ? "" : " Acta pendiente."}`;
    case "vote":
      return `Ya puedes votar al MVP del partido contra ${rival}.`;
  }
}
