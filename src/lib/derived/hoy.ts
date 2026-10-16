// «Hoy»: a member's match day in one card (spec §1, docs/superpowers/specs/2026-10-15-hoy-caja-ausencias-design.md).
// Pure: which match the card is about at `now` (the server's clock), the phase it is in (kickoffState, the
// same rule as the island, the match page and the push), and the lines that depend on the viewer. HoyCard
// renders it on the home and in the vestuario; the tests drive it with a controlled `now`.
//
// The window: from 00:00 Madrid time on the match's date until its MVP vote closes (voteClosesAt), or
// until the end of that Madrid day when there is no vote (yet). A match that is still to kick off, waiting
// for its whistle or being played always shows (a 23:30 kick-off is still «hoy» at 00:15). Fans: null.
import { dateMillis, matchPhase, type ClubMatch } from "../clubData";
import { resolvePositions, type PosCode } from "../positions";
// (the one «siete» rule of the Campo tab: the pizarra's official seven when there is one, else the
// convocatoria's titulares — pure, shared with the match page rather than written again here)
import { campoSeven } from "../../pages/match/campoSeven";
import { kickoffState, type KickoffState } from "./kickoff";
import { kickoffWindow, mvpVoteOpen } from "./memberWindows";
import { whistleAt } from "./island";
import { madridDate } from "./madrid";
import { turnsLine, type RotaIconId, type Turn } from "./rota";

/** The card's three moments: before kick-off (scheduled / pending whistle), live (live / half-time), after. */
export type HoyStage = "before" | "live" | "after";

export const stageOf = (k: KickoffState): HoyStage => (k === "scheduled" || k === "pending_whistle" ? "before" : k === "live" || k === "halftime" ? "live" : "after");

/** Is `m` in its «Hoy» window at `now`? (Cancelled, postponed and undated matches never are.) */
export function inHoyWindow(m: ClubMatch, now: number): boolean {
  const at = dateMillis(m.date);
  if (!Number.isFinite(at)) return false;
  const phase = matchPhase(m, now);
  if (phase === "cancelled" || phase === "postponed") return false;
  const today = madridDate(now);
  if (today < madridDate(at)) return false;
  if (stageOf(kickoffState(m, now)) !== "after") return true;
  // After the whistle: until the vote closes; without a vote, the end of the day the match was played
  // (the day of its whistle, for a late kick-off that ended after midnight).
  if (m.status === "finished" && typeof m.voteClosesAt === "number") return now < m.voteClosesAt;
  return today <= madridDate(Math.max(at, whistleAt(m) ?? at));
}

/** The match «Hoy» is about: the earliest one in its window not yet ended (two the same day: the next
 *  one); when all have ended, the latest. Undefined: none. */
export function hoyMatch(matches: readonly ClubMatch[], now: number): ClubMatch | undefined {
  const open = matches.filter((m) => inHoyWindow(m, now));
  const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);
  const ahead = open.filter((m) => stageOf(kickoffState(m, now)) !== "after").sort(byDate);
  return ahead[0] ?? open.sort(byDate).at(-1);
}

/** What only the viewer's side knows, read by the card's host (all optional: the model works without). */
export interface HoyContext {
  /** The match's official board (useMatchBoard + useBoardView): its seven and each player's slot code. */
  board?: { seven: readonly string[]; codes?: Readonly<Record<string, PosCode>> } | null;
  /** The viewer's player file, for the preferred position when the board has no code for him. */
  player?: { positions?: unknown; naturalPosition?: unknown } | null;
  /** The viewer is away on the match's Madrid day (an absence of his covers it) and has not answered
   *  «Voy» or «Duda» by hand over it: «Hoy no juegas: estás ausente». */
  absentToday?: boolean;
  /** Turnos del equipo: the match's turns (lib/useRotaTurns) and the viewer's names for them. */
  turns?: { list: readonly Turn[]; nameOf: (playerId: string) => string } | null;
}

export interface HoyModel {
  match: ClubMatch;
  /** kickoffState at `now`. */
  phase: KickoffState;
  stage: HoyStage;
  /** The convocatoria still takes answers (until the match's date: firestore.rules upcoming()). */
  rsvpOpen: boolean;
  /** The seven the card lists before kick-off: the pizarra's official (`official`) or the convocatoria's
   *  titulares; an empty `field` = no siete yet. */
  seven: { field: string[]; official: boolean };
  /** «Sales de titular · DFC» when the viewer is in that seven (before kick-off only, and not away); null otherwise. */
  starter: string | null;
  /** «Hoy no juegas: estás ausente» (before kick-off only): ctx.absentToday. */
  absent: boolean;
  /** The acta is out (the result is the published one). */
  published: boolean;
  /** The MVP vote is open (rules mvpOpen()). */
  voteOpen: boolean;
  /** «Te toca: lavar la equipación» (`mine`) or «Lava: Hugo · Balones: Dani» (not live); null: no turns. */
  turns: { mine: boolean; text: string; icon: RotaIconId } | null;
}

/**
 * «Hoy» at `now` for `viewer`: null for a fan (or an unlinked visitor outside the vestuario), and outside
 * every match's window. `ctx` adds what the host reads for members only (the official board, the ficha).
 */
export function hoyModel(
  matches: readonly ClubMatch[],
  viewer: { member: boolean; playerId: string | null },
  now: number,
  ctx: HoyContext = {},
): HoyModel | null {
  if (!viewer.member) return null;
  const match = hoyMatch(matches, now);
  if (!match) return null;
  const phase = kickoffState(match, now);
  const stage = stageOf(phase);
  const { field, official } = campoSeven(match, stage === "before" ? (ctx.board?.seven ?? null) : null);
  // (away today: the card says so, and no «Sales de titular» next to it)
  const absent = stage === "before" && !!ctx.absentToday;
  let starter: string | null = null;
  if (stage === "before" && !absent && viewer.playerId && field.includes(viewer.playerId)) {
    // the exact slot for this match when the official board has it, else his preferred position
    const code = (official ? ctx.board?.codes?.[viewer.playerId] : undefined) ?? (ctx.player ? resolvePositions(ctx.player).main : null);
    starter = code ? `Sales de titular · ${code}` : "Sales de titular";
  }
  // (the turns: before kick-off and after the whistle — the kit is washed after it; not while it is live)
  const line = stage !== "live" && ctx.turns ? turnsLine(ctx.turns.list, ctx.turns.nameOf, viewer.playerId) : null;
  const lineTurn = line ? (line.mine ? ctx.turns?.list.find((t) => t.playerId === viewer.playerId) : ctx.turns?.list.find((t) => t.playerId)) : undefined;
  return {
    turns: line ? { ...line, icon: lineTurn?.job.icon ?? "shirt" } : null,
    match,
    phase,
    stage,
    rsvpOpen: kickoffWindow(match, now) === "open",
    seven: { field, official },
    starter,
    absent,
    published: match.status === "finished",
    voteOpen: mvpVoteOpen(match, now),
  };
}
