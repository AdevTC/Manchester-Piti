// «Tu temporada en 10 cromos»: a member's season as a story of up to ten cards (spec:
// docs/superpowers/specs/2026-10-16-temporada-en-cromos-design.md). Pure, and built on the functions the
// perfil already uses, so every number is the one Perfil › Temporada and the stats pages print:
// - partidos, minutos, goles, asistencias, MVP and the socio come from the perfil card (buildCard: the
//   pizarra cromo over the season, with derived/minutesOf for minutes — a legacy acta stays unknown, «—»);
// - «Dónde jugaste» is the perfil's «Dónde has jugado» (positionsPlayed: playerPositions + mvpOfFrom);
// - la porra is the perfil's line (porraLine), las medallas the vitrina's, el equipo G·E·P via resultOf
//   (derived/result's resultLetter) and the jornadas via derived/jornada.
// A card with nothing to say is left out, so a story has 5 to 10 cards.
//
// RecapInput is what useProfileData already reads (no new data):
//   matches        useClubData().matches
//   players        useClubData().players
//   seasons        useSeason().seasons, in its order (oldest first: the seasons query sorts by name),
//                  which says which season is «later»; `archived` when the caller knows it
//   mvpResults     useMvpResults()
//   porraStandings usePorraStandings(seasonId).data (the recap's season)
//   uid            the member's uid (his porra row)
//   now            the perfil's minute clock (MVP votes count once closed)
import { dateMillis } from "../../../functions/src/matchEngine";
import { nextFixture, type ClubMatch } from "../clubData";
import { chronological, playerGame } from "../clubAnalytics";
import { scoreOf, resultOf } from "../partidos";
import type { PlayerDoc } from "../schemas";
import { currentSeasonId, vitrina, type MvpResult } from "../vestuario";
import { jornadaLabel } from "./jornada";
import { buildCard, seasonSquad } from "../../pages/perfil/card";
import { porraLine, positionsPlayed, seasonPlayers } from "../../pages/perfil/profileData";

export type RecapCard =
  | { kind: "portada"; name: string; number: string; season: string }
  | { kind: "partidos"; played: number; minutes: number | null }
  | { kind: "goles"; goals: number; assists: number; best: { matchId: string; label: string; goals: number; assists: number } | null }
  | { kind: "mvp"; times: number; votes: number }
  | { kind: "socio"; partnerId: string; partnerName: string; combined: number }
  | { kind: "posiciones"; codes: { code: string; minutes: number }[]; main: string | null }
  | { kind: "porra"; rank: number; of: number; points: number }
  | { kind: "medallas"; medals: { id: string; label: string }[] }
  | { kind: "equipo"; g: number; e: number; p: number; gf: number; ga: number; biggest: { label: string; score: string } | null }
  | { kind: "cierre"; season: string };
export interface SeasonRecap {
  seasonId: string;
  seasonName: string;
  partial: boolean;
  cards: RecapCard[];
}

export interface RecapSeason {
  id: string;
  name: string;
  /** An archived season is closed whatever its calendar says. */
  archived?: boolean;
}
export interface RecapPorraRow {
  uid: string;
  points: number;
  exact: number;
  played: number;
}
export interface RecapInput {
  matches: ClubMatch[];
  players: PlayerDoc[];
  seasons: RecapSeason[];
  mvpResults: Map<string, MvpResult>;
  porraStandings: RecapPorraRow[];
  uid: string;
  now: number;
}

/** The team's played matches from which the current season gets its «hasta ahora». */
export const PARTIAL_FROM = 10;

/** The season's matches in calendar order and the finished ones (the perfil card's own call). */
function seasonGames(input: RecapInput, seasonId: string) {
  return seasonSquad([], input.matches, seasonId, input.mvpResults, input.now);
}

/**
 * When the recap can be opened. Only for a player with at least one match in the season.
 * - «closed»: the season is archived, or a later season is the club's current one (currentSeasonId: the
 *   next match's season, else the latest played, else the newest — what the vestuario, the home, the
 *   perfil and the admin's «Activa» all use). A gap between fixtures never closes a season: until the
 *   next season takes over, the season is still the current one.
 * - «partial»: the current season, from its 10th played match («hasta ahora»).
 * - null otherwise (the current season under 10 matches, or a season after the current one).
 */
export function recapAvailable(input: RecapInput, playerId: string, seasonId: string, now: number): "closed" | "partial" | null {
  const season = input.seasons.find((s) => s.id === seasonId);
  if (!season || !playerId) return null;
  const { games } = seasonGames(input, seasonId);
  if (!games.some((m) => playerGame(playerId, m).played)) return null;
  if (season.archived) return "closed";
  // (the app never sees archived seasons: they are left out of the «current» question, as SeasonContext does)
  const live = input.seasons.filter((s) => !s.archived);
  const current = currentSeasonId(nextFixture(input.matches, now), input.matches, live);
  if (current === seasonId) return games.length >= PARTIAL_FROM ? "partial" : null;
  const at = live.findIndex((s) => s.id === seasonId);
  const cur = live.findIndex((s) => s.id === current);
  return at >= 0 && cur > at ? "closed" : null;
}

const byDate = (a: ClubMatch, b: ClubMatch) => dateMillis(a.date) - dateMillis(b.date);

/** The vitrina's medals earned with this season's matches (earned by its end, not before its start). */
function seasonMedals(input: RecapInput, playerId: string, games: ClubMatch[]): { id: string; label: string }[] {
  const sorted = [...games].sort(byDate);
  const from = dateMillis(sorted[0].date);
  const to = dateMillis(sorted[sorted.length - 1].date);
  const all = chronological(input.matches);
  const before = new Set(vitrina(playerId, all.filter((m) => dateMillis(m.date) < from), input.mvpResults, input.seasons, input.now).filter((m) => m.earned).map((m) => m.id));
  return vitrina(playerId, all.filter((m) => dateMillis(m.date) <= to), input.mvpResults, input.seasons, input.now)
    .filter((m) => m.earned && !before.has(m.id))
    .map((m) => ({ id: m.id, label: m.label }));
}

/** The member's season as cards (null without the season or without a match of his in it). */
export function seasonRecap(input: RecapInput, playerId: string, seasonId: string): SeasonRecap | null {
  const season = input.seasons.find((s) => s.id === seasonId);
  if (!season || !playerId) return null;
  const { now, mvpResults } = input;
  const squad = seasonPlayers(input.players, seasonId, input.seasons, playerId);
  const card = buildCard({ state: "vinculada", playerId, nickname: "", captain: false, squad, matches: input.matches, seasonId, seasonName: season.name, seasons: input.seasons, mvpResults, now });
  const { calendar, games, jornada } = seasonGames(input, seasonId);
  const t = card.totals;
  if (!card.started || t.played === 0) return null;
  const label = (m: ClubMatch) => `${jornadaLabel(jornada.get(m.id)) || "—"} contra ${m.rival || "el rival"}`;
  const cards: RecapCard[] = [{ kind: "portada", name: card.name, number: card.number, season: season.name }];

  cards.push({ kind: "partidos", played: t.played, minutes: t.minutes });

  // his best match: most goals + assists, then most goals, then the first
  let best: { m: ClubMatch; goals: number; assists: number } | null = null;
  for (const m of games) {
    const g = playerGame(playerId, m);
    if (g.goals + g.assists === 0) continue;
    if (!best || g.goals + g.assists > best.goals + best.assists || (g.goals + g.assists === best.goals + best.assists && g.goals > best.goals)) best = { m, goals: g.goals, assists: g.assists };
  }
  cards.push({ kind: "goles", goals: t.goals, assists: t.assists, best: best ? { matchId: best.m.id, label: label(best.m), goals: best.goals, assists: best.assists } : null });

  // MVP: only when the season had a vote that closed (its winners are the card's own count)
  const voted = games.filter((m) => typeof m.voteClosesAt === "number" && m.voteClosesAt <= now && mvpResults.has(m.id));
  if (voted.length) cards.push({ kind: "mvp", times: t.mvps, votes: voted.reduce((s, m) => s + (mvpResults.get(m.id)?.counts[playerId] ?? 0), 0) });

  // the perfil's «Tu socio en el campo», when the two of you have combined a goal
  const p = card.partner;
  if (p && p.combos > 0) cards.push({ kind: "socio", partnerId: p.playerId, partnerName: p.name, combined: p.combos });

  const played = positionsPlayed(playerId, calendar, mvpResults, now);
  if (played.lines.length) cards.push({ kind: "posiciones", codes: played.lines.map((l) => ({ code: l.code, minutes: l.minutes })), main: played.top });

  const porra = porraLine(input.porraStandings, input.uid);
  if (porra) cards.push({ kind: "porra", rank: porra.rank, of: porra.of, points: porra.points });

  const medals = seasonMedals(input, playerId, games);
  if (medals.length) cards.push({ kind: "medallas", medals });

  let g = 0, e = 0, l = 0, gf = 0, ga = 0;
  let big: { m: ClubMatch; gf: number; ga: number } | null = null;
  for (const m of games) {
    const s = scoreOf(m);
    gf += s.gf;
    ga += s.ga;
    const r = resultOf(m);
    if (r === "E") e++;
    else if (r === "P") l++;
    else {
      g++;
      if (!big || s.gf - s.ga > big.gf - big.ga || (s.gf - s.ga === big.gf - big.ga && s.gf > big.gf)) big = { m, gf: s.gf, ga: s.ga };
    }
  }
  cards.push({ kind: "equipo", g, e, p: l, gf, ga, biggest: big ? { label: label(big.m), score: `${big.gf}–${big.ga}` } : null });

  cards.push({ kind: "cierre", season: season.name });
  return { seasonId, seasonName: season.name, partial: recapAvailable(input, playerId, seasonId, now) !== "closed", cards };
}
