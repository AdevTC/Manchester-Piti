// «Vidrio» · Números: every scorer and every assister of the season, ranked (1, 2, 2, 4: a tie shares its
// place), from the published actas (lib/home playerLines + leaders, the rule the rest of the site counts by)
// plus tonight's provisional ones from the match being played. Guests never count (their goal is the team's,
// not a member's). Pure.
import type { ClubMatch } from "../../clubData";
import { OURS } from "../../partidos";
import { leaders, listNames, playerLines, seasonPulse, type PlayerLine, type SquadMember } from "../../home";
import { settled } from "../../eventMeta";
import { isGuestId } from "../guests";
import { endSentence, plural } from "../words";

export interface LeaderRow {
  id: string;
  name: string;
  num: string;
  /** Season total, tonight's provisional ones included. */
  value: number;
  /** Of them, from the match being played (0 when none). */
  provisional: number;
  /** Competition ranking: 1, 2, 2, 4. */
  rank: number;
  /** Someone else has the same value. */
  shared: boolean;
}

export interface SeasonLeaders {
  /** Everyone with at least one, most first (a tie, by name). */
  goals: LeaderRow[];
  assists: LeaderRow[];
  /** The first place (more than one when it is shared). */
  topScorers: LeaderRow[];
  topAssisters: LeaderRow[];
  /** «Pichichi compartido: Alcides y Adrián T.C., 7 goles.» · «Alcides manda, con 7 goles.» · «Aún sin goles.» */
  goalsLine: string;
  /** «Adrián T.C. es quien más pases de gol da.» · «Jordi y Josito reparten más que nadie: 4 asistencias cada uno.» */
  assistsLine: string;
  /** The shelf's short form: «Alcides y Adrián T.C., 7» · «Alcides, 7» · «Aún sin goles». */
  goalsHint: string;
  /** A match is being played and its goals are in. */
  live: boolean;
}

type Key = "goals" | "assists";

function tonight(live: ClubMatch | undefined): Record<Key, Map<string, number>> {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const e of settled(live?.events)) {
    if (!OURS.has(e.type) || e.type === "opponent_own_goal") continue;
    if (e.playerId && !isGuestId(e.playerId)) goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
    if (e.assistPlayerId && !isGuestId(e.assistPlayerId)) assists.set(e.assistPlayerId, (assists.get(e.assistPlayerId) ?? 0) + 1);
  }
  return { goals, assists };
}

function ranked(lines: PlayerLine[], key: Key, extra: Map<string, number>): LeaderRow[] {
  const withTonight = lines.map((l) => ({ ...l, stats: { ...l.stats, [key]: l.stats[key] + (extra.get(l.id) ?? 0) } }));
  const all = leaders(withTonight, key, Number.POSITIVE_INFINITY);
  const counts = new Map<number, number>();
  for (const l of all) counts.set(l.stats[key], (counts.get(l.stats[key]) ?? 0) + 1);
  let rank = 0;
  return all.map((l, i) => {
    if (!i || l.stats[key] !== all[i - 1].stats[key]) rank = i + 1;
    return { id: l.id, name: l.name, num: l.num, value: l.stats[key], provisional: extra.get(l.id) ?? 0, rank, shared: (counts.get(l.stats[key]) ?? 0) > 1 };
  });
}

/** The season's scorers and assisters at `now` for the squad `players` (lib/home SquadMember). */
export function seasonLeaders(matches: readonly ClubMatch[], seasonId: string, players: readonly SquadMember[], now: number): SeasonLeaders {
  const pulse = seasonPulse([...matches], seasonId, now);
  const lines = playerLines([...players], pulse.played);
  const extra = tonight(pulse.live);
  const goals = ranked(lines, "goals", extra.goals);
  const assists = ranked(lines, "assists", extra.assists);
  const topScorers = goals.filter((r) => r.rank === 1);
  const topAssisters = assists.filter((r) => r.rank === 1);
  const g = topScorers[0];
  const a = topAssisters[0];
  const goalsLine = !g
    ? "Aún sin goles."
    : topScorers.length > 1
      ? endSentence(`Pichichi compartido: ${listNames(topScorers)}, ${plural(g.value, "gol", "goles")}`)
      : endSentence(`${g.name} manda, con ${plural(g.value, "gol", "goles")}`);
  const assistsLine = !a
    ? "Ni un pase de gol todavía."
    : topAssisters.length > 1
      ? endSentence(`${listNames(topAssisters)} reparten más que nadie: ${plural(a.value, "asistencia", "asistencias")} cada uno`)
      : endSentence(`${a.name} es quien más pases de gol da`);
  return {
    goals,
    assists,
    topScorers,
    topAssisters,
    goalsLine,
    assistsLine,
    goalsHint: g ? `${listNames(topScorers)}, ${g.value}` : "Aún sin goles",
    live: !!pulse.live,
  };
}
