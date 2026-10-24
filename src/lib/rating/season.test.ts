import { describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../clubData";
import type { Standings } from "../standings";
import { PLUS_MINUS_ACTIVE } from "./constants";
import { notesMean, seasonRatings, type MatchNote } from "./season";

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

describe("a match's nota", () => {
  it("is his value per 50′ against the reference, in the season's spread, with 10′ of the reference as a cushion", () => {
    // a scores in 10′, b, c and d play 50′ with nothing: a is measured against 0 (the others), they against a's 5 per 50′ / 3
    const m = match({ a: row(10, { goals: 1 }), b: row(50), c: row(50), d: row(50) });
    const r = seasonRatings([m]);
    const devA = (1 * 50) / 20; // the cushion halves a 10′ goal: 2,5 per 50′, not 5
    const mu = 5 / 3;
    const devB = (((mu * 10) / 50) * 50) / 60 - mu;
    const sd = Math.sqrt((devA ** 2 + 3 * devB ** 2) / 4);
    expect(r.noteOf(m.id, "a")!.nota).toBeCloseTo(6.5 + devA / sd, 10);
    expect(r.noteOf(m.id, "b")!.nota).toBeCloseTo(6.5 + devB / sd, 10);
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
  it("compares each player with his own line (the others in it, his matches left out)", () => {
    // two defenders who do nothing and two forwards who score every match
    const lines = (def: boolean) => (def ? { positionsPlayed: { DFC: 50 } } : {});
    const season = (placed: boolean) => {
      const games = Array.from({ length: 3 }, () => match({ d1: row(50, lines(placed)), d2: row(50, lines(placed)), f1: row(50, { goals: 1, positionsPlayed: { DC: 50 } }), f2: row(50, { goals: 1, positionsPlayed: { DC: 50 } }) }));
      return seasonRatings(games).players.get("d1")!.exact!;
    };
    // placed in defence, he is measured against defenders, not against the forwards' goals
    expect(season(true)).toBeGreaterThan(season(false));
    // a lone scorer is measured against the others, never against himself
    const lone = seasonRatings([match({ f: row(50, { goals: 1, positionsPlayed: { DC: 50 } }), d: row(50, { positionsPlayed: { DFC: 50 } }) })]);
    expect(lone.players.get("f")!.notes[0].nota).toBeGreaterThan(6.5);
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
