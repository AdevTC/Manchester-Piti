import { describe, expect, it } from "vitest";
import { emptyParticipation, type Participation } from "../../../functions/src/matchEngine";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import type { ClubMatch } from "../clubData";
import { matchValue, xgFactor } from "./values";

// One match's values, rule by rule (docs/medias.md): each action of ours in goals, from the narration and the acta,
// and the team while each one was on the pitch.

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
const at = (minute: number): Partial<Observation> => ({ time: { from: minute * 60, to: minute * 60, precision: "exact" } });
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
const of = (m: ClubMatch, id = "a", xg = 1) => matchValue(m, xg).players.get(id)!;
const item = (m: ClubMatch, label: string, id = "a", xg = 1) => of(m, id, xg).items.find((i) => i.label === label);
/** The passes' prior: ten at 70 %. */
const prior = (made: number, all: number) => (made + 7) / (all + 10);

describe("penalties: what they change (option A, at 0,78)", () => {
  it("a penalty committed costs the penalty's chance minus the danger that was already there", () => {
    // the rival's last play reached our area: 0,78 − 0,12
    const inArea = match([them("pass", { outcome: "complete", destinationZone: "opponent_area" }), o("discipline", { subtype: "penalty_committed" })], { a: row(50, { penaltyCommitted: 1 }) });
    expect(item(inArea, "Penalti cometido")!.value).toBeCloseTo(-(0.78 - 0.12));
    // that danger is a chance: at the season's F7 calibration
    expect(item(inArea, "Penalti cometido", "a", 1.31)!.value).toBeCloseTo(-(0.78 - 0.12 * 1.31));
    // from the middle third it changed far more: 0,78 − 0,02
    const far = match([them("dribble", { outcome: "complete", zone: "middle_third" }), o("discipline", { subtype: "penalty_committed" })], { a: row(50, { penaltyCommitted: 1 }) });
    expect(item(far, "Penalti cometido")!.value).toBeCloseTo(-(0.78 - 0.02));
    // without a narration, as in our area
    expect(item(match([], { a: row(50, { penaltyCommitted: 1 }) }), "Penalti cometido")!.value).toBeCloseTo(-0.66);
  });
  it("the acta's penalties: scored +0,22 over its chance, received +0,66, missed −0,78, saved +0,78 (a narrated penalty adds nothing)", () => {
    const m = match([o("shot", { penalty: true, outcome: "goal", goal: true })], { a: row(50, { goals: 1, goalPenalty: 1, penaltyReceived: 1 }), b: row(50, { penaltyMissed: 1 }), k: row(50, { penaltySaved: 1 }) });
    expect(item(m, "Gol de penalti")!.value).toBeCloseTo(0.22);
    expect(item(m, "Gol")).toBeUndefined();
    expect(item(m, "Penalti provocado")!.value).toBeCloseTo(0.66);
    expect(item(m, "Penalti fallado", "b")!.value).toBeCloseTo(-0.78);
    expect(item(m, "Penalti parado", "k")!.value).toBeCloseTo(0.78);
    expect(of(m).items.map((i) => i.label).sort()).toEqual(["Gol de penalti", "Penalti provocado"]);
  });
});

describe("the same ball once", () => {
  it("a loss after his own failed action is that action (a failed dribble loses the ball: −0,03)", () => {
    const m = match([o("dribble", { outcome: "failed" }), o("loss")]);
    expect(item(m, "Regate fallado")!.value).toBeCloseTo(-0.03);
    expect(item(m, "Pérdida")).toBeUndefined();
    expect(item(match([o("loss")]), "Pérdida")!.value).toBeCloseTo(-0.03);
  });
  it("a recovery right after his own interception is the same ball", () => {
    const m = match([o("interception"), o("recovery")]);
    expect(item(m, "Intercepción")!.value).toBeCloseTo(0.04);
    expect(item(m, "Recuperación")).toBeUndefined();
  });
  it("a failed pass, or a keeper's distribution, the receiver then miscontrols: half the blame each", () => {
    const m = match([o("pass", { outcome: "failed" }, { receiverId: "b" }), o("control", { outcome: "failed" }, { actorId: "b" })]);
    expect(item(m, "Pase raso fallado")!.value).toBeCloseTo(-0.034 * prior(0, 1) * 0.5);
    expect(item(m, "Control fallado", "b")!.value).toBeCloseTo(-0.032 * prior(0, 1) * 0.5);
    const kick = match([o("keeper", { subtype: "distribution", outcome: "failed" }, { actorId: "k" }), o("control", { outcome: "failed" }, { actorId: "b" })], { k: row(50), b: row(50) });
    expect(item(kick, "Saque del portero fallado", "k")!.value).toBeCloseTo(-0.03 * 0.5);
    expect(item(kick, "Control fallado", "b")!.value).toBeCloseTo(-0.032 * prior(0, 1) * 0.5);
  });
});

describe("an error that ends in a goal against", () => {
  const goal = (facts: Observation["facts"] = {}) => them("goal", { goal: true, ...facts });
  it("costs −0,10 and the chance it gave away: our last play a mistake with the ball, the goal straight after it", () => {
    const m = match([o("pass", { outcome: "failed" }), them("pass", { outcome: "complete" }), goal()]);
    expect(item(m, "Error que acaba en gol")!.value).toBeCloseTo(-0.1);
    expect(item(m, "Error que acaba en gol: la ocasión que regala")!.value).toBeCloseTo(-0.12);
    expect(item(m, "Error que acaba en gol: la ocasión que regala", "a", 1.31)!.value).toBeCloseTo(-0.12 * 1.31);
    // a loss, a keeper's spill or what the narration calls an error are mistakes too
    expect(item(match([o("loss"), goal({ outsideArea: true })]), "Error que acaba en gol: la ocasión que regala")!.value).toBeCloseTo(-0.04);
    expect(item(match([o("judgement", { subtype: "error" }), goal()]), "Error que acaba en gol")).toBeDefined();
  });
  it("not when he was dribbled past, a cover, after a restart, three rival passes, a good last play of ours or a penalty", () => {
    const none = (obs: Observation[]) => expect(item(match(obs), "Error que acaba en gol")).toBeUndefined();
    none([o("duel", { beaten: true }), them("dribble", { outcome: "complete" }), goal()]);
    none([o("judgement", { subtype: "defensive_cover" }), goal()]);
    none([o("pass", { outcome: "failed" }), them("restart", { subtype: "throw_in" }), them("pass", { outcome: "complete" }), goal()]);
    none([o("pass", { outcome: "failed" }), ...theirs(3), goal()]);
    none([o("pass", { outcome: "failed" }), o("pass", { outcome: "complete" }, { actorId: "b" }), them("pass"), goal()]);
    none([o("pass", { outcome: "failed" }), them("goal", { goal: true, penalty: true })]);
    // la mesa notes their goals, not the plays before them: no window to judge
    const mesa = match([], { a: row(50), b: row(50) }, { goalsAgainst: 1, events: [{ id: "l", type: "possession_lost", playerId: "a", minute: 12 }, { id: "g", type: "opponent_goal", minute: 30 }] });
    expect(item(mesa, "Error que acaba en gol")).toBeUndefined();
  });
  it("what the narration calls an error that ends in a rival shot costs that chance (Opta's error leading to a shot)", () => {
    const m = match([o("judgement", { subtype: "error" }), them("shot", { onTarget: true, bodyPart: "head" })]);
    expect(item(m, "Error que acaba en remate: la ocasión que regala")!.value).toBeCloseTo(-0.08);
    // a plain loss before a shot is only the loss (it already costs its average)
    expect(item(match([o("loss"), them("shot", {})]), "Error que acaba en remate: la ocasión que regala")).toBeUndefined();
  });
});

describe("passing", () => {
  it("a pass is measured against the team's own passes of its kind: the average one is worth nothing", () => {
    // ground passes: 9 of 10 made; high ones: 2 of 5 (each with a prior of 10 passes at 70 %)
    const m = match([...ours(9), o("pass", { outcome: "failed" }), ...ours(2, { outcome: "complete", height: "high" }), ...Array.from({ length: 3 }, () => o("pass", { outcome: "failed", height: "high" }))]);
    const ground = prior(9, 10), high = prior(2, 5);
    expect(item(m, "Pase raso bueno", "b")!.value).toBeCloseTo(9 * 0.034 * (1 - ground));
    expect(item(m, "Pase raso fallado")!.value).toBeCloseTo(-0.034 * ground);
    // the hard kind: more for a good one, less for a bad one
    expect(item(m, "Pase alto bueno", "b")!.value).toBeCloseTo(2 * 0.034 * (1 - high));
    expect(item(m, "Pase alto fallado")!.value).toBeCloseTo(3 * -0.034 * high);
    // a pass back, against the team's passes back (here, 1 of 2)
    const back = match([o("pass", { outcome: "complete", direction: "backward" }, { actorId: "b" }), o("pass", { outcome: "failed", direction: "backward" })]);
    expect(item(back, "Pase atrás", "b")!.value).toBeCloseTo(0.034 * (1 - prior(1, 2)));
    expect(item(back, "Pase atrás fallado")!.value).toBeCloseTo(-0.034 * prior(1, 2));
    // a team that makes 7 of 10 (its prior): seven made and three lost add up to nothing
    const avg = match([...ours(7), ...Array.from({ length: 3 }, () => o("pass", { outcome: "failed" }, { actorId: "b" }))]);
    expect(item(avg, "Pase raso bueno", "b")!.value + item(avg, "Pase raso fallado", "b")!.value).toBeCloseTo(0, 10);
  });
  it("a reception against the team's: received + 0,032 × (1 − its share), miscontrolled − 0,032 × it", () => {
    const m = match([...ours(4, { outcome: "complete" }, "b").map((x) => ({ ...x, receiverId: "a" })), o("control", { outcome: "failed" })]);
    const share = prior(4, 5);
    expect(item(m, "Pase recibido")).toMatchObject({ n: 4, value: expect.closeTo(4 * 0.032 * (1 - share), 6) });
    expect(item(m, "Control fallado")!.value).toBeCloseTo(-0.032 * share);
  });
  it("a key pass is worth the chance it made; the acta's assist adds the goal's credit once", () => {
    const kp = o("pass", { outcome: "complete", keyPass: true });
    const m = match([kp, o("goal", { goal: true }, { actorId: "b", links: { pass: kp.id } })], { a: row(50, { assists: 1 }), b: row(50, { goals: 1 }) });
    expect(item(m, "Pase clave")!.value).toBeCloseTo(0.12);
    expect(item(m, "Pase clave", "a", 1.31)!.value).toBeCloseTo(0.12 * 1.31);
    expect(item(m, "Asistencia")!.value).toBeCloseTo(0.3);
    expect(item(m, "Gol", "b")).toMatchObject({ n: 1, value: 1 });
    // without a narration the assist carries its key pass
    expect(item(match([], { a: row(50, { assists: 1 }) }), "Asistencia")!.value).toBeCloseTo(0.38);
  });
  it("the chance is its maker's: the key pass's, unless the shooter dribbles or carries after it", () => {
    const kp = o("pass", { outcome: "complete", keyPass: true });
    const m = match([kp, o("shot", { onTarget: true }, { actorId: "b", links: { pass: kp.id } })]);
    expect(item(m, "Pase clave")!.value).toBeCloseTo(0.12);
    // (the shooter keeps the aim)
    expect(item(m, "Remate a puerta", "b")!.value).toBeCloseTo(0.02);
    const kp2 = o("pass", { outcome: "complete", keyPass: true });
    const made = match([kp2, o("dribble", { outcome: "complete" }, { actorId: "b" }), o("shot", { onTarget: true }, { actorId: "b", links: { pass: kp2.id } })]);
    expect(item(made, "Pase clave")).toBeUndefined();
    expect(item(made, "Pase clave que el rematador se fabrica")!.value).toBeCloseTo(0.05);
    expect(item(made, "Remate a puerta", "b")!.value).toBeCloseTo(0.14);
  });
  it("a pass into the area is worth a cross (only when the narration marks it)", () => {
    expect(item(match([o("pass", { outcome: "complete", entersArea: true })]), "Pase al área")!.value).toBeCloseTo(0.05);
  });
});

describe("shooting, defending and the keeper", () => {
  it("a shot is worth its chance (at the F7 calibration), a bit more on target; the goals come from the acta, never twice", () => {
    const m = match([o("shot", { onTarget: true }), o("shot", { outsideArea: true }), o("shot", { goal: true, outcome: "goal" })], { a: row(50, { goals: 1 }) });
    expect(item(m, "Remate a puerta")!.value).toBeCloseTo(0.14);
    expect(item(m, "Remate a puerta", "a", 1.31)!.value).toBeCloseTo(0.12 * 1.31 + 0.02);
    expect(item(m, "Remate fuera o bloqueado")!.value).toBeCloseTo(0.04);
    expect(item(m, "Gol")).toMatchObject({ n: 1, value: 1 });
  });
  it("an own-area recovery counts double; having less of the ball changes nothing", () => {
    const m = match([...theirs(30), ...ours(10), o("recovery", { zone: "own_area" }), o("recovery", { zone: "middle_third" })]);
    expect(item(m, "Recuperación")).toMatchObject({ n: 2, value: expect.closeTo(0.03 * 3, 6) });
  });
  it("a tackle or an interception that cuts the ball without keeping it is worth half", () => {
    const m = match([o("tackle", { outcome: "neutral" }), o("interception", { outcome: "neutral" }, { actorId: "b" })]);
    expect(item(m, "Entrada neutra")!.value).toBeCloseTo(0.02);
    expect(item(m, "Intercepción", "b")!.value).toBeCloseTo(0.02);
  });
  it("a block is worth the shot it stopped; a clearance, where the ball goes", () => {
    const m = match([them("shot", { bodyPart: "head" }), o("block"), o("clearance", { firstControl: "opponent" }, { actorId: "b" })]);
    expect(item(m, "Remate bloqueado")!.value).toBeCloseTo(0.08);
    expect(item(m, "Despeje", "b")!.value).toBeCloseTo(0.005);
    expect(item(match([o("clearance", { firstControl: "us" })]), "Despeje")!.value).toBeCloseTo(0.04);
  });
  it("one rival move, one danger: two blocks of it share 1 − (1 − c)² instead of adding up", () => {
    const m = match([them("shot", {}), o("block"), them("shot", {}), o("block", {}, { actorId: "b" })]);
    const each = (1 - (1 - 0.12) ** 2) / 2;
    expect(item(m, "Remate bloqueado")!.value).toBeCloseTo(each);
    expect(item(m, "Remate bloqueado", "b")!.value).toBeCloseTo(each);
    // two moves (we won the ball between them): each block whole
    const two = match([them("shot", {}), o("block"), o("recovery", {}, { actorId: "b" }), them("shot", {}), o("block")]);
    expect(item(two, "Remate bloqueado")!.value).toBeCloseTo(0.24);
  });
  it("the keeper: goals prevented against the shots on target he faced, shrunk (n / (n + 15)), with proof he was in goal and the goals tallying", () => {
    const shots = () => [them("shot", { onTarget: true }), them("shot", { onTarget: true }), them("goal", { goal: true })];
    const keeper = { k: row(50, { positionsPlayed: { POR: 50 } }), a: row(50) };
    // three in the area at 0,5 each − 1 conceded
    expect(item(match(shots(), keeper, { goalsAgainst: 1 }), "Goles evitados", "k")).toMatchObject({ n: 3, value: expect.closeTo((0.5 * 3) / 18, 6) });
    // the acta says two against, the narration tells one: no credit
    expect(item(match(shots(), keeper, { goalsAgainst: 2 }), "Goles evitados", "k")).toBeUndefined();
    // an estimated POR is no proof
    expect(item(match(shots(), { k: row(50, { positionsPlayed: { POR: 50 }, positionsEstimated: true }) }, { goalsAgainst: 1 }), "Goles evitados", "k")).toBeUndefined();
  });
  it("a penalty wide or against the woodwork is no save", () => {
    const keeper = { k: row(50, { positionsPlayed: { POR: 50 } }), a: row(50) };
    const m = match([them("shot", { penalty: true, outcome: "off_target" }), them("shot", { penalty: true, outcome: "woodwork" })], keeper);
    expect(item(m, "Goles evitados", "k")).toBeUndefined();
    expect(matchValue(m).team.against).toBe(0);
  });
  it("a penalty faced counts in his goals prevented (0,78 expected); the acta's saved one only when those are not known", () => {
    const keeper = { k: row(50, { positionsPlayed: { POR: 50 }, penaltySaved: 1 }), a: row(50) };
    const m = match([them("shot", { penalty: true, outcome: "saved", onTarget: true }), them("goal", { goal: true, penalty: true })], keeper, { goalsAgainst: 1 });
    expect(item(m, "Goles evitados", "k")).toMatchObject({ n: 2, value: expect.closeTo(((0.78 * 2 - 1) * 2) / 17, 6) });
    expect(item(m, "Penalti parado", "k")).toBeUndefined();
  });
  it("the keeper's held ball: an own-area recovery where the rival threatened, 0,01 after a clearance of theirs; a cross caught, a recovery too", () => {
    const m = match([them("shot", {}), o("keeper", { outcome: "held" }), them("clearance", {}), o("keeper", { outcome: "held" }), o("keeper", { subtype: "cross_caught", outcome: "held" })]);
    expect(item(m, "Balón atrapado")).toMatchObject({ n: 2, value: expect.closeTo(0.06 + 0.01, 6) });
    expect(item(m, "Centro atrapado")!.value).toBeCloseTo(0.06);
  });
  it("the keeper's distribution, punch and coming out for a cross", () => {
    const m = match([o("keeper", { subtype: "distribution", outcome: "complete" }), o("keeper", { subtype: "punch", firstControl: "out" }), o("keeper", { subtype: "cross_exit", outcome: "complete" }), o("keeper", { subtype: "cross_exit", outcome: "failed" })]);
    expect(item(m, "Saque del portero bueno")!.value).toBeCloseTo(0.004);
    expect(item(m, "Puñetazo")!.value).toBeCloseTo(0.02);
    expect(item(m, "Salida del portero")!.value).toBeCloseTo(0.08);
    expect(item(m, "Salida del portero fallada")!.value).toBeCloseTo(-0.02);
  });
});

describe("discipline and the narration's judgement", () => {
  it("a yellow −0,05; a sending-off −0,1 − 1,0 × the share of the match left (a second yellow once, as the sending-off); a tactical foul costs nothing", () => {
    const m = match([o("discipline", { subtype: "foul", tactical: true }), o("discipline", { subtype: "foul" }, { actorId: "b" }), o("discipline", { subtype: "foul_received" })], { a: row(50, { yellowCards: 1 }), b: row(50, { yellowCards: 2, redCards: 1, doubleYellows: 1 }) }, { events: [{ id: "r", type: "double_yellow", playerId: "b", minute: 10 }] });
    expect(item(m, "Amarilla")!.value).toBeCloseTo(-0.05);
    expect(item(m, "Falta cometida")).toBeUndefined();
    expect(item(m, "Falta recibida")!.value).toBeCloseTo(0.01);
    expect(item(m, "Expulsión", "b")!.value).toBeCloseTo(-0.1 - 40 / 50);
    expect(item(m, "Amarilla", "b")).toBeUndefined();
    expect(item(m, "Falta cometida", "b")!.value).toBeCloseTo(-0.01);
    // without the minute, when his last stint ended
    expect(item(match([], { a: row(45, { redCards: 1, stints: [{ from: 0, to: 45 }] }) }), "Expulsión")!.value).toBeCloseTo(-0.1 - 5 / 50);
  });
  it("only what the narration calls an error costs: a defensive cover is no mistake", () => {
    expect(item(match([o("judgement", { subtype: "error" })]), "Error señalado en la narración")!.value).toBeCloseTo(-0.05);
    expect(item(match([o("judgement", { subtype: "defensive_cover" })]), "Error señalado en la narración")).toBeUndefined();
    expect(item(match([o("judgement")]), "Error señalado en la narración")).toBeUndefined();
  });
  it("a big chance counts only with the club's declared criterion: created +0,1, missed −0,1", () => {
    const told = (parameters: typeof DEFAULT_ANALYSIS_PROFILE.parameters) => {
      const kp = o("pass", { outcome: "complete", keyPass: true });
      const m = match([kp, o("shot", { bigChance: true }, { actorId: "b", links: { pass: kp.id } })]);
      m.analysis = { ...m.analysis!, profile: { ...DEFAULT_ANALYSIS_PROFILE, parameters } };
      return m;
    };
    // an analysis narrated before the criterion keeps its profile without one
    const { bigChanceCriterion, ...undeclared } = DEFAULT_ANALYSIS_PROFILE.parameters;
    expect(item(told(undeclared), "Ocasión clarísima creada")).toBeUndefined();
    expect(item(told({ ...undeclared, bigChanceCriterion: "  " }), "Ocasión clarísima creada")).toBeUndefined();
    // the default profile declares Opta's
    expect(bigChanceCriterion).toMatch(/^Ocasión clarísima \(Opta\) v1: /);
    expect(item(told(DEFAULT_ANALYSIS_PROFILE.parameters), "Ocasión clarísima creada")!.value).toBeCloseTo(0.1);
    expect(item(told(DEFAULT_ANALYSIS_PROFILE.parameters), "Ocasión clarísima fallada", "b")!.value).toBeCloseTo(-0.1);
  });
});

describe("the team while he was on the pitch", () => {
  it("our goals while he was on (his own left out) and the rival's danger: each shot on target at its chance with a normal keeper", () => {
    const ledger = { a: row(25, { stints: [{ from: 0, to: 25 }] }), b: row(50, { goals: 1, stints: [{ from: 0, to: 50 }] }), k: row(50, { positionsPlayed: { POR: 50 }, stints: [{ from: 0, to: 50 }] }) };
    const m = match([o("goal", { goal: true }, { actorId: "b", ...at(10) }), them("shot", { onTarget: true }, at(20)), them("goal", { goal: true, outsideArea: true }, at(40))], ledger, { goalsFor: 1, goalsAgainst: 1 });
    expect(of(m).team).toEqual({ on: 25, for: 1, against: 0.5, matchFor: 1, matchAgainst: 0.75 });
    // the scorer's goal is not his again, not even in the whole match; the goal from outside, a 25 % chance
    expect(of(m, "b").team).toEqual({ on: 50, for: 0, against: 0.75, matchFor: 0, matchAgainst: 0.75 });
    expect(matchValue(m).team).toEqual({ for: 1, against: 0.75, expected: true });
  });
  it("what he caused himself is not his again: his error, his penalty, his own goal", () => {
    const ledger = { a: row(50, { penaltyCommitted: 1, stints: [{ from: 0, to: 50 }] }), b: row(50, { stints: [{ from: 0, to: 50 }] }) };
    const m = match([o("loss", {}, at(5)), them("goal", { goal: true }, at(5)), o("discipline", { subtype: "penalty_committed" }, at(30)), them("goal", { goal: true, penalty: true }, at(30))], ledger, { goalsAgainst: 2 });
    expect(of(m).team).toMatchObject({ against: 0, matchAgainst: 0 });
    // (no shots of theirs narrated: each goal counts whole)
    expect(of(m, "b").team).toMatchObject({ against: 2, matchAgainst: 2 });
  });
  it("without the narration's minutes or goals: in proportion to his minutes", () => {
    const m = match([], { a: row(20), b: row(50, { goals: 2 }) }, { goalsFor: 2, goalsAgainst: 3 });
    expect(of(m).team).toEqual({ on: 20, for: expect.closeTo(0.8, 10), against: expect.closeTo(1.2, 10), matchFor: 2, matchAgainst: 3 });
    expect(of(m, "b").team).toMatchObject({ for: 0, matchFor: 0 });
  });
  it("la mesa's woodwork or missed penalty is no narration of the rival's shots: their goals count whole, its saves stay the keeper's", () => {
    const keeper = { k: row(50, { positionsPlayed: { POR: 50 }, stints: [{ from: 0, to: 50 }] }), a: row(50, { stints: [{ from: 0, to: 50 }] }) };
    const m = match([], keeper, { goalsAgainst: 1, events: [{ id: "w", type: "opponent_woodwork", minute: 5 }, { id: "s", type: "save", playerId: "k", minute: 8, outcome: "held" }, { id: "g", type: "opponent_goal", minute: 10 }] });
    expect(matchValue(m).team).toMatchObject({ against: 1, expected: false });
    // the la mesa branch: one save and one goal at 0,42 each
    expect(item(m, "Goles evitados", "k")).toMatchObject({ n: 2, value: expect.closeTo(((0.84 - 1) * 2) / 17, 6) });
  });
});

describe("the match itself", () => {
  it("is narrated from 30 actions of ours; its volume counts both teams'; la mesa's chances count only without a narration", () => {
    const mesa = match([o("context", { chance: true })]);
    expect(matchValue(mesa).narrated).toBe(false);
    expect(item(mesa, "Ocasión")!.value).toBeCloseTo(0.08);
    const told = match([o("context", { chance: true }), ...ours(30), ...theirs(20)]);
    expect(matchValue(told).narrated).toBe(true);
    expect(matchValue(told).volume).toBe(50);
    expect(item(told, "Ocasión")).toBeUndefined();
  });
  it("the F7 calibration: the table × (goals + 10) / (chances + 10) over the narrated non-penalty shots of both teams", () => {
    const shots = [o("goal", { goal: true }), o("shot", {}), them("goal", { goal: true, outsideArea: true }), them("shot", { bodyPart: "head" }), them("goal", { goal: true, penalty: true }), ...ours(30)];
    expect(xgFactor([match(shots)])).toBeCloseTo((2 + 10) / (0.12 + 0.12 + 0.04 + 0.08 + 10), 10);
    expect(xgFactor([match([o("goal", { goal: true })])])).toBe(1);
    // a side whose shots the narration does not tell (only the acta's goals) stays out: its goals without its misses
    const goalsOnly = match([o("shot", {}), ...ours(30)], { a: row(50), b: row(50) }, { goalsAgainst: 2, events: [{ id: "g1", type: "opponent_goal", minute: 10 }, { id: "g2", type: "opponent_goal", minute: 20 }] });
    expect(xgFactor([goalsOnly])).toBeCloseTo(10 / 10.12, 10);
  });
  it("his minutes are the acta's (its seconds first); unknown minutes give null; guests are not rated", () => {
    const m = match([], { a: row(50, { secondsPlayed: 2950 }), b: { ...row(0), minutes: undefined as unknown as number }, "guest:x": row(50) });
    expect(of(m).minutes).toBeCloseTo(2950 / 60);
    expect(of(m, "b").minutes).toBeNull();
    expect(matchValue(m).players.has("guest:x")).toBe(false);
  });
  it("his lines and positions this match, as shares of the minutes the acta places", () => {
    const p = of(match([], { a: row(50, { positionsPlayed: { DFC: 30, LI: 5, MC: 10, MCD: 5 } }) }));
    expect(p.lines).toEqual({ DEF: 0.7, MED: 0.3 });
    expect(p.roles).toEqual({ "DEF-centro": 0.6, "DEF-banda": 0.1, "MED-centro": 0.3 });
  });
  it("plus-minus: the xG for and against with him on and off, narrated matches with his stints only", () => {
    const ledger = { a: row(25, { stints: [{ from: 0, to: 25 }] }), b: row(50, { stints: [{ from: 0, to: 50 }] }) };
    const m = match([...ours(30), o("shot", {}, at(10)), them("shot", { bodyPart: "head" }, at(40))], ledger);
    expect(of(m).plusMinus).toEqual({ on: 25, off: 25, forOn: 0.12, againstOn: 0, forOff: 0, againstOff: 0.08 });
    expect(of(match([o("shot", {}, at(10))], ledger)).plusMinus).toBeNull();
  });
});
