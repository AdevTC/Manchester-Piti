import { describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../clubData";
import type { Standings } from "../standings";
import { PLUS_MINUS_ACTIVE } from "./constants";
import { frozenNotas, notesMean, ratedMatch, seasonRatings, teamPart, type MatchNote } from "./season";
import type { PlayerMatchValue } from "./values";

// The season from each match's values (docs/medias.md): the notas, GLOBAL and FOR.

const row = (minutes: number, extra: Partial<Participation> = {}): Participation => ({ ...emptyParticipation(), played: true, minutes, ...extra });
let n = 0;
const match = (ledger: Record<string, Participation>, extra: Partial<ClubMatch> = {}): ClubMatch => ({ id: `m${++n}`, seasonId: "s", rival: "Rival", status: "finished", date: n * 86_400_000, duration: 50, goalsFor: 0, goalsAgainst: 0, events: [], ledger, ...extra });
/** A narrated match: `count` good passes of ours by `by` (and whatever else is given). */
const narrated = (ledger: Record<string, Participation>, count: number, by: string, more: Observation[] = [], extra: Partial<ClubMatch> = {}): ClubMatch => {
  const observations = [...Array.from({ length: count }, (_, i): Observation => ({ id: `p${i}`, kind: "pass", team: "us", actorId: by, order: i, validity: "valid", facts: { outcome: "complete" } })), ...more];
  return match(ledger, { analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: "*", team: "us", state: "complete" }] }, ...extra });
};
const note = (nota: number, weight: number): MatchNote => ({ matchId: "x", date: 0, rival: "R", nota, minutes: 50, weight, narrated: true });

describe("GLOBAL: the notas' mean over a cushion", () => {
  it("is 10 × (Σ weight·nota + 3 · 6,5) / (Σ weight + 3)", () => {
    expect(notesMean([])).toBe(65);
    expect(notesMean([note(8, 1), note(5, 0.5)])).toBeCloseTo((10 * (8 + 2.5 + 19.5)) / 4.5, 10);
    // FOR's cushion is one match
    expect(notesMean([note(8, 1)], 1)).toBeCloseTo(72.5, 10);
  });
  it("a season of normal matches is 65 everywhere", () => {
    const r = seasonRatings([match({ a: row(50), b: row(50) }), match({ a: row(50), b: row(50) })]);
    expect(r.players.get("a")).toMatchObject({ value: 65, form: 65, minutes: 100, played: 2 });
    expect(r.players.get("a")!.notes.map((x) => x.nota)).toEqual([6.5, 6.5]);
  });
  it("FOR is the same over his last five matches, with a cushion of one", () => {
    const games = Array.from({ length: 6 }, (_, i) => match({ a: row(50, { goals: i === 0 ? 1 : 0 }), b: row(50, { goals: i === 5 ? 1 : 0 }), c: row(50) }));
    const r = seasonRatings(games);
    const a = r.players.get("a")!, b = r.players.get("b")!;
    expect(a.form).toBe(Math.round(notesMean(a.notes.slice(-5), 1)));
    expect(a.value).toBe(Math.round(notesMean(a.notes)));
    // scored first and then nothing: in worse form than his season; the late scorer the other way
    expect(a.form!).toBeLessThan(a.value!);
    expect(b.form!).toBeGreaterThan(b.value!);
  });
});

/** Recoveries of ours (the volume of play), by `by`. */
const recoveries = (count: number, by: string, from = 0): Observation[] => Array.from({ length: count }, (_, i) => ({ id: `r${by}${from + i}`, kind: "recovery", team: "us", actorId: by, order: 500 + from + i, validity: "valid", facts: {} }));
/** A narrated match (30 actions worth nothing by someone not in the acta, so it counts as told) with `observations`. */
const told = (ledger: Record<string, Participation>, observations: Observation[], extra: Partial<ClubMatch> = {}): ClubMatch => {
  const filler = Array.from({ length: 30 }, (_, i): Observation => ({ id: `x${i}`, kind: "carry", team: "us", actorId: "x", order: 900 + i, validity: "valid", facts: {} }));
  return match(ledger, { analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, observations: [...observations, ...filler], coverage: [{ family: "*", team: "us", state: "complete" }] }, ...extra });
};

describe("a match's nota", () => {
  it("is his volume of play per 50′ against his position's normal, with 10′ of it as a cushion, over 0,65 goals a point", () => {
    // a makes 5 recoveries (0,15) in 25′; b and c, 50′ with nothing
    const m = told({ a: row(25), b: row(50), c: row(50) }, recoveries(5, "a"));
    const r = seasonRatings([m]);
    // a against b and c (nothing): 0,15 per 35′ cushioned
    expect(r.noteOf(m.id, "a")!.nota).toBeCloseTo(6.5 + (0.15 * 50) / 35 / 0.65, 10);
    // b against a and c: 0,15 in their 75′ is 0,1 per 50′
    const mu = (0.15 * 50) / 75;
    expect(r.noteOf(m.id, "b")!.nota).toBeCloseTo(6.5 + ((((mu * 10) / 50) * 50) / 60 - mu) / 0.65, 10);
    // a match without narration: its few actions as they are, never against the narrated ones nor setting their normal
    const mesa = match({ a: row(50), b: row(50) }, { events: [{ id: "l", type: "possession_lost", playerId: "a", minute: 5 }] });
    const both = seasonRatings([m, mesa]);
    expect(both.noteOf(mesa.id, "b")!.nota).toBe(6.5);
    expect(both.noteOf(mesa.id, "a")!.nota).toBeCloseTo(6.5 + (-0.03 * 50) / 60 / 0.65, 10);
    expect(both.noteOf(m.id, "b")!.nota).toBe(r.noteOf(m.id, "b")!.nota);
  });
  it("counts what happens once whole: a goal is +1 / 0,65 in 10′ or in 50′, and moves nobody else", () => {
    const short = match({ a: row(10, { goals: 1 }), b: row(50), c: row(50) });
    const long = match({ a: row(50, { goals: 1 }), b: row(50), c: row(50) });
    expect(seasonRatings([short]).noteOf(short.id, "a")!.nota).toBeCloseTo(6.5 + 1 / 0.65, 10);
    expect(seasonRatings([long]).noteOf(long.id, "a")!.nota).toBeCloseTo(6.5 + 1 / 0.65, 10);
    expect(seasonRatings([short]).noteOf(short.id, "b")!.nota).toBe(6.5);
  });
  it("needs 10 minutes; unknown minutes give none (counted as played)", () => {
    const m = match({ a: row(9, { goals: 1 }), b: row(50), c: { ...row(0), minutes: undefined as unknown as number } });
    const r = seasonRatings([m]);
    expect(r.noteOf(m.id, "a")).toBeNull();
    expect(r.players.get("a")).toMatchObject({ value: null, played: 1 });
    expect(r.players.get("c")).toMatchObject({ value: null, played: 1, unknownMinutes: 1 });
  });
  it("counts whole from 30′ and in proportion below; a match without narration, half", () => {
    const told = narrated({ a: row(15), b: row(30) }, 30, "b");
    const acta = match({ a: row(15), b: row(30) });
    const r = seasonRatings([told, acta]);
    expect(r.noteOf(told.id, "a")!.weight).toBe(0.5);
    expect(r.noteOf(told.id, "b")!.weight).toBe(1);
    expect(r.noteOf(acta.id, "a")!.weight).toBe(0.25);
    expect(r.noteOf(acta.id, "b")!.weight).toBe(0.5);
  });
  it("compares each player with the others who played his position (a centre-back with centre-backs), his matches left out", () => {
    // two centre-backs who do nothing and two full-backs who win five balls every match
    const season = (code: "DFC" | "LI") => {
      const games = Array.from({ length: 3 }, (_, j) =>
        told({ d1: row(50, { positionsPlayed: { [code]: 50 } }), d2: row(50, { positionsPlayed: { DFC: 50 } }), w1: row(50, { positionsPlayed: { LI: 50 } }), w2: row(50, { positionsPlayed: { LD: 50 } }) }, [...recoveries(5, "w1", 10 * j), ...recoveries(5, "w2", 10 * j)]),
      );
      return seasonRatings(games).players.get("d1")!.exact!;
    };
    // as a centre-back he is measured against centre-backs, not against the full-backs' volume
    expect(season("DFC")).toBeGreaterThan(season("LI"));
  });
  it("the keeper counts as he is: only other keepers set a keeper's normal", () => {
    const keeperNota = (outfield: number) => {
      const m = told({ k: row(50, { positionsPlayed: { POR: 50 } }), a: row(50, { positionsPlayed: { MC: 50 } }) }, [...recoveries(2, "k"), ...recoveries(outfield, "a", 10)]);
      return seasonRatings([m]).noteOf(m.id, "k")!.nota;
    };
    expect(keeperNota(0)).toBeCloseTo(6.5 + (0.06 * 50) / 60 / 0.65, 10);
    expect(keeperNota(8)).toBe(keeperNota(0));
  });
});

describe("his fixed position weighs his actions", () => {
  /** Shots from outside the area by `by` (worth their chance). */
  const shots = (count: number, by: string, from = 0): Observation[] => Array.from({ length: count }, (_, i) => ({ id: `s${by}${from + i}`, kind: "shot", team: "us", actorId: by, order: 700 + from + i, validity: "valid", facts: { outsideArea: true } }));
  /** A told match where the centre-back wins ten balls and the striker shoots ten times. */
  const game = (j: number) => told({ d: row(50, { positionsPlayed: { DFC: 50 } }), f: row(50, { positionsPlayed: { DC: 50 } }) }, [...recoveries(10, "d", 10 * j), ...shots(10, "f", 10 * j)], { starters: ["d", "f"] });
  it("each family by what his position usually does: its rate over the team's, pulled to it with 200′, between ×2/3 and ×1,5", () => {
    const games = [game(0), game(1), game(2)];
    // the team: 5 of each per 50′; the centre-back's tackling (30 + 200′ of the team's) / (150′ + 200′), his shooting none
    const { weights } = ratedMatch(games[2], games);
    expect(weights.get("d")).toEqual({ ataque: expect.closeTo(2 / 3, 10), pase: 1, defensa: expect.closeTo(10 / 7, 10), goal: 1.5 });
    expect(weights.get("f")).toEqual({ ataque: expect.closeTo(10 / 7, 10), pase: 1, defensa: expect.closeTo(2 / 3, 10), goal: 1 });
    // a longer season moves it further, up to ×1,5
    const ten = Array.from({ length: 10 }, (_, j) => game(j));
    expect(ratedMatch(ten[9], ten).weights.get("d")!.defensa).toBe(1.5);
  });
  it("the acta's ficha gets the weights his nota used: his fixed position's, or the mix of his positions by minutes", () => {
    const games = [game(0), game(1), game(2)];
    // one the acta cannot place at the start: half his minutes at centre-back, half up front
    const mixed = told({ d: row(50, { positionsPlayed: { DFC: 50 } }), f: row(50, { positionsPlayed: { DC: 50 } }), x: row(50, { positionsPlayed: { DFC: 25, DC: 25 } }) }, [], {});
    const all = [...games, mixed];
    const { weights } = ratedMatch(mixed, all);
    const d = weights.get("d")!, f = weights.get("f")!;
    expect(weights.get("x")).toEqual({ ataque: expect.closeTo((d.ataque + f.ataque) / 2, 10), pase: 1, defensa: expect.closeTo((d.defensa + f.defensa) / 2, 10), goal: 1.25 });
  });
  it("a goal weighs by the position he started in, in the Fantasy's proportions (keeper ×2,5, defender ×1,5, midfielder ×1,25, forward ×1)", () => {
    // d started at centre-back and played more at striker after a swap; f the other way round
    const m = match({ d: row(50, { goals: 1, positionsPlayed: { DFC: 20, DC: 30 } }), f: row(50, { goals: 1, positionsPlayed: { DC: 20, DFC: 30 } }) }, { starters: ["d", "f"], goalsFor: 2, events: [{ id: "s", type: "position_swap", playerId: "d", inPlayerId: "f", minute: 20 }] });
    const r = seasonRatings([m]);
    // a normal match is 1 goal a side per 50′: each had the other's goal for and none against (weighed by his line)
    expect(r.noteOf(m.id, "d")!.nota).toBeCloseTo(6.5 + 1.5 / 0.65 + 0.15, 10);
    expect(r.noteOf(m.id, "f")!.nota).toBeCloseTo(6.5 + 1 / 0.65 + 0.05, 10);
  });
});

describe("the team while he was on the pitch", () => {
  it("the goals against weigh on the back, the goals for on the front, against a normal match of the season", () => {
    // 0–0 and then 0–4: a normal match has 1 goal a side per 50′
    const j1 = match({ d: row(50, { positionsPlayed: { DFC: 50 } }), f: row(50, { positionsPlayed: { DC: 50 } }) });
    const j2 = match({ d: row(50, { positionsPlayed: { DFC: 50 } }), f: row(50, { positionsPlayed: { DC: 50 } }) }, { goalsAgainst: 4 });
    const r = seasonRatings([j1, j2]);
    expect(r.noteOf(j2.id, "d")!.nota).toBeCloseTo(6.5 - 0.15 * (4 - 1) + 0.05 * (0 - 1), 10);
    expect(r.noteOf(j2.id, "f")!.nota).toBeCloseTo(6.5 - 0.05 * (4 - 1) + 0.15 * (0 - 1), 10);
    // the first match was rated with itself (a 0–0 is a normal match then)
    expect(r.noteOf(j1.id, "d")!.nota).toBe(6.5);
  });
  it("a short stint is pulled toward the whole match's (25′ of it); the acta's unplaced player weighs as a midfielder", () => {
    const pv = (lines: PlayerMatchValue["lines"]) => ({ lines, team: { on: 10, for: 0, against: 2, matchFor: 0, matchAgainst: 4 } }) as PlayerMatchValue;
    const ga = ((2 + (25 * 4) / 50) * 10) / 35;
    expect(teamPart(pv({ DEF: 1 }), { for: 1, against: 1 }, 50).value).toBeCloseTo(-0.15 * (ga - 0.2) + 0.05 * (0 - 0.2), 10);
    expect(teamPart(pv({}), { for: 1, against: 1 }, 50).value).toBeCloseTo(teamPart(pv({ MED: 1 }), { for: 1, against: 1 }, 50).value, 10);
    expect(teamPart(pv({ POR: 1 }), { for: 1, against: 1 }, 50).value).toBeCloseTo(-0.05 * (ga - 0.2), 10);
    // a hat-trick is not his again through the cushion: the whole match without his goals
    const scorer = { lines: { DEL: 1 }, team: { on: 50, for: 0, against: 0, matchFor: 0, matchAgainst: 0 } } as PlayerMatchValue;
    expect(teamPart(scorer, { for: 1, against: 1 }, 50)).toMatchObject({ for: 0, against: 0 });
  });
  it("a table with goals sets the normal match against that rival, and the acta stores it", () => {
    const rows = ([["Goleadores", 30, 6], ["Seguros", 6, 30], ["Otros", 18, 18]] as const).map(([team, gf, gc]) => ({ team, pj: 6, g: 0, e: 0, p: 0, gf, gc, pts: 9, isUs: false }));
    const table: Standings = { id: "s", competition: "Liga", jornada: 1, updatedAt: 0, updatedBy: "", rows: [...rows, { team: "Piti", pj: 1, g: 0, e: 0, p: 1, gf: 0, gc: 4, pts: 0, isUs: true }] };
    const ledger = () => ({ d: row(50, { positionsPlayed: { DFC: 50 } }), f: row(50, { positionsPlayed: { DC: 50 } }) });
    const vsScorers = match(ledger(), { rival: "Goleadores", goalsAgainst: 4 });
    const frozen = frozenNotas(vsScorers, [vsScorers], [table]);
    // they score (30 + 2 · 3) / 8 = 4,5 a match and concede (6 + 2 · 3) / 8 = 1,5
    expect(frozen.normal).toEqual({ against: 4.5, for: 1.5 });
    expect(frozen.players.d.nota).toBeCloseTo(6.5 - 0.15 * (4 - 4.5) + 0.05 * (0 - 1.5), 10);
    // a correction keeps it, and the acta's ficha explains the same
    expect(frozenNotas(vsScorers, [vsScorers], [table], null, { for: 1, against: 1 }).normal).toEqual({ for: 1, against: 1 });
    expect(ratedMatch(vsScorers, [vsScorers], [table]).team.get("d")).toMatchObject({ normalAgainst: 4.5, normalFor: 1.5 });
  });
});

describe("adjustments", () => {
  it("a match told in less detail counts its narrated actions more (the season's median volume)", () => {
    const rec = (id: string): Observation => ({ id, kind: "recovery", team: "us", actorId: "a", order: 999, validity: "valid", facts: {} });
    const detailed = narrated({ a: row(50), b: row(50) }, 60, "b", [rec("r1")]);
    const brief = narrated({ a: row(50), b: row(50) }, 30, "b", [rec("r2")]);
    const r = seasonRatings([detailed, brief]);
    expect(r.noteOf(brief.id, "a")!.nota).toBeGreaterThan(r.noteOf(detailed.id, "a")!.nota);
  });
  it("the rival: against a strong one the good counts more and the bad less", () => {
    const rows = ([["Fuertes", 18], ["Medios", 9], ["Flojos", 0]] as const).map(([team, pts]) => ({ team, pj: 6, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts, isUs: false }));
    const table: Standings = { id: "s", competition: "Liga", jornada: 2, updatedAt: 0, updatedBy: "", rows };
    const ledger = () => ({ a: row(50, { goals: 1 }), b: row(50, { yellowCards: 1 }), c: row(50) });
    const strong = match(ledger(), { rival: "Fuertes" }), weak = match(ledger(), { rival: "Flojos" });
    const r = seasonRatings([strong, weak], [table]);
    expect(r.noteOf(strong.id, "a")!.nota).toBeGreaterThan(r.noteOf(weak.id, "a")!.nota);
    expect(r.noteOf(strong.id, "b")!.nota).toBeGreaterThan(r.noteOf(weak.id, "b")!.nota);
    // without a table, both matches are alike
    const flat = seasonRatings([strong, weak]);
    expect(flat.noteOf(strong.id, "a")!.nota).toBeCloseTo(flat.noteOf(weak.id, "a")!.nota, 10);
  });
  it("plus-minus is measured but does not count yet", () => {
    expect(PLUS_MINUS_ACTIVE).toBe(false);
    const shot = (id: string, team: "us" | "opponent", minute: number): Observation => ({ id, kind: "shot", team, actorId: team === "us" ? "b" : undefined, order: 900 + minute, validity: "valid", time: { from: minute * 60, to: minute * 60, precision: "exact" }, facts: {} });
    const m = narrated({ a: row(25, { stints: [{ from: 0, to: 25 }] }), b: row(50, { stints: [{ from: 0, to: 50 }] }) }, 30, "b", [shot("s1", "us", 10), shot("s2", "opponent", 40)]);
    const a = seasonRatings([m]).players.get("a")!;
    expect(a.plusMinus).not.toBeNull();
    expect(a.value).toBe(Math.round(notesMean(a.notes)));
  });
});

describe("the period", () => {
  it("over several seasons: no GLOBAL nor FOR, the notas stay (for the positions)", () => {
    const one = match({ a: row(50), b: row(50) }), other = match({ a: row(50), b: row(50) }, { seasonId: "s2" });
    const r = seasonRatings([one, other]);
    expect(r.multipleSeasons).toBe(true);
    expect(r.players.get("a")).toMatchObject({ value: null, form: null });
    expect(r.noteOf(other.id, "a")).not.toBeNull();
  });
  it("the same matches and tables give the same numbers object (computed once for every player)", () => {
    const games = [match({ a: row(50) })];
    expect(seasonRatings(games)).toBe(seasonRatings(games));
    expect(seasonRatings(games, [])).not.toBe(seasonRatings(games));
  });
});
