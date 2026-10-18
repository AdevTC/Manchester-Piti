// «La luz del partido»: where the club's match day stands at `now`, one phase for Inicio, Partidos, the front
// row and the island to agree on (pretemporada → semana → antes → pitido → directo1 → descanso → directo2 →
// final → acta → después, or aplazado; «pendiente» when the date went by and nobody started la mesa's clock),
// plus who the viewer is that day. Pure: built on the rules every other surface already reads (seasonPulse,
// matchPhase, kickoffState, the live half and minute, the Madrid day),
// never a second copy of them; the tests drive it with a controlled `now` (the server-time estimate).
import type { ClubMatch } from "../clubData";
import { seasonPulse } from "../home";
import { scoreOf, shownMinute } from "../partidos";
import { currentHalf } from "../../pages/match/directoModel";
import { clockReading } from "../../../functions/src/matchClock";
import { dateMillis, isVisibleMatch, matchPhase } from "../../../functions/src/matchEngine";
import { jornadas } from "./jornada";
import { kickoffState } from "./kickoff";
import { madridDate } from "./madrid";
import { mvpVoteOpen } from "./memberWindows";
import { whistleAt } from "./island";

const DAY = 86_400_000;
/** How long «después» (and an acta still pending, «final») keeps the last match in front. */
export const AFTER_WINDOW_MS = 4 * DAY;

export type MatchdayPhase =
  | "pretemporada"
  | "semana"
  | "antes"
  | "pitido"
  | "directo1"
  | "descanso"
  | "directo2"
  | "final"
  /** The window went by and nobody started la mesa's clock: no score to show (no 0–0), the acta will say. */
  | "pendiente"
  | "acta"
  | "despues"
  | "aplazado";

export interface MatchdayModel {
  phase: MatchdayPhase;
  /** The match the page is about: today's / the live one / the one in final·acta·después / the next one. */
  match: ClubMatch | null;
  /** The next match to count down to when it isn't `match` (después, aplazado; also final and acta). */
  next: ClubMatch | null;
  /** The last finished match of the season. */
  last: ClubMatch | null;
  /** ms of `match` (null without a date). */
  kickoff: number | null;
  /** shownMinute while live (directo1, descanso, directo2). */
  minute: number | null;
  /** Added time of the half being played («+2» → 2) when the clock carries it. */
  added: number | null;
  /** scoreOf(match) from directo1 on. */
  score: { gf: number; ga: number } | null;
  jornada: number | null;
}

const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);
const LIVE: ReadonlySet<MatchdayPhase> = new Set(["directo1", "descanso", "directo2"]);
const SCORED: ReadonlySet<MatchdayPhase> = new Set(["directo1", "descanso", "directo2", "final", "acta", "despues"]);

/** directo1 / descanso / directo2 for a match being played: the clock's half; a legacy match without a clock,
 *  by its schedule's minute against half its duration. */
function livePhase(m: ClubMatch, now: number): MatchdayPhase {
  if (kickoffState(m, now) === "halftime") return "descanso";
  const half = currentHalf(m, now);
  if (half) return half === 1 ? "directo1" : "directo2";
  const minute = shownMinute(m, now);
  return minute !== null && minute > (m.duration ?? 50) / 2 ? "directo2" : "directo1";
}

/** The match day at `now` for season `seasonId`. */
export function matchdayOf(matches: readonly ClubMatch[], seasonId: string, now: number): MatchdayModel {
  const list = [...matches];
  const season = list.filter((m) => isVisibleMatch(m) && m.seasonId === seasonId);
  const pulse = seasonPulse(list, seasonId, now);
  const today = madridDate(now);
  const last = pulse.last ?? null;
  const number = jornadas(list, seasonId);

  const model = (phase: MatchdayPhase, match: ClubMatch | null): MatchdayModel => {
    const next = pulse.next && pulse.next !== match ? pulse.next : null;
    const at = match ? dateMillis(match.date) : NaN;
    const live = !!match && LIVE.has(phase);
    let added: number | null = null;
    if (live && match.clock) {
      const value = match.clock.added?.[clockReading(match.clock, now).period];
      added = typeof value === "number" && value > 0 ? value : null;
    }
    return {
      phase,
      match,
      next,
      last,
      kickoff: Number.isFinite(at) ? at : null,
      minute: live ? shownMinute(match, now) : null,
      added,
      score: match && SCORED.has(phase) ? scoreOf(match) : null,
      jornada: match ? (number.get(match.id) ?? null) : null,
    };
  };

  if (!season.length) return model("pretemporada", null);

  // 1. being played (the earliest kick-off when two overlap)
  if (pulse.live) return model(livePhase(pulse.live, now), pulse.live);

  // 2. the date has come and nobody has started the clock
  const waiting = season.filter((m) => kickoffState(m, now) === "pending_whistle").sort(byDate)[0];
  if (waiting) return model("pitido", waiting);

  // 3. a match today (Madrid's day), before its kick-off
  const next = pulse.next;
  const nextAt = next ? dateMillis(next.date) : NaN;
  if (next && Number.isFinite(nextAt) && madridDate(nextAt) === today && now < nextAt) return model("antes", next);

  // 4. ended, its acta still to come (and recent: an acta forgotten for days doesn't hold the page); a clock
  //    nobody started past its window has no final whistle and nothing played to count: «pendiente»
  const awaiting = pulse.awaiting;
  if (awaiting && now - (whistleAt(awaiting) ?? dateMillis(awaiting.date)) <= AFTER_WINDOW_MS)
    return model(kickoffState(awaiting, now) === "awaiting_result" ? "pendiente" : "final", awaiting);

  // 5. the acta is out and the MVP vote is open
  if (last && mvpVoteOpen(last, now)) return model("acta", last);

  // the nearest fixture from today on, when it was called off (postponed or cancelled)
  const off = season
    .filter((m) => {
      const phase = matchPhase(m, now);
      const at = dateMillis(m.date);
      return (phase === "postponed" || phase === "cancelled") && Number.isFinite(at) && madridDate(at) >= today;
    })
    .sort(byDate)[0];
  const offAt = off ? dateMillis(off.date) : NaN;
  const offNearest = !!off && (!next || !Number.isFinite(nextAt) || offAt <= nextAt);

  // 6. called off today: that is the news, even in «después»
  if (off && offNearest && madridDate(offAt) === today) return model("aplazado", off);

  // 7. the vote closed (or there is none) and the last match is at most 4 days old
  if (last && last.status === "finished" && now - dateMillis(last.date) <= AFTER_WINDOW_MS) return model("despues", last);

  // 8. the nearest fixture is called off
  if (off && offNearest) return model("aplazado", off);

  // 9. the week: counting down to the next one (or one still without a date); nothing ahead → match null
  return model("semana", next ?? pulse.upcoming[0] ?? null);
}

export type ViewerRole = "aficionado" | "titular" | "suplente" | "noconvocado" | "ausente" | "anotador";

/**
 * Who the viewer is for `match`: a fan (not a member) → aficionado; then, for a member, by priority:
 * anotador (he keeps la mesa) → ausente (away that day) → titular (in `seven`) → suplente (in the
 * convocatoria) → noconvocado.
 */
export function viewerRoleOf(
  match: ClubMatch | null,
  viewer: { member: boolean; playerId: string | null },
  ctx: { scorer: boolean; absentToday: boolean; seven: readonly string[] },
): ViewerRole {
  if (!viewer.member) return "aficionado";
  if (ctx.scorer) return "anotador";
  if (ctx.absentToday) return "ausente";
  const id = viewer.playerId;
  if (!id || !match) return "noconvocado";
  if (ctx.seven.includes(id)) return "titular";
  if ((match.starters ?? []).includes(id) || (match.bench ?? []).includes(id)) return "suplente";
  return "noconvocado";
}
