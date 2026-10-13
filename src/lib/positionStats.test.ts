import { describe, expect, it } from "vitest";
import type { ClubMatch } from "./clubData";
import { systemDef } from "./formations";
import { POS_CODES } from "./positions";
import { clubPositions, playedSummary, playerPositions, systemRecord } from "./positionStats";
import { formRating } from "../pages/pizarra/v2/ratings";

type Ev = NonNullable<ClubMatch["events"]>[number];
type Row = NonNullable<ClubMatch["ledger"]>[string];
const row = (minutes: number, extra: Partial<Row> = {}): Row => ({ minutes, started: true, benched: false, notCalled: false, played: minutes > 0, subIn: 0, subOut: 0, dismissed: false, stints: [], exchanges: [], goals: 0, assists: 0, yellowCards: 0, redCards: 0, doubleYellows: 0, penaltyCommitted: 0, penaltyReceived: 0, penaltySaved: 0, penaltyMissed: 0, goalPenalty: 0, goalFreekick: 0, ownGoals: 0, woodwork: 0, ...extra });
const ev = (goals = 0, assists = 0, yellowCards = 0, redCards = 0) => ({ goals, assists, yellowCards, redCards });
const match = (n: number, ledger: ClubMatch["ledger"], extra: Partial<ClubMatch> = {}): ClubMatch => ({
  id: "j" + n,
  rival: "Rival " + n,
  date: Date.UTC(2026, 8, n),
  duration: 50,
  status: "finished",
  goalsFor: 1,
  goalsAgainst: 0,
  events: [] as Ev[],
  ledger,
  ...extra,
});

const games: ClubMatch[] = [
  match(1, {
    ana: row(50, { goals: 1, positionsPlayed: { MCD: 30, MC: 20 }, positionEvents: { MCD: ev(1) } }),
    bea: row(50, { positionsPlayed: { MCD: 20, DFC: 30 } }),
  }),
  match(2, {
    ana: row(50, { assists: 1, yellowCards: 1, positionsPlayed: { MCD: 50 }, positionEvents: { MCD: ev(0, 1, 1) }, positionsEstimated: true }),
    bea: row(50, { goals: 1, positionsPlayed: { MCD: 30, DFC: 20 }, positionEvents: { DFC: ev(1) } }),
  }),
  match(3, { ana: row(50, { positionsPlayed: { MC: 40.5, DFC: 9.5 } }) }),
  // not finished yet, and a finished one without a ledger: neither counts
  match(4, { ana: row(50, { positionsPlayed: { DC: 50 } }) }, { status: "scheduled" }),
  match(5, undefined),
];

describe("playerPositions", () => {
  it("an old ledger without the keys gives empty lines and the explicit empty copy", () => {
    const old = [match(1, { ana: row(50, { goals: 2 }) }), match(2, { ana: row(30) })];
    const p = playerPositions("ana", old);
    expect(p).toEqual({ lines: [], minutes: 0, estimatedMatches: 0, matches: 0, top: null });
    expect(playedSummary(p)).toBe("Aún sin minutos con posición");
    expect(playerPositions("nadie", games).lines).toEqual([]);
  });

  it("sums minutes, matches and events by code, by minutes desc, and counts estimated matches", () => {
    const p = playerPositions("ana", games);
    expect(p.lines.map((l) => [l.code, l.minutes, l.matches])).toEqual([
      ["MCD", 80, 2],
      ["MC", 60.5, 2],
      ["DFC", 9.5, 1],
    ]);
    expect(p.lines[0]).toMatchObject({ goals: 1, assists: 1, yellowCards: 1, redCards: 0 });
    expect(p.lines[1]).toMatchObject({ goals: 0, assists: 0 });
    expect(p).toMatchObject({ minutes: 150, matches: 3, estimatedMatches: 1, top: "MCD" });
  });

  it("ignores unknown codes and empty minutes (no 0′ lines)", () => {
    const odd = [match(1, { ana: row(50, { positionsPlayed: { MC: 50, XX: 10, DC: 0 } as Row["positionsPlayed"] }) })];
    expect(playerPositions("ana", odd).lines.map((l) => l.code)).toEqual(["MC"]);
  });

  it("rates a code over the matches where it was his most-played one; null below 2", () => {
    const p = playerPositions("ana", games, (id) => (id === "j1" ? "ana" : null));
    const by = new Map(p.lines.map((l) => [l.code, l.rating]));
    // MCD led j1 (30 of 50) and j2 (50): presence 0.8, G+A 2 in 80′, 1 MVP, 1 yellow → 76
    expect(by.get("MCD")).toBe(76);
    // MC led only j3 and DFC never: too few matches
    expect(by.get("MC")).toBeNull();
    expect(by.get("DFC")).toBeNull();
    // without the MVPs the same code rates lower
    expect(playerPositions("ana", games).lines[0].rating).toBe(71);
  });
});

describe("playerPositions: cards and tiny lines", () => {
  const three = (first: Partial<Row>) => [
    match(1, { ana: row(50, { positionsPlayed: { MCD: 50 }, ...first }) }),
    match(2, { ana: row(50, { positionsPlayed: { MCD: 50 } }) }),
    match(3, { ana: row(50, { positionsPlayed: { MCD: 50 } }) }),
  ];
  const base = { role: "MED" as const, teamW: 3, playedW: 3, shareW: 3, minW: 150, gaW: 0, concW: 0, mvpW: 0, savesW: 0 };
  it("a second yellow (yellow 2 + red 1 at the code) counts 2, as cardPoints", () => {
    const dbl = playerPositions("ana", three({ yellowCards: 2, redCards: 1, doubleYellows: 1, positionEvents: { MCD: ev(0, 0, 2, 1) } }));
    expect(dbl.lines[0].rating).toBe(formRating({ ...base, cardsW: 2 }));
    expect(dbl.lines[0].rating).not.toBe(formRating({ ...base, cardsW: 4 }));
    // a straight red is 2 too; a yellow and a red without a double yellow stay 1 + 2
    expect(playerPositions("ana", three({ redCards: 1, positionEvents: { MCD: ev(0, 0, 0, 1) } })).lines[0].rating).toBe(formRating({ ...base, cardsW: 2 }));
    expect(playerPositions("ana", three({ yellowCards: 1, redCards: 1, positionEvents: { MCD: ev(0, 0, 1, 1) } })).lines[0].rating).toBe(formRating({ ...base, cardsW: 3 }));
  });
  it("drops lines under 1′ but keeps them in the total", () => {
    const p = playerPositions("ana", [match(1, { ana: row(50, { positionsPlayed: { MC: 49.6, DC: 0.4 } }) })]);
    expect(p.lines.map((l) => l.code)).toEqual(["MC"]);
    expect(p.minutes).toBe(50);
    expect(playerPositions("ana", [match(1, { ana: row(1, { positionsPlayed: { DC: 0.4 } }) })])).toMatchObject({ lines: [], minutes: 0.4, top: null });
  });
});

describe("playedSummary", () => {
  it("names the first position in full, then codes, minutes with ′", () => {
    const p = playerPositions("ana", games);
    expect(playedSummary(p)).toBe("Pivote (MCD) 80′ · MC 61′ · DFC 10′");
    expect(playedSummary(p, 2)).toBe("Pivote (MCD) 80′ · MC 61′");
  });
  it("leaves out lines that round to 0′", () => {
    const tiny = playerPositions("ana", [match(1, { ana: row(50, { positionsPlayed: { MC: 49.6, DC: 0.4 } }) })]);
    expect(playedSummary(tiny)).toBe("Mediocentro (MC) 50′");
  });
});

describe("clubPositions", () => {
  const names: Record<string, string> = { ana: "Ana", bea: "Bea" };
  it("gives all 13 codes in catalogue order, the owner by minutes, ties by name", () => {
    const c = clubPositions(games, (id) => names[id] ?? id);
    expect(c.map((l) => l.code)).toEqual([...POS_CODES]);
    const mcd = c.find((l) => l.code === "MCD")!;
    // ana 80, bea 50
    expect(mcd).toEqual({ code: "MCD", minutes: 130, owner: { id: "ana", minutes: 80 }, players: 2, goals: 1, assists: 1 });
    const dfc = c.find((l) => l.code === "DFC")!;
    expect(dfc).toMatchObject({ minutes: 59.5, owner: { id: "bea", minutes: 50 }, players: 2, goals: 1 });
    const dc = c.find((l) => l.code === "DC")!;
    expect(dc).toEqual({ code: "DC", minutes: 0, owner: null, players: 0, goals: 0, assists: 0 });
  });
  it("shows no «0′» rows: under 1′ a code has no minutes, owner or players", () => {
    const tiny = [match(1, { ana: row(50, { positionsPlayed: { MC: 49.6, DC: 0.4 } }), bea: row(1, { positionsPlayed: { LI: 0.4 } }), cris: row(1, { positionsPlayed: { LI: 0.4 } }), dani: row(1, { positionsPlayed: { LI: 0.4 } }) })];
    const c = clubPositions(tiny);
    expect(c.find((l) => l.code === "DC")).toEqual({ code: "DC", minutes: 0, owner: null, players: 0, goals: 0, assists: 0 });
    // 1.2′ in all, but nobody played a whole minute there
    expect(c.find((l) => l.code === "LI")).toMatchObject({ minutes: 1.2, owner: null, players: 0 });
    expect(c.find((l) => l.code === "MC")).toMatchObject({ minutes: 49.6, owner: { id: "ana", minutes: 49.6 }, players: 1 });
  });
  it("breaks an owner tie by name", () => {
    const tie = [match(1, { zoe: row(25, { positionsPlayed: { POR: 25 } }), bea: row(25, { positionsPlayed: { POR: 25 } }) })];
    expect(clubPositions(tie, (id) => ({ zoe: "Zoe", bea: "Bea" })[id] ?? id).find((l) => l.code === "POR")!.owner).toEqual({ id: "bea", minutes: 25 });
    expect(clubPositions(tie, (id) => ({ zoe: "Abel", bea: "Bea" })[id] ?? id).find((l) => l.code === "POR")!.owner).toEqual({ id: "zoe", minutes: 25 });
  });
});

describe("systemRecord", () => {
  const led = { ana: row(50) };
  const sys = [
    match(1, led, { system: "2-3-1", goalsFor: 2, goalsAgainst: 1 }),
    match(2, led, { system: "2-3-1", goalsFor: 1, goalsAgainst: 1 }),
    match(3, led, { system: "libre", goalsFor: 0, goalsAgainst: 2 }),
    match(4, led, { system: "3-3", goalsFor: 3, goalsAgainst: 0 }),
    match(5, led, { goalsFor: 4, goalsAgainst: 0 }),
    match(6, led, { system: null }),
    match(7, led, { system: "2-3-1", status: "scheduled" }),
    match(8, undefined, { system: "2-3-1" }),
  ];
  it("counts W/D/L, goals and points 3/1/0 per system, played desc then ppg desc", () => {
    const r = systemRecord(sys);
    expect(r.lines.map((l) => l.id)).toEqual(["2-3-1", "3-3", "libre"]);
    expect(r.lines[0]).toEqual({ id: "2-3-1", label: systemDef("2-3-1").label, name: systemDef("2-3-1").name, played: 2, won: 1, drawn: 1, lost: 0, gf: 3, ga: 2, points: 4, ppg: 2 });
    expect(r.lines[1]).toMatchObject({ played: 1, won: 1, points: 3, ppg: 3, name: systemDef("3-3").name });
    expect(r.lines[2]).toEqual({ id: "libre", label: "Libre", name: "Sin sistema fijo", played: 1, won: 0, drawn: 0, lost: 1, gf: 0, ga: 2, points: 0, ppg: 0 });
  });
  it("says how many finished matches had no official board", () => {
    expect(systemRecord(sys).withoutBoard).toBe(2);
    expect(systemRecord([])).toEqual({ lines: [], withoutBoard: 0 });
  });
});
