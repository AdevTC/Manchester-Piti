// Tú › Temporada (TU boards): what the card's numbers don't say — his one match «tramo a tramo» (the stretches he
// was on the pitch, the goals and cards on the same line), the match he watched from outside, when he scores
// (by ten-minute stretches), the wins with him on the pitch and the minutes he shared with his partner. Pure.
import type { ClubMatch } from "../../../lib/clubData";
import { eventMetaOf, settled } from "../../../lib/eventMeta";
import { rotationOf, type Stint } from "../../../lib/derived/vidrio/rotation";
import { durationOf, matchMarks, type MatchMark } from "../../../lib/derived/vidrio/matchMarks";
import { scoreText } from "../../../lib/derived/words";
import type { SeriesPoint } from "../card";

const GOALS = new Set(["goal", "goal_penalty", "goal_freekick"]);
const RESULT_WORD = { G: "Ganamos", E: "Empatamos", P: "Perdimos" } as const;

export interface OneMatch {
  j: number | null;
  rival: string;
  /** «Perdimos 1–8 contra Orduña fc». */
  result: string;
  marks: MatchMark[];
  duration: number;
}
export interface Stretches extends OneMatch {
  minutes: number;
  stints: (Stint & { left: number; width: number; t: string })[];
  /** «Titular · lateral derecho · penalti cometido en el 28′». */
  line: string;
  /** «En el campo del 0 al 10, del 18 al 35.» */
  alt: string;
}

/** Our goals and theirs in a finished match, from its acta's events. */
function scoreOf(m: ClubMatch): { gf: number; ga: number } {
  let gf = 0;
  let ga = 0;
  for (const e of settled(m.events ?? [])) {
    const g = eventMetaOf(e).goal;
    if (g === "for") gf++;
    else if (g === "against") ga++;
  }
  return { gf: m.goalsFor ?? gf, ga: m.goalsAgainst ?? ga };
}
function oneMatch(m: ClubMatch, j: number | null): OneMatch {
  const { gf, ga } = scoreOf(m);
  const r = gf > ga ? "G" : gf < ga ? "P" : "E";
  return { j, rival: m.rival || "el rival", result: `${RESULT_WORD[r]} ${scoreText(gf, ga)} contra ${m.rival || "el rival"}`, marks: matchMarks(m), duration: durationOf(m) };
}

/** His stretches in a match he played (null: he didn't). */
export function stretchesOf(m: ClubMatch, j: number | null, playerId: string, posName: string | null, nameOf: (id: string) => string): Stretches | null {
  const row = rotationOf(m, m.events ?? [], nameOf).rows.find((r) => r.id === playerId);
  if (!row || !row.minutes) return null;
  const base = oneMatch(m, j);
  const D = base.duration;
  const evs = settled(m.events ?? []);
  const mine = (pred: (e: (typeof evs)[number]) => boolean) => evs.filter((e) => e.playerId === playerId && pred(e)).map((e) => Math.round(e.minute ?? 0));
  const goals = mine((e) => GOALS.has(e.type));
  const yellow = mine((e) => e.type === "yellow_card");
  const pen = mine((e) => e.type === "penalty_committed");
  const starter = (m.starters ?? []).includes(playerId);
  const bits = [starter ? "Titular" : "Desde el banquillo", posName ? posName.toLowerCase() : "", ...pen.map((x) => `penalti cometido en el ${x}′`), ...yellow.map((x) => `amarilla en el ${x}′`), ...goals.map((x) => `gol en el ${x}′`)].filter(Boolean);
  return {
    ...base,
    minutes: row.minutes,
    stints: row.stints.map((s) => ({ ...s, left: (s.from / D) * 100, width: Math.max(1.2, ((s.to - s.from) / D) * 100), t: `${s.from}′–${s.to}′` })),
    line: bits.join(" · "),
    alt: `En el campo ${row.stints.map((s) => `del ${s.from} al ${s.to}`).join(", ")}.`,
  };
}

/** The match he watched from outside: «La J1 la viste desde fuera: no convocado. Perdimos 1–8…; marcó Alcides en el 43′.» */
export function watchedLine(m: ClubMatch, j: number | null, playerId: string, nameOf: (id: string) => string): { line: string; marks: MatchMark[] } {
  const base = oneMatch(m, j);
  const notCalled = (m.notCalled ?? []).includes(playerId);
  const scorers = settled(m.events ?? [])
    .filter((e) => GOALS.has(e.type) && e.playerId)
    .map((e) => `${nameOf(e.playerId ?? "")} en el ${Math.round(e.minute ?? 0)}′`);
  const jt = j ? `La J${j}` : "El último partido";
  return { line: `${jt} la viste desde fuera${notCalled ? ": no convocado" : ""}. ${base.result}${scorers.length ? `; ${scorers.length === 1 ? "marcó" : "marcaron"} ${scorers.join(", ")}` : ""}.`, marks: base.marks };
}

/** His goals by ten-minute stretch over the season's matches (0–10′ … 40–50′). */
export function goalClock(games: readonly ClubMatch[], playerId: string): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const m of games)
    for (const e of settled(m.events ?? []))
      if (GOALS.has(e.type) && e.playerId === playerId) {
        const D = durationOf(m);
        out[Math.min(4, Math.floor(((e.minute ?? 0) / D) * 5))]++;
      }
  return out;
}

/** The matches of the season he played that we won. */
export function winsWith(games: readonly ClubMatch[], series: readonly SeriesPoint[]): number {
  const played = new Set(series.filter((s) => s.played).map((s) => s.id));
  return games.filter((m) => played.has(m.id)).filter((m) => {
    const { gf, ga } = scoreOf(m);
    return gf > ga;
  }).length;
}

/** The minutes two players shared on the pitch in a match (their stretches overlapping). */
export function minutesTogether(m: ClubMatch, a: string, b: string, nameOf: (id: string) => string): number {
  const rows = rotationOf(m, m.events ?? [], nameOf).rows;
  const sa = rows.find((r) => r.id === a)?.stints ?? [];
  const sb = rows.find((r) => r.id === b)?.stints ?? [];
  let n = 0;
  for (const x of sa) for (const y of sb) n += Math.max(0, Math.min(x.to, y.to) - Math.max(x.from, y.from));
  return Math.round(n);
}

export { oneMatch };
