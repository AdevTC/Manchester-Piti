// GLOBAL and the química over a small season (4 matches with their ledgers): the numbers must mean
// something — the scorer rates highest, a cameo is provisional, a pair that never shared the pitch is a weak
// link — and the «why» says it in words.
import { describe, expect, it } from "vitest";
import type { ClubMatch, MatchEvent, Participation } from "../../../lib/clubData";
import { buildSquad, concededOnPitch, formWhy, minutesTogether, type SquadPlayer } from "./ratings";
import { chem, links, tierDiamonds, tierOf, TIERS } from "./quimica";
import { rtTxt } from "./model";
import { squadInfo } from "./bench";
import { lineupOf } from "./testkit";

const ZERO: Omit<Participation, "minutes" | "started" | "played" | "stints"> = {
  benched: false, notCalled: false, subIn: 0, subOut: 0, dismissed: false, exchanges: [],
  goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0,
  penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0,
};
/** On the pitch from `from` to `to` (a starter from 0, a sub coming in later). */
const on = (from: number, to: number, extra: Partial<Participation> = {}): Participation => ({ ...ZERO, minutes: to - from, started: from === 0, played: true, stints: [{ from, to }], ...extra });
let seq = 0;
const opp = (minute: number): MatchEvent => ({ id: "o" + seq++, type: "opponent_goal", minute });
const goal = (playerId: string, minute: number, assistPlayerId?: string): MatchEvent => ({ id: "g" + seq++, type: "goal", minute, playerId, ...(assistPlayerId ? { assistPlayerId } : {}) });
const match = (id: string, ledger: Record<string, Participation>, events: MatchEvent[] = []): ClubMatch => ({ id, status: "finished", duration: 50, ledger, events });

const player = (id: string, naturalPosition?: string): SquadPlayer => ({ id, shirtName: id, firstName: id, number: 1, naturalPosition, injured: false, active: true });
const PLAYERS = [player("por", "POR"), player("def", "DEF"), player("med", "MED"), player("del", "DEL"), player("sub", "DEL"), player("nuevo", "MED"), player("cola", "DEF")];

// por, def, med play every minute; del plays all four and scores in the last three; sub gets a 10′
// cameo in the first; cola (a defender) only the first; nuevo never plays.
const SEASON: ClubMatch[] = [
  match("j1", { por: on(0, 50), def: on(0, 50), med: on(0, 50), del: on(0, 40), sub: on(40, 50), cola: on(0, 50) }, [opp(10), opp(20), opp(45)]),
  match("j2", { por: on(0, 50), def: on(0, 50), med: on(0, 50), del: on(0, 50, { goals: 1 }) }, [goal("del", 12, "med")]),
  match("j3", { por: on(0, 50), def: on(0, 50, { yellowCards: 1 }), med: on(0, 50), del: on(0, 50, { goals: 2 }) }, [goal("del", 5), goal("del", 30, "def"), opp(48)]),
  match("j4", { por: on(0, 50), def: on(0, 50), med: on(0, 50), del: on(0, 50, { goals: 1, assists: 1 }) }, [goal("del", 20), goal("med", 33, "del")]),
];
const squad = () => buildSquad({ players: PLAYERS, games: SEASON, jornada: new Map(SEASON.map((m, i) => [m.id, i + 1])), suspended: new Set(), mvps: new Map([["j4", ["del"]]]), standings: [] });

describe("GLOBAL sobre una temporada corta", () => {
  it("rates from the acta's minutes: the scorer highest, provisional under 150′, the same on the cromo", () => {
    const sq = squad();
    const del = sq.byId.get("del")!;
    expect(del.global?.value).not.toBeNull();
    expect(del.rt).toBe(del.global!.value);
    expect(rtTxt(del)).toBe(String(del.rt));
    expect(Math.max(...sq.list.map((c) => c.global?.value ?? 0))).toBe(del.rt);
    expect(del.stats.goals).toBe(4);
    // four whole matches (200′) rate in full; a 10′ cameo is provisional
    expect(sq.byId.get("por")!.global!.status).toBe("rated");
    expect(sq.byId.get("sub")!.global!.status).toBe("provisional");
  });
  it("a player with no match shows «—», not a made-up number", () => {
    const sq = squad();
    const c = sq.byId.get("nuevo")!;
    expect(c.unrated).toBe(true);
    expect(c.global?.value).toBeNull();
    expect(rtTxt(c)).toBe("—");
  });
  it("says why, in a few words", () => {
    const sq = squad();
    expect(formWhy(sq, "del")).toBe("4 goles y 1 asistencia en sus 3 últimos");
    expect(formWhy(sq, "nuevo")).toBe("Sin partidos esta temporada");
    expect(formWhy(sq, "sub")).toBe("Sin jugar en los 3 últimos partidos");
    expect(formWhy(sq, "por")).toBe("Portería a cero en 2 de sus 3 últimos");
    expect(formWhy(sq, "nadie")).toBe("—");
  });
  it("counts the goals conceded only while he was on the pitch", () => {
    const j1 = SEASON[0];
    expect(concededOnPitch(j1, "por", 50)).toBe(3);
    // del left at 40′: the 45′ goal was not on him; sub came on at 40′: only that one
    expect(concededOnPitch(j1, "del", 40)).toBe(2);
    expect(concededOnPitch(j1, "sub", 10)).toBe(1);
    // without stints: his share of the match's goals
    expect(concededOnPitch({ id: "x", duration: 50, goalsAgainst: 2, events: [] }, "y", 25)).toBe(1);
  });
});

describe("la química en minutos juntos", () => {
  it("counts the minutes two players shared the pitch (their stints)", () => {
    expect(minutesTogether(SEASON[0], "del", "sub", 40, 10)).toBe(0);
    expect(minutesTogether(SEASON[0], "por", "sub", 50, 10)).toBe(10);
    const sq = squad();
    expect(sq.pairs.get("med|por")).toEqual({ tog: 4, ast: 0, min: 200, known: 200 }); // (ledgers: the printable minutes are the same)
    expect(sq.pairs.get("del|med")).toEqual({ tog: 4, ast: 2, min: 190, known: 190 });
    // never together: no pair at all
    expect(sq.pairs.has("del|sub")).toBe(false);
    expect([...sq.pairs.keys()].some((k) => k.includes("nuevo"))).toBe(false);
  });
  it("a pair with no minutes together is a weak link; a settled one is strong", () => {
    const sq = squad();
    // 2-3-1: POR · DEF DEF · MED MED MED · DEL
    const L = lineupOf(["por", "def", "cola", "med", "nuevo", null, "del"], "2-3-1", sq);
    const ls = links(L, sq);
    const between = (a: string, b: string) => ls.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    const settled = between("por", "def");
    expect(settled).toBeDefined();
    expect(settled!.t).toBeGreaterThanOrEqual(2);
    ls.filter((l) => l.a === "nuevo" || l.b === "nuevo").forEach((l) => {
      expect(l.min).toBe(0);
      expect(l.t).toBe(1);
    });
  });
  it("an unknown position is not natural", () => {
    const sq = buildSquad({ players: [player("x"), player("y", "DEF")], games: [], jornada: new Map(), suspended: new Set(), mvps: new Map(), standings: [] });
    const ch = chem(lineupOf(["x", "y"], "2-3-1", sq), sq);
    expect(ch.gk).toBe(true);
    expect(ch.gkNat).toBe(false);
    expect(ch.natN).toBe(1);
  });
  it("the bars are scaled by the matches the team has played", () => {
    const sq = squad();
    const L = lineupOf(["por", "def", "cola", "med", null, null, "del"], "2-3-1", sq);
    const ch = chem(L, sq);
    // EXP: 4 + 4 + 1 + 4 + 4 = 17 matches of 4 · 7 = 28 possible
    expect(ch.ex).toBe(Math.round((17 / 28) * 100));
    expect(chem(L, { ...sq, games: 0, teamMin: 0 }).ex).toBe(0);
  });
  it("one table for the tiers and the squad bars' diamonds", () => {
    TIERS.forEach((t) => {
      expect(tierOf(t.from)[0]).toBe(t.label);
      expect(tierDiamonds(t.from)).toBe(t.dm);
    });
    expect(tierDiamonds(84)).toBe(2);
    expect(tierDiamonds(85)).toBe(3);
    const sq = squad();
    const L = lineupOf(["por", "def", "cola", "med", null, null, "del"], "2-3-1", sq);
    const ch = chem(L, sq);
    expect(squadInfo(L, sq, ch).dm.filter(Boolean).length).toBe(tierDiamonds(ch.v));
  });
});

describe("the ficha's form bars come with the squad", () => {
  it("each cromo carries his last matches: minutes from the acta, goals + assists, a missed one as not played", () => {
    const sq = squad();
    expect(sq.byId.get("del")!.form).toEqual([
      { j: 1, played: true, min: 40, ga: 0 },
      { j: 2, played: true, min: 50, ga: 1 },
      { j: 3, played: true, min: 50, ga: 2 },
      { j: 4, played: true, min: 50, ga: 2 },
    ]);
    expect(sq.byId.get("cola")!.form?.map((g) => g.played)).toEqual([true, false, false, false]);
    expect(sq.byId.get("nuevo")!.form?.every((g) => !g.played && g.min === 0)).toBe(true);
  });
});

describe("each cromo carries his resolved positions", () => {
  it("positions when given, else what the line says", () => {
    const players: SquadPlayer[] = [
      { ...player("lat", "DEF"), positions: { main: "LD", also: ["MD", "XX"] } },
      player("por", "POR"),
      player("nada"),
    ];
    const sq = buildSquad({ players, games: [], jornada: new Map(), suspended: new Set(), mvps: new Map(), standings: [] });
    expect(sq.byId.get("lat")!.ps).toEqual({ main: "LD", also: ["MD"], line: "DEF" });
    expect(sq.byId.get("lat")!.pos).toBe("DEF");
    expect(sq.byId.get("por")!.ps).toEqual({ main: "POR", also: [], line: "POR" });
    expect(sq.byId.get("nada")!.ps).toEqual({ main: null, also: [], line: null });
  });
});
