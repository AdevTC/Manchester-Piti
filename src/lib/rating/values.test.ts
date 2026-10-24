import { describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../clubData";
import { matchValue } from "./values";

// One match's values, rule by rule (docs/medias.md): each action of ours in goals, from the narration and the acta.

const row = (minutes: number, extra: Partial<Participation> = {}): Participation => ({ ...emptyParticipation(), played: true, minutes, ...extra });
let n = 0;
/** An action of ours, by «a» unless said otherwise, in narration order. */
const o = (kind: Observation["kind"], facts: Observation["facts"] = {}, extra: Partial<Observation> = {}): Observation => ({ id: `o${++n}`, kind, team: "us", actorId: "a", order: n, validity: "valid", facts, ...extra });
/** An action of the rival's. */
const them = (kind: Observation["kind"], facts: Observation["facts"] = {}, extra: Partial<Observation> = {}): Observation => {
  const x = o(kind, facts, { team: "opponent", ...extra });
  delete x.actorId;
  return x;
};
const ours = (count: number, facts: Observation["facts"] = { outcome: "complete" }, by = "b") => Array.from({ length: count }, () => o("pass", facts, { actorId: by }));
const theirs = (count: number) => Array.from({ length: count }, () => them("pass", { outcome: "complete" }));
const match = (observations: Observation[], ledger: Record<string, Participation> = { a: row(50), b: row(50) }, extra: Partial<ClubMatch> = {}): ClubMatch => ({
  id: `m${++n}`,
  seasonId: "s",
  status: "finished",
  date: n,
  duration: 50,
  goalsFor: 0,
  goalsAgainst: 0,
  events: [],
  ledger,
  analysis: { version: 2, revision: 1, profile: DEFAULT_ANALYSIS_PROFILE, observations, coverage: [{ family: "*", team: "us", state: "complete" }, { family: "*", team: "opponent", state: "complete" }] },
  ...extra,
});
const of = (m: ClubMatch, id = "a") => matchValue(m).players.get(id)!;
const item = (m: ClubMatch, label: string, id = "a") => of(m, id).items.find((i) => i.label === label);

describe("penalties: what they change (option A)", () => {
  it("a penalty committed costs the penalty's chance minus the danger that was already there", () => {
    // the rival's last play reached our area: 0,70 − 0,12
    const inArea = match([them("pass", { outcome: "complete", destinationZone: "opponent_area" }), o("discipline", { subtype: "penalty_committed" })], { a: row(50, { penaltyCommitted: 1 }) });
    expect(item(inArea, "Penalti cometido")!.value).toBeCloseTo(-(0.7 - 0.12));
    // from the middle third it changed far more: 0,70 − 0,02
    const far = match([them("dribble", { outcome: "complete", zone: "middle_third" }), o("discipline", { subtype: "penalty_committed" })], { a: row(50, { penaltyCommitted: 1 }) });
    expect(item(far, "Penalti cometido")!.value).toBeCloseTo(-(0.7 - 0.02));
    // without a narration, as in our area
    expect(item(match([], { a: row(50, { penaltyCommitted: 1 }) }), "Penalti cometido")!.value).toBeCloseTo(-0.58);
  });
  it("the acta's penalties: scored +0,30 over its chance, received +0,58, missed −0,70, saved +0,70 (a narrated penalty adds nothing)", () => {
    const m = match([o("shot", { penalty: true, outcome: "goal", goal: true })], { a: row(50, { goals: 1, goalPenalty: 1, penaltyReceived: 1 }), b: row(50, { penaltyMissed: 1 }), k: row(50, { penaltySaved: 1 }) });
    expect(item(m, "Gol de penalti")!.value).toBeCloseTo(0.3);
    expect(item(m, "Gol")).toBeUndefined();
    expect(item(m, "Penalti provocado")!.value).toBeCloseTo(0.58);
    expect(item(m, "Penalti fallado", "b")!.value).toBeCloseTo(-0.7);
    expect(item(m, "Penalti parado", "k")!.value).toBeCloseTo(0.7);
    expect(of(m).items.map((i) => i.label).sort()).toEqual(["Gol de penalti", "Penalti provocado"]);
  });
});

describe("the same ball once", () => {
  it("a loss after his own failed action is that action", () => {
    const m = match([o("dribble", { outcome: "failed" }), o("loss")]);
    expect(item(m, "Regate fallado")!.value).toBeCloseTo(-0.015);
    expect(item(m, "Pérdida")).toBeUndefined();
    expect(item(match([o("loss")]), "Pérdida")!.value).toBeCloseTo(-0.03);
  });
  it("a recovery right after his own interception is the same ball", () => {
    const m = match([o("interception"), o("recovery")]);
    expect(item(m, "Intercepción")!.value).toBeCloseTo(0.04);
    expect(item(m, "Recuperación")).toBeUndefined();
  });
  it("a failed pass the receiver then miscontrols: half the blame each", () => {
    const m = match([o("pass", { outcome: "failed" }, { receiverId: "b" }), o("control", { outcome: "failed" }, { actorId: "b" })]);
    expect(item(m, "Pase raso fallado")!.value).toBeCloseTo(-0.015);
    expect(item(m, "Control fallado", "b")!.value).toBeCloseTo(-0.015);
  });
});

describe("an error that ends in a goal against", () => {
  const goal = () => them("goal", { goal: true });
  it("costs −0,10 more: our last play failed, the ball still in play, the goal within five of their plays", () => {
    const m = match([o("pass", { outcome: "failed" }), them("pass", { outcome: "complete" }), them("shot", {}), goal()]);
    expect(item(m, "Error que acaba en gol")!.value).toBeCloseTo(-0.1);
  });
  it("not after a restart, a long move of theirs, a good last play of ours or a penalty", () => {
    expect(item(match([o("pass", { outcome: "failed" }), them("restart", { subtype: "throw_in" }), them("pass", { outcome: "complete" }), goal()]), "Error que acaba en gol")).toBeUndefined();
    expect(item(match([o("pass", { outcome: "failed" }), ...theirs(6), goal()]), "Error que acaba en gol")).toBeUndefined();
    expect(item(match([o("pass", { outcome: "failed" }), o("pass", { outcome: "complete" }, { actorId: "b" }), them("pass"), goal()]), "Error que acaba en gol")).toBeUndefined();
    expect(item(match([o("pass", { outcome: "failed" }), them("goal", { goal: true, penalty: true })]), "Error que acaba en gol")).toBeUndefined();
  });
});

describe("passing", () => {
  it("a pass is worth what the team's own passes of its kind make of it", () => {
    // ground passes: 9 of 10 made; high ones: 2 of 5 (each with a prior of 10 passes at 70 %)
    const m = match([...ours(9), o("pass", { outcome: "failed" }), ...ours(2, { outcome: "complete", height: "high" }), ...Array.from({ length: 3 }, () => o("pass", { outcome: "failed", height: "high" }))]);
    const ground = (9 + 7) / 20, high = (2 + 7) / 15;
    expect(item(m, "Pase raso bueno", "b")!.value).toBeCloseTo(9 * 0.004);
    expect(item(m, "Pase raso fallado")!.value).toBeCloseTo(-0.03);
    // the hard kind: more for a good one, less for a bad one
    expect(item(m, "Pase alto bueno", "b")!.value).toBeCloseTo(2 * 0.004 * ((1 - high) / (1 - ground)));
    expect(item(m, "Pase alto fallado")!.value).toBeCloseTo(3 * -0.03 * (high / ground));
  });
  it("a key pass is worth the chance it made; the acta's assist adds the goal's credit once", () => {
    const kp = o("pass", { outcome: "complete", keyPass: true });
    const m = match([kp, o("goal", { goal: true }, { actorId: "b", links: { pass: kp.id } })], { a: row(50, { assists: 1 }), b: row(50, { goals: 1 }) });
    expect(item(m, "Pase clave")!.value).toBeCloseTo(0.12);
    expect(item(m, "Asistencia")!.value).toBeCloseTo(0.3);
    expect(item(m, "Gol", "b")).toMatchObject({ n: 1, value: 1 });
    // without a narration the assist carries its key pass
    expect(item(match([], { a: row(50, { assists: 1 }) }), "Asistencia")!.value).toBeCloseTo(0.38);
  });
});

describe("shooting, defending and the keeper", () => {
  it("a shot is worth its chance, a bit more on target; the goals come from the acta, never twice", () => {
    const m = match([o("shot", { onTarget: true }), o("shot", { outsideArea: true }), o("shot", { goal: true, outcome: "goal" })], { a: row(50, { goals: 1 }) });
    expect(item(m, "Remate a puerta")!.value).toBeCloseTo(0.14);
    expect(item(m, "Remate fuera o bloqueado")!.value).toBeCloseTo(0.04);
    expect(item(m, "Gol")).toMatchObject({ n: 1, value: 1 });
  });
  it("an own-area recovery counts double; defending more because they had the ball is not defending better", () => {
    // they made 30 passes to our 10: × 0,5 / 0,75, never under 0,7
    const m = match([...theirs(30), ...ours(10), o("recovery", { zone: "own_area" }), o("recovery", { zone: "middle_third" })]);
    expect(item(m, "Recuperación")).toMatchObject({ n: 2, value: expect.closeTo(0.7 * 0.03 * 3, 6) });
  });
  it("a block is worth the shot it stopped; a clearance, where the ball goes", () => {
    const m = match([them("shot", { bodyPart: "head" }), o("block"), o("clearance", { firstControl: "opponent" }, { actorId: "b" })]);
    expect(item(m, "Remate bloqueado")!.value).toBeCloseTo(0.08);
    expect(item(m, "Despeje", "b")!.value).toBeCloseTo(0.005);
    expect(item(match([o("clearance", { firstControl: "us" })]), "Despeje")!.value).toBeCloseTo(0.04);
  });
  it("the keeper: goals prevented against the shots on target he faced, with proof he was in goal and the goals tallying", () => {
    const shots = () => [them("shot", { onTarget: true }), them("shot", { onTarget: true }), them("goal", { goal: true })];
    const keeper = { k: row(50, { positionsPlayed: { POR: 50 } }), a: row(50) };
    // three in the area at 0,5 each − 1 conceded
    expect(item(match(shots(), keeper, { goalsAgainst: 1 }), "Goles evitados", "k")).toMatchObject({ n: 3, value: expect.closeTo(0.5, 6) });
    // the acta says two against, the narration tells one: no credit
    expect(item(match(shots(), keeper, { goalsAgainst: 2 }), "Goles evitados", "k")).toBeUndefined();
    // an estimated POR is no proof
    expect(item(match(shots(), { k: row(50, { positionsPlayed: { POR: 50 }, positionsEstimated: true }) }, { goalsAgainst: 1 }), "Goles evitados", "k")).toBeUndefined();
  });
});

describe("discipline", () => {
  it("a yellow −0,05, a sending-off −0,30 (a second yellow once, as the sending-off); a tactical foul costs nothing", () => {
    const m = match([o("discipline", { subtype: "foul", tactical: true }), o("discipline", { subtype: "foul" }, { actorId: "b" }), o("discipline", { subtype: "foul_received" })], { a: row(50, { yellowCards: 1 }), b: row(50, { yellowCards: 2, redCards: 1, doubleYellows: 1 }) });
    expect(item(m, "Amarilla")!.value).toBeCloseTo(-0.05);
    expect(item(m, "Falta cometida")).toBeUndefined();
    expect(item(m, "Falta recibida")!.value).toBeCloseTo(0.01);
    expect(item(m, "Expulsión", "b")!.value).toBeCloseTo(-0.3);
    expect(item(m, "Amarilla", "b")).toBeUndefined();
    expect(item(m, "Falta cometida", "b")!.value).toBeCloseTo(-0.01);
  });
});

describe("the match itself", () => {
  it("is narrated from 30 actions of ours; la mesa's chances count only without a narration", () => {
    const mesa = match([o("context", { chance: true })]);
    expect(matchValue(mesa).narrated).toBe(false);
    expect(item(mesa, "Ocasión")!.value).toBeCloseTo(0.08);
    const told = match([o("context", { chance: true }), ...ours(30)]);
    expect(matchValue(told).narrated).toBe(true);
    expect(matchValue(told).volume).toBe(30);
    expect(item(told, "Ocasión")).toBeUndefined();
  });
  it("his minutes are the acta's (its seconds first); unknown minutes give null; guests are not rated", () => {
    const m = match([], { a: row(50, { secondsPlayed: 2950 }), b: { ...row(0), minutes: undefined as unknown as number }, "guest:x": row(50) });
    expect(of(m).minutes).toBeCloseTo(2950 / 60);
    expect(of(m, "b").minutes).toBeNull();
    expect(matchValue(m).players.has("guest:x")).toBe(false);
  });
  it("his lines this match, as shares of the minutes the acta places", () => {
    expect(of(match([], { a: row(50, { positionsPlayed: { DFC: 30, MC: 15, MCD: 5 } }) })).lines).toEqual({ DEF: 0.6, MED: 0.4 });
  });
  it("plus-minus: the xG for and against with him on and off, narrated matches with his stints only", () => {
    const at = (minute: number): Partial<Observation> => ({ time: { from: minute * 60, to: minute * 60, precision: "exact" } });
    const ledger = { a: row(25, { stints: [{ from: 0, to: 25 }] }), b: row(50, { stints: [{ from: 0, to: 50 }] }) };
    const m = match([...ours(30), o("shot", {}, at(10)), them("shot", { bodyPart: "head" }, at(40))], ledger);
    expect(of(m).plusMinus).toEqual({ on: 25, off: 25, forOn: 0.12, againstOn: 0, forOff: 0, againstOff: 0.08 });
    expect(of(match([o("shot", {}, at(10))], ledger)).plusMinus).toBeNull();
  });
});
