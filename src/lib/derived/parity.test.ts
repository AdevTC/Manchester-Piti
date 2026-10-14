import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../clubData";
import type { PlayerDoc } from "../schemas";
import type { MvpResult } from "../vestuario";
import { analysePlayer, chronological } from "../clubAnalytics";
import { squadRow } from "../squad";
import { playerPositions } from "../positionStats";
import { isCompleted } from "../../../functions/src/matchEngine";
import { buildCard, seasonCalendar, seasonSquad } from "../../pages/perfil/card";
import { seasonPlayers } from "../../pages/perfil/profileData";
import { boardSeason } from "../../pages/pizarra/v2/useBoardData";
import { buildSquad } from "../../pages/pizarra/v2/ratings";
import { knownMinutes } from "../../pages/pizarra/v2/model";
import { mergeMatches } from "../../pages/admin/data/adminLogic";
import { mvpWinners } from "../vestuario";
import { mvpOfFrom } from "./mvpOf";
import { minutesOf, totalMinutes } from "./minutesOf";
import { wholeMinutes } from "./minutes";

// One fixture through every page that prints minutes or a rating by position: /stats and /jugadores
// (analysePlayer), the plantilla's ficha (squadRow), the perfil card (buildCard), the pizarra's cromos
// (buildSquad over boardSeason) and the admin's cromos (seasonSquad over the published matches). Same
// input, same number.

const DAY = 86_400_000;
const NOW = 100 * DAY;
const SEASONS = [{ id: "t1", name: "Temporada 1" }];
const row = (minutes: number, extra: Partial<Participation> = {}) =>
  ({ played: minutes > 0, started: minutes > 0, benched: minutes === 0, minutes, secondsPlayed: Math.round(minutes * 60), goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, ...extra }) as Participation;
const match = (id: string, day: number, o: Partial<ClubMatch>): ClubMatch => ({ id, seasonId: "t1", rival: `Rival ${id}`, status: "finished", date: day * DAY, duration: 50, goalsFor: 1, goalsAgainst: 0, events: [], ...o });

const MATCHES: ClubMatch[] = [
  match("j1", 10, { ledger: { ana: row(50, { goals: 1, positionsPlayed: { DC: 50 } }), bea: row(23.5, { positionsPlayed: { MC: 23.5 } }) }, events: [{ id: "g1", type: "goal", minute: 5, playerId: "ana" }] }),
  match("j2", 17, { ledger: { ana: row(40.25, { positionsPlayed: { DC: 40.25 } }), bea: row(0) } }),
  // a legacy acta: no ledger, only «Participación (histórico)» — nobody gets invented minutes
  match("j3", 24, { events: [{ id: "p1", type: "match_played", playerId: "ana" }, { id: "p2", type: "match_played", playerId: "cris" }, { id: "g2", type: "goal", playerId: "bea" }] }),
  match("j4", 31, { voteClosesAt: 32 * DAY, ledger: { ana: row(30, { positionsPlayed: { DC: 30 } }), bea: row(50, { positionsPlayed: { MC: 50 } }) } }),
  // a cancelled match never counts, even with a ledger
  match("j5", 38, { status: "cancelled", ledger: { ana: row(50, { positionsPlayed: { DC: 50 } }) } }),
];
const MVP = new Map<string, MvpResult>([["j4", { id: "j4", counts: { ana: 4, bea: 1 }, total: 5 }]]);
const DOCS = [
  { id: "ana", shirtName: "ANA", firstName: "Ana", number: 9, naturalPosition: "DEL", seasons: ["t1"], active: true },
  { id: "bea", shirtName: "BEA", firstName: "Bea", number: 8, naturalPosition: "MED", seasons: ["t1"], active: true },
  { id: "cris", shirtName: "CRIS", firstName: "Cris", number: 4, naturalPosition: "DEF", seasons: ["t1"], active: true },
] as unknown as PlayerDoc[];

// how each page builds its numbers
const statsGames = chronological(MATCHES.filter((m) => m.seasonId === "t1"));
const stats = (pid: string) => analysePlayer(DOCS.find((p) => p.id === pid)!, statsGames);
const squadPlayers = seasonPlayers(DOCS, "t1", SEASONS, null);
const card = (pid: string) => buildCard({ state: "vinculada", playerId: pid, nickname: pid, captain: false, squad: squadPlayers, matches: MATCHES, seasonId: "t1", seasonName: "Temporada 1", seasons: SEASONS, mvpResults: MVP, now: NOW });
const boardGames = boardSeason(MATCHES, "t1").filter((m) => isCompleted(m));
const board = buildSquad({ players: squadPlayers, games: boardGames, jornada: new Map(), suspended: new Set(), mvps: new Map(boardGames.map((m) => [m.id, mvpWinners(m, MVP.get(m.id), NOW)])) });
const admin = seasonSquad(squadPlayers, MATCHES, "t1", MVP, NOW).squad;

describe("paridad de minutos: /stats, /jugadores, la ficha, la carta del perfil, la pizarra y el admin", () => {
  it("the same known minutes for a player with ledgers (the legacy acta adds nothing, the cancelled one neither)", () => {
    const want = 120.25;
    expect(stats("ana").minutes).toBe(want);
    expect(totalMinutes(statsGames, "ana")).toBe(want);
    expect(stats("ana").series.reduce((s, g) => s + (g.minutes ?? 0), 0)).toBe(want);
    expect(squadRow(DOCS[0], stats("ana"), NOW).stats.minutes).toBe(want);
    expect(board.byId.get("ana")!.stats.minutes).toBe(want);
    expect(admin.byId.get("ana")!.stats.minutes).toBe(want);
    expect(card("ana").totals.minutes).toBe(wholeMinutes(want));
    expect(card("ana").attrs.find((a) => a.k === "MIN")!.text).toBe(String(wholeMinutes(want)));
    expect(stats("bea").minutes).toBe(73.5);
    expect(board.byId.get("bea")!.stats.minutes).toBe(73.5);
  });

  it("a player only on legacy actas: unknown everywhere («—»), never the match's length", () => {
    expect(minutesOf(MATCHES[2], "cris")).toBeNull();
    expect(stats("cris").tracked).toBe(0);
    expect(squadRow(DOCS[2], stats("cris"), NOW).stats.minutes).toBeNull();
    expect(knownMinutes(board.byId.get("cris")!.stats)).toBeNull();
    expect(knownMinutes(admin.byId.get("cris")!.stats)).toBeNull();
    expect(card("cris").totals.minutes).toBeNull();
    expect(card("cris").attrs.find((a) => a.k === "MIN")!.text).toBe("—");
  });
});

describe("paridad de la valoración por puesto: siempre con los MVP, el admin sin borradores", () => {
  const rating = (games: ClubMatch[]) => playerPositions("ana", games, mvpOfFrom(MVP, games, NOW)).lines.find((l) => l.code === "DC")!.rating;
  it("jugador, /stats, la ficha de la plantilla, el perfil y el admin give the same DC rating", () => {
    const jugador = rating(statsGames);
    expect(jugador).not.toBeNull();
    // the MVP of j4 counts: without it the rating is lower
    expect(playerPositions("ana", statsGames).lines[0].rating!).toBeLessThan(jugador!);
    expect(rating(chronological(MATCHES.filter((m) => m.seasonId === "t1")))).toBe(jugador); // /stats, /plantilla
    expect(rating(seasonCalendar(MATCHES, "t1"))).toBe(jugador); // perfil «Dónde has jugado»
    expect(rating(MATCHES)).toBe(jugador); // admin: the published matches
  });
  it("the admin reads the published matches, not a captain's draft on top of them", () => {
    const draft = { ...MATCHES[3], ledger: { ana: row(50, { positionsPlayed: { EI: 50 } }) } };
    const merged = mergeMatches(MATCHES, [draft]);
    expect(playerPositions("ana", merged, mvpOfFrom(MVP, merged, NOW)).lines.find((l) => l.code === "DC")!.rating).not.toBe(rating(statsGames));
    expect(rating(MATCHES)).toBe(rating(statsGames));
  });
});
