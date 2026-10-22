// The plays of a match as broadcast «moments»: what the floating score unfolds for ~9 s (its rótulo) and the
// line a screen reader hears once. One moment per play la mesa
// writes that a fan cares about (a goal, a card, a change, the woodwork, a save, a penalty, a knock) and one
// per turn of the clock (kick-off, half-time, the second half, the final whistle). Pure: the hook
// (components/vidrio/live/useMatchMoment) decides which ones are fresh enough to show.
import { clockReading, type MatchClock } from "../../../functions/src/matchClock";
import { eventMinute, type MatchEvent } from "../../../functions/src/matchEngine";
import { eventSeconds } from "../../../functions/src/matchAnalysis";
import type { ClubMatch } from "../clubData";
import { eventMetaOf, eventSentence, isMesaType, settled } from "../eventMeta";
import { liveMinute } from "../partidos";
import { withGuestNames } from "./guests";
import { endSentence, scoreText } from "./words";

export type MomentKind =
  | "gol"
  | "golrival"
  | "amarilla"
  | "roja"
  | "cambio"
  | "palo"
  | "parada"
  | "penalti"
  | "lesion"
  | "arranque"
  | "descanso"
  | "reanudacion"
  | "final";

export interface MatchMoment {
  /** The event's id, or «<matchId>:<kind>» for a turn of the clock. */
  id: string;
  kind: MomentKind;
  /** Ours (a goal for the Piti, our card, our change…) or theirs. */
  ours: boolean;
  /** The minute to show (football's, 1-based); null when the play has none. */
  minute: number | null;
  /** The rótulo's headline, broadcast caps: «GOL · ADRIÁN T.C.». */
  title: string;
  /** The line under it: «Pase de Jordi. 2–1»; "" when there is nothing to add. */
  sub: string;
  /** What a screen reader hears, once: «Gol del Piti, de Adrián T.C. Piti 2, Orduña 1». */
  said: string;
}

/** A play that is newer than this (seconds of play behind the clock, or wall time for the clock's turns) is
 *  just data: the score changes, nothing unfolds (the same rule as lib/derived/goalCelebration). */
export const FRESH_MOMENT_SECONDS = 120;

/** The kinds that also get the crest's cortinilla on the bug (0.9 s): «g» sky and gold, «rv» with a coral edge. */
export const WIPE_OF: Partial<Record<MomentKind, "g" | "rv">> = { gol: "g", golrival: "rv", arranque: "g", descanso: "g", final: "g" };

type MomentMatch = Pick<ClubMatch, "id" | "rival" | "events" | "guests" | "clock" | "date" | "duration" | "status" | "goalsFor" | "goalsAgainst">;

const up = (s: string) => s.toLocaleUpperCase("es");
const rivalOf = (m: Pick<ClubMatch, "rival">) => m.rival?.trim() || "Rival";
/** «Piti 2, Orduña 1»: the board as the island says it. */
export const boardSaid = (rival: string, gf: number, ga: number) => `Piti ${gf}, ${rival} ${ga}`;

/** The score once the plays up to `seconds` of play (and, at the same second, up to `id`) are counted. */
function scoreThrough(events: readonly MatchEvent[], seconds: number, id?: string): { gf: number; ga: number } {
  let gf = 0;
  let ga = 0;
  const list = settled(events).map((e, order) => ({ e, order }));
  const stop = id ? list.find((x) => x.e.id === id)?.order : undefined;
  for (const { e, order } of list) {
    const s = eventSeconds(e);
    if (s > seconds || (s === seconds && stop !== undefined && order > stop)) continue;
    const goal = eventMetaOf(e).goal;
    if (goal === "for") gf++;
    else if (goal === "against") ga++;
  }
  return { gf, ga };
}

/** The moment of event `e` of `match`, or null for a play the island doesn't unfold (a corner, a foul, a chance,
 *  the narrated analysis actions) or a duplicate nobody has resolved. `nameOf` names one of ours in the match's
 *  season (nameFor); a guest reads as «Rafa (invitado)». */
export function momentOf(e: MatchEvent, match: MomentMatch, nameOf: (id: string) => string): MatchMoment | null {
  if (!isMesaType(e.type) || (e.dupOf && e.dupOk !== true)) return null;
  const rival = rivalOf(match);
  const name = withGuestNames(match, nameOf);
  const who = e.playerId ? name(e.playerId) : "";
  const sentence = eventSentence(e, { nameOf: name, rival });
  const minute = eventMinute(e);
  const meta = eventMetaOf(e);
  const base = { id: e.id, minute };
  const score = () => scoreThrough(match.events ?? [], eventSeconds(e), e.id);
  switch (e.type) {
    case "goal":
    case "goal_penalty":
    case "goal_freekick":
    case "opponent_own_goal": {
      const { gf, ga } = score();
      const own = e.type === "opponent_own_goal";
      const how = e.type === "goal_penalty" ? "De penalti" : e.type === "goal_freekick" ? "De falta" : "";
      const assist = e.assistPlayerId ? `Pase de ${name(e.assistPlayerId)}` : "";
      const lead = [how, assist].filter(Boolean).join(", ");
      const title = own ? `GOL · AUTOGOL DE ${up(rival)}` : who ? `GOL · ${up(who)}` : "GOL DEL PITI";
      const said = endSentence(own ? `Gol del Piti, autogol de ${rival}` : who ? `Gol del Piti, de ${who}` : "Gol del Piti");
      return { ...base, kind: "gol", ours: true, title, sub: lead ? `${lead}. ${scoreText(gf, ga)}` : scoreText(gf, ga), said: `${said} ${boardSaid(rival, gf, ga)}` };
    }
    case "opponent_goal":
    case "own_goal": {
      const { gf, ga } = score();
      const own = e.type === "own_goal";
      const title = own ? (who ? `EN PROPIA · ${up(who)}` : "GOL EN PROPIA") : `GOL · ${up(rival)}`;
      const said = endSentence(own ? (who ? `Gol en propia de ${who}` : "Gol en propia") : `Gol de ${rival}`);
      return { ...base, kind: "golrival", ours: false, title, sub: scoreText(gf, ga), said: `${said} ${boardSaid(rival, gf, ga)}` };
    }
    case "yellow_card":
    case "opponent_yellow": {
      const ours = meta.side === "us";
      const target = ours ? who : rival;
      return { ...base, kind: "amarilla", ours, title: target ? `AMARILLA · ${up(target)}` : "AMARILLA", sub: sentence.sub, said: target ? `Amarilla a ${target}` : "Amarilla" };
    }
    case "double_yellow":
    case "red_card":
    case "opponent_red": {
      const ours = meta.side === "us";
      const target = ours ? who : rival;
      const sub = ours ? sentence.sub : e.note?.trim() || `Juega con uno menos ${rival}`;
      return { ...base, kind: "roja", ours, title: target ? `ROJA · ${up(target)}` : "ROJA", sub, said: target ? `Roja a ${target}` : "Roja" };
    }
    case "substitution": {
      const inn = e.inPlayerId ? name(e.inPlayerId) : "";
      const title = inn ? `CAMBIO · ENTRA ${up(inn)}` : who ? `CAMBIO · SALE ${up(who)}` : "CAMBIO";
      const said = inn && who ? `Cambio: entra ${inn} por ${who}` : inn ? `Cambio: entra ${inn}` : who ? `Cambio: sale ${who}` : "Cambio";
      return { ...base, kind: "cambio", ours: true, title, sub: inn && who ? `Sale ${who}` : e.note?.trim() ?? "", said };
    }
    case "woodwork":
    case "opponent_woodwork": {
      const ours = meta.side === "us";
      const target = ours ? who || "el Piti" : rival;
      return { ...base, kind: "palo", ours, title: `AL PALO · ${up(target)}`, sub: e.note?.trim() ?? "", said: `Al palo, ${target}` };
    }
    case "save":
    case "penalty_saved": {
      const pen = e.type === "penalty_saved";
      const target = who || "el Piti";
      const title = `${pen ? "PENALTI PARADO" : "PARADA"} · ${up(target)}`;
      return { ...base, kind: "parada", ours: true, title, sub: pen ? sentence.sub : e.note?.trim() ?? "", said: pen ? `${who || "El Piti"} para un penalti` : `Parada de ${target}` };
    }
    case "penalty_missed":
    case "opponent_penalty_missed":
    case "penalty_received":
    case "penalty_committed": {
      const ours = e.type === "penalty_missed" || e.type === "penalty_received";
      const title =
        e.type === "penalty_missed" ? `PENALTI FALLADO${who ? ` · ${up(who)}` : ""}` : e.type === "opponent_penalty_missed" ? `PENALTI FALLADO · ${up(rival)}` : e.type === "penalty_received" ? "PENALTI A FAVOR" : `PENALTI PARA ${up(rival)}`;
      return { ...base, kind: "penalti", ours, title, sub: sentence.sub, said: sentence.title };
    }
    case "injury":
      return { ...base, kind: "lesion", ours: true, title: who ? `TOCADO · ${up(who)}` : "UN JUGADOR TOCADO", sub: sentence.sub, said: sentence.title };
    default:
      return null;
  }
}

/** A moment with the seconds of play it happened at (`t`, to order them and judge freshness) and, for the
 *  clock's turns, the wall time (`at`). */
export interface TimedMoment {
  moment: MatchMoment;
  t: number;
  at: number | null;
}

/** The clock's turns as moments: kick-off, half-time, the second half and the final whistle, each when its
 *  stamp is there. Matches without a clock have none (the island's state says those). */
export function clockMomentsOf(match: MomentMatch): TimedMoment[] {
  const c: MatchClock | undefined = match.clock;
  if (!c) return [];
  const rival = rivalOf(match);
  const events = match.events ?? [];
  const out: TimedMoment[] = [];
  const turn = (kind: MomentKind, at: number | undefined, make: (gf: number, ga: number, secs: number) => Omit<MatchMoment, "id" | "kind" | "ours">) => {
    if (typeof at !== "number") return;
    // (the clock stored now has later stamps: half-time and the restart read the first half's time)
    const r = clockReading(c, at);
    const secs = kind === "arranque" ? 0 : kind === "final" ? r.elapsedSeconds : r.firstSeconds;
    const { gf, ga } = scoreThrough(events, secs);
    // (the final after the last play of the same second; the kick-off before everything)
    const t = kind === "arranque" ? -1 : kind === "final" ? secs + 0.5 : secs;
    out.push({ moment: { id: `${match.id}:${kind}`, kind, ours: true, ...make(gf, ga, secs) }, t, at });
  };
  turn("arranque", c.firstStartedAt, () => ({ minute: 0, title: "EMPIEZA EL PARTIDO", sub: "La mesa ya ha puesto el reloj", said: "Empieza el partido" }));
  turn("descanso", c.firstEndedAt, (gf, ga, secs) => ({ minute: Math.max(1, Math.ceil(secs / 60)), title: `DESCANSO · ${scoreText(gf, ga)}`, sub: "", said: `Descanso. ${boardSaid(rival, gf, ga)}` }));
  turn("reanudacion", c.secondStartedAt, (gf, ga, secs) => ({ minute: Math.floor(secs / 60) + 1, title: "EMPIEZA LA SEGUNDA PARTE", sub: scoreText(gf, ga), said: `Arranca la segunda parte. ${boardSaid(rival, gf, ga)}` }));
  if (c.phase === "ended")
    turn("final", c.endedAt, (gf, ga, secs) => ({ minute: Math.max(1, Math.ceil(secs / 60)), title: `FINAL · ${scoreText(gf, ga)}`, sub: match.status === "finished" ? "Ya está el acta" : "Acta pendiente: la mesa la está repasando", said: `Final. ${boardSaid(rival, gf, ga)}` }));
  return out;
}

/** Every moment of the match so far, the plays and the clock's turns, in the order they happened. */
export function momentsOf(match: MomentMatch, nameOf: (id: string) => string): TimedMoment[] {
  const plays: TimedMoment[] = [];
  for (const e of settled(match.events)) {
    if (typeof e.minute !== "number" && typeof e.elapsedSeconds !== "number") continue;
    const moment = momentOf(e, match, nameOf);
    if (moment) plays.push({ moment, t: eventSeconds(e), at: null });
  }
  // (stable: two plays of the same second keep the acta's order)
  return [...clockMomentsOf(match), ...plays].map((x, i) => ({ x, i })).sort((a, b) => a.x.t - b.x.t || a.i - b.i).map(({ x }) => x);
}

/** Seconds of play at `now`: the clock, or (no clock) the minute read from the kick-off; null before it. */
function readingSeconds(match: MomentMatch, now: number): number | null {
  if (match.clock) return match.clock.phase === "ready" ? null : clockReading(match.clock, now).elapsedSeconds;
  const minute = liveMinute(match, now);
  return minute === null ? null : minute * 60;
}

/** Whether a moment is fresh at `now` (the server time as the phone estimates it): a play within
 *  FRESH_MOMENT_SECONDS of the clock's reading (one «ahead» of it counts too, the estimate is rough), a turn of
 *  the clock within that many seconds of its stamp. */
export function isFreshMoment(m: Pick<TimedMoment, "t" | "at">, match: MomentMatch, now: number): boolean {
  if (m.at !== null) return now - m.at <= FRESH_MOMENT_SECONDS * 1000;
  const reading = readingSeconds(match, now);
  return reading !== null && reading - m.t <= FRESH_MOMENT_SECONDS;
}
