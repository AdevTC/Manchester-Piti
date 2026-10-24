import { describe, expect, it } from "vitest";
import type { ClubMatch, Participation } from "../clubData";
import type { PlayerDoc } from "../schemas";
import type { MvpResult } from "../vestuario";
import { analysePlayer, chronological, teamAnalysis } from "../clubAnalytics";
import { buildCard, seasonCalendar } from "./card";
import { porraLine, positionsPlayed, seasonPlayers } from "./seasonPlayers";
import { totalMinutes } from "./minutesOf";
import { wholeMinutes } from "./minutes";
import { recapAvailable, seasonRecap, type RecapCard, type RecapInput } from "./seasonRecap";

// One club, two seasons:
// - T1, closed: four finished actas (one legacy, without a ledger), a cancelled match, one closed MVP vote
//   and a porra; ana scores with bea's pass, cris only plays the legacy acta.
// - T2, under way: ten finished actas and one still to play, no MVP vote and no porra (the «hasta ahora»).
const DAY = 86_400_000;
const NOW = 300 * DAY;
const row = (minutes: number, extra: Partial<Participation> = {}) =>
  ({ played: minutes > 0, started: minutes > 0, benched: minutes === 0, minutes, secondsPlayed: Math.round(minutes * 60), goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, ...extra }) as Participation;
const match = (id: string, seasonId: string, day: number, o: Partial<ClubMatch> = {}): ClubMatch => ({ id, seasonId, rival: `Rival ${id}`, status: "finished", date: day * DAY, duration: 50, goalsFor: 1, goalsAgainst: 0, events: [], ...o });

const T1: ClubMatch[] = [
  match("a1", "t1", 10, { ledger: { ana: row(50, { goals: 1, positionsPlayed: { DC: 50 } }), bea: row(23.5, { positionsPlayed: { MC: 23.5 } }) }, events: [{ id: "g1", type: "goal", minute: 5, playerId: "ana", assistPlayerId: "bea" }] }),
  match("a2", "t1", 17, { goalsFor: 2, goalsAgainst: 2, ledger: { ana: row(40.25, { positionsPlayed: { DC: 40.25 } }), bea: row(0) } }),
  // the legacy acta: no ledger, only «Participación (histórico)»
  match("a3", "t1", 24, { goalsFor: 0, goalsAgainst: 1, events: [{ id: "p1", type: "match_played", playerId: "ana" }, { id: "p2", type: "match_played", playerId: "cris" }, { id: "p3", type: "match_played", playerId: "bea" }] }),
  match("a4", "t1", 31, { goalsFor: 3, goalsAgainst: 0, voteClosesAt: 32 * DAY, ledger: { ana: row(30, { positionsPlayed: { DC: 20, MCO: 10 } }), bea: row(50, { positionsPlayed: { MC: 50 } }) } }),
  match("a5", "t1", 38, { status: "cancelled", ledger: { ana: row(50, { positionsPlayed: { DC: 50 } }) } }),
];
const T2: ClubMatch[] = [
  ...Array.from({ length: 10 }, (_, i) => match(`b${i + 1}`, "t2", 100 + 7 * i, { ledger: { ana: row(50, { positionsPlayed: { DC: 50 } }) } })),
  match("b11", "t2", 400, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined }),
];
const MVP = new Map<string, MvpResult>([["a4", { id: "a4", counts: { ana: 4, bea: 1 }, total: 5 }]]);
const DOCS = [
  { id: "ana", shirtName: "ANA", firstName: "Ana", number: 9, naturalPosition: "DEL", seasons: ["t1", "t2"], active: true },
  { id: "bea", shirtName: "BEA", firstName: "Bea", number: 8, naturalPosition: "MED", seasons: ["t1", "t2"], active: true },
  { id: "cris", shirtName: "CRIS", firstName: "Cris", number: 4, naturalPosition: "DEF", seasons: ["t1"], active: true },
  { id: "dani", shirtName: "DANI", firstName: "Dani", number: 7, naturalPosition: "DEF", seasons: ["t1"], active: true },
] as unknown as PlayerDoc[];
const SEASONS = [
  { id: "t1", name: "Temporada 1" },
  { id: "t2", name: "Temporada 2" },
];
const PORRA = [
  { uid: "u-bea", points: 12, exact: 2, played: 4 },
  { uid: "u-ana", points: 7, exact: 1, played: 4 },
];
const input = (o: Partial<RecapInput> = {}): RecapInput => ({ matches: [...T2, ...T1], players: DOCS, seasons: SEASONS, mvpResults: MVP, porraStandings: PORRA, uid: "u-ana", now: NOW, standings: [], ...o });
const kinds = (cards: RecapCard[]) => cards.map((c) => c.kind);
const find = <K extends RecapCard["kind"]>(cards: RecapCard[], k: K) => cards.find((c): c is Extract<RecapCard, { kind: K }> => c.kind === k);

describe("seasonRecap: a closed season", () => {
  const r = seasonRecap(input(), "ana", "t1")!;

  it("is closed (a later season is the current one) and tells all ten cards", () => {
    expect(recapAvailable(input(), "ana", "t1", NOW)).toBe("closed");
    expect(r.partial).toBe(false);
    expect(r.seasonName).toBe("Temporada 1");
    expect(kinds(r.cards)).toEqual(["portada", "partidos", "goles", "mvp", "socio", "posiciones", "porra", "medallas", "equipo", "cierre"]);
  });

  it("each card's numbers", () => {
    expect(find(r.cards, "portada")).toEqual({ kind: "portada", name: "ANA", number: "9", season: "Temporada 1" });
    // the legacy acta counts as played but adds no minutes; the cancelled match counts nothing
    expect(find(r.cards, "partidos")).toEqual({ kind: "partidos", played: 4, minutes: 120 });
    expect(find(r.cards, "goles")).toEqual({ kind: "goles", goals: 1, assists: 0, best: { matchId: "a1", label: "J1 contra Rival a1", goals: 1, assists: 0 } });
    expect(find(r.cards, "mvp")).toEqual({ kind: "mvp", times: 1, votes: 4 });
    expect(find(r.cards, "socio")).toEqual({ kind: "socio", partnerId: "bea", partnerName: "BEA", combined: 1 });
    expect(find(r.cards, "posiciones")).toEqual({ kind: "posiciones", codes: [{ code: "DC", minutes: 110.25 }, { code: "MCO", minutes: 10 }], main: "DC" });
    expect(find(r.cards, "porra")).toEqual({ kind: "porra", rank: 2, of: 2, points: 7 });
    expect(find(r.cards, "medallas")!.medals.map((m) => m.id)).toEqual(["debut", "goal", "mvp"]);
    expect(find(r.cards, "equipo")).toEqual({ kind: "equipo", g: 2, e: 1, p: 1, gf: 6, ga: 3, biggest: { label: "J4 contra Rival a4", score: "3\u2060–\u20600" } });
    expect(find(r.cards, "cierre")).toEqual({ kind: "cierre", season: "Temporada 1" });
  });

  it("parity: the same numbers as Perfil › Temporada and the stats pages", () => {
    const squad = seasonPlayers(DOCS, "t1", SEASONS, "ana");
    const card = buildCard({ state: "vinculada", playerId: "ana", nickname: "ana", captain: false, squad, matches: input().matches, seasonId: "t1", seasonName: "Temporada 1", seasons: SEASONS, mvpResults: MVP, now: NOW, standings: [] });
    const games = chronological(input().matches.filter((m) => m.seasonId === "t1"));
    const stats = analysePlayer(DOCS[0], games);
    const partidos = find(r.cards, "partidos")!;
    const goles = find(r.cards, "goles")!;
    expect(partidos.played).toBe(card.totals.played);
    expect(partidos.played).toBe(stats.matchesPlayed);
    expect(partidos.minutes).toBe(card.totals.minutes);
    expect(partidos.minutes).toBe(wholeMinutes(totalMinutes(games, "ana")));
    expect(partidos.minutes).toBe(wholeMinutes(stats.minutes));
    expect([goles.goals, goles.assists]).toEqual([card.totals.goals, card.totals.assists]);
    expect([goles.goals, goles.assists]).toEqual([stats.goals, stats.assists]);
    expect(find(r.cards, "mvp")!.times).toBe(card.totals.mvps);
    expect(find(r.cards, "socio")!.partnerId).toBe(card.partner!.playerId);
    expect(find(r.cards, "socio")!.combined).toBe(card.partner!.combos);
    const played = positionsPlayed("ana", seasonCalendar(input().matches, "t1"), []);
    expect(find(r.cards, "posiciones")!.codes).toEqual(played.lines.map((l) => ({ code: l.code, minutes: l.minutes })));
    const porra = porraLine(PORRA, "u-ana")!;
    expect(find(r.cards, "porra")).toMatchObject({ rank: porra.rank, of: porra.of, points: porra.points });
    const team = teamAnalysis(games);
    expect(find(r.cards, "equipo")).toMatchObject({ g: team.wins, e: team.draws, p: team.losses, gf: team.gf, ga: team.ga });
  });
});

describe("seasonRecap: cards with nothing to say are left out", () => {
  it("a player only on a legacy acta: minutes unknown («—»), no best match, no socio, no positions, no porra", () => {
    const r = seasonRecap(input({ uid: "u-cris" }), "cris", "t1")!;
    expect(find(r.cards, "partidos")).toEqual({ kind: "partidos", played: 1, minutes: null });
    expect(find(r.cards, "goles")!.best).toBeNull();
    // the season had a vote: the card stays, with nothing won («El año que viene»)
    expect(find(r.cards, "mvp")).toEqual({ kind: "mvp", times: 0, votes: 0 });
    expect(kinds(r.cards)).toEqual(["portada", "partidos", "goles", "mvp", "medallas", "equipo", "cierre"]);
  });

  it("no match of his in the season: no recap", () => {
    expect(seasonRecap(input(), "dani", "t1")).toBeNull();
    expect(recapAvailable(input(), "dani", "t1", NOW)).toBeNull();
    expect(seasonRecap(input(), "ana", "nope")).toBeNull();
  });
});

describe("seasonRecap: the current season, «hasta ahora»", () => {
  it("from the 10th played match: partial, without MVP (no vote) nor porra (not played)", () => {
    const i = input({ porraStandings: [] });
    expect(recapAvailable(i, "ana", "t2", NOW)).toBe("partial");
    const r = seasonRecap(i, "ana", "t2")!;
    expect(r.partial).toBe(true);
    expect(kinds(r.cards)).toEqual(["portada", "partidos", "goles", "posiciones", "medallas", "equipo", "cierre"]);
    expect(find(r.cards, "partidos")).toEqual({ kind: "partidos", played: 10, minutes: 500 });
    // only what this season unlocked: «10 partidos» (b6, her 10th) and «Invicto» (a4 + b1–b4); debut, first
    // goal and MVP were T1's
    expect(find(r.cards, "medallas")!.medals).toEqual([
      { id: "ten", label: "10 partidos" },
      { id: "invicto", label: "Invicto" },
    ]);
  });

  it("before the 10th: not yet", () => {
    const i = input({ matches: [...T2.filter((m) => m.id !== "b10"), ...T1] });
    expect(recapAvailable(i, "ana", "t2", NOW)).toBeNull();
  });

  it("a gap between fixtures never closes the current season: every acta published, nothing scheduled", () => {
    const gap = T2.filter((m) => m.id !== "b11");
    expect(recapAvailable(input({ matches: [...gap, ...T1] }), "ana", "t2", NOW)).toBe("partial");
    expect(seasonRecap(input({ matches: [...gap, ...T1] }), "ana", "t2")!.partial).toBe(true);
    // under ten matches and between fixtures: still nothing
    const early = gap.slice(0, 5);
    expect(recapAvailable(input({ matches: [...early, ...T1] }), "ana", "t2", NOW)).toBeNull();
    // and T1, in the very same gap, is a past season: closed
    expect(recapAvailable(input({ matches: [...early, ...T1] }), "ana", "t1", NOW)).toBe("closed");
  });

  it("a past season is closed only once a later season is the current one", () => {
    // T2 exists but has no matches yet: T1 is still the current season («hasta ahora» needs 10, it has 4)
    expect(recapAvailable(input({ matches: T1 }), "ana", "t1", NOW)).toBeNull();
    // T2's first fixture is on the calendar: T2 takes over, T1 is closed
    const first = match("b1", "t2", 400, { status: "scheduled", goalsFor: undefined, goalsAgainst: undefined });
    expect(recapAvailable(input({ matches: [first, ...T1] }), "ana", "t1", NOW)).toBe("closed");
  });

  it("an archived season is closed whatever its calendar says", () => {
    const i = input({ seasons: [SEASONS[0], { ...SEASONS[1], archived: true }] });
    expect(recapAvailable(i, "ana", "t2", NOW)).toBe("closed");
    expect(seasonRecap(i, "ana", "t2")!.partial).toBe(false);
  });
});
