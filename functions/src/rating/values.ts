// One match's value for each player of ours who played it: what every action of his was worth, in goals, from
// the narration (when the match has one; la mesa's events otherwise) and the acta, and what happened with the team
// while he was on the pitch. The acta decides the counts (goals, assists, cards, penalties); the narration adds
// what happened around them. Each player is placed in his fixed position (./fixed). Pure, memoized per match object
// and calibrations (the season gives them: xgFactor, keeperFactor). The numbers are in ./constants; the season turns
// these values into notas (./season).
import { mergedObservations } from "../narrated/observations.js";
import { kindOf, passComplete, quantity } from "../narrated/operators.js";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../narrated/types.js";
import { isPosCode, lineOf, POSITIONS, type Line, type PosCode } from "../positions.js";
import { isGuestId } from "../guests.js";
import { durationOf, type RatingMatch } from "./types.js";
import { fixedPositions } from "./fixed.js";
import * as K from "./constants.js";

export type Group = "ataque" | "pase" | "defensa" | "porteria" | "errores" | "disciplina";
export interface Item {
  label: string;
  group: Group;
  n: number;
  value: number;
  /** A one-off event of the acta (goals, assists, penalties, cards, errors that end in a goal, goals prevented). */
  acta?: true;
}
/** The acta's goals, the ones the scorer's position weighs (GOAL_WEIGHTS). */
export const GOAL_LABELS: ReadonlySet<string> = new Set(["Gol", "Gol de penalti"]);
export interface PlusMinusRaw {
  /** Minutes on and off the pitch, and the xG for and against while on / off. */
  on: number;
  off: number;
  forOn: number;
  againstOn: number;
  forOff: number;
  againstOff: number;
}
/** Where he is compared: the keeper, or a line's centre or wings (a centre-back with the centre-backs, a full-back
 *  with the full-backs). */
export type Role = "POR" | "DEF-centro" | "DEF-banda" | "MED-centro" | "MED-banda" | "DEL-centro" | "DEL-banda";
export interface TeamOnPitch {
  /** His minutes on the pitch (the acta's stints; his minutes when it has none). */
  on: number;
  /** Our goals while he was on, his own left out. */
  for: number;
  /** The goals against while he was on, what he caused himself (his error, his penalty, his own goal) left out. */
  against: number;
  /** The whole match counted the same way, his own left out too (a short stint is pulled toward it). */
  matchFor: number;
  matchAgainst: number;
}
export interface PlayerMatchValue {
  /** His minutes (the acta's; null when it does not know them: then the match gives him no nota). */
  minutes: number | null;
  /** His fixed position (./fixed: where he started, or first came on; null when the acta cannot place him). */
  position: PosCode | null;
  /** His line and position: the fixed one whole; without it, his minutes by line and position as shares (empty when
   *  the acta does not say where he played). */
  lines: Partial<Record<Line, number>>;
  roles: Partial<Record<Role, number>>;
  /** The narration's actions (the volume of play: scaled by the match's narration volume, compared per 50′) and the
   *  acta's (the one-off events: goals, penalties, cards, errors that end in a goal, goals prevented; counted whole),
   *  good and bad apart (the rival adjusts them apart). */
  narrGood: number;
  narrBad: number;
  actaGood: number;
  actaBad: number;
  /** The narration's actions by family (how many, and their good and bad value): the position weighs them. */
  families: Partial<Record<Group, { n: number; good: number; bad: number }>>;
  /** What his goals were worth (the acta's): the position weighs them. */
  goals: number;
  items: Item[];
  team: TeamOnPitch;
  plusMinus: PlusMinusRaw | null;
}
export interface MatchValue {
  /** The match has a narration of its own (not only the acta and la mesa). */
  narrated: boolean;
  /** Both teams' recorded actions per 50′: how much of the match the narration tells (not who had the ball). */
  volume: number;
  /** The whole match as TeamOnPitch counts it: our goals and theirs. */
  team: { for: number; against: number };
  players: Map<string, PlayerMatchValue>;
}

const ACTIONS = new Set(["pass", "reception", "control", "loss", "dribble", "carry", "shot", "goal", "recovery", "interception", "tackle", "clearance", "block", "duel", "pressure", "judgement", "keeper", "distribution", "discipline", "save"]);
const OK = new Set(["complete", "completed", "success", "won"]);
const BAD = new Set(["failed", "lost"]);
const outcome = (o: Observation) => String(o.facts.outcome ?? "");
const ok = (o: Observation) => OK.has(outcome(o));
const bad = (o: Observation) => BAD.has(outcome(o));
const isOurAction = (o: Observation) => o.team === "us" && !!o.actorId && ACTIONS.has(kindOf(o));
const isShot = (o: Observation) => kindOf(o) === "shot" || kindOf(o) === "goal";
const isGoal = (o: Observation) => kindOf(o) === "goal" || o.facts.goal === true;
const isOpponentGoal = (o: Observation) => o.team === "opponent" && isGoal(o) && o.facts.ownGoal !== true;
/** A goal against us: the rival's, or one of ours into our own net; a goal for us, the other way round. */
const isGoalAgainst = (o: Observation) => isGoal(o) && (o.facts.ownGoal === true ? o.team === "us" : o.team === "opponent");
const isGoalFor = (o: Observation) => isGoal(o) && (o.facts.ownGoal === true ? o.team === "opponent" : o.team === "us");
const onTarget = (o: Observation) => o.facts.onTarget === true || ["on_target", "saved", "woodwork"].includes(outcome(o)) || o.facts.woodwork === true;
const isDistribution = (o: Observation) => kindOf(o) === "distribution" || (kindOf(o) === "keeper" && o.facts.subtype === "distribution");
/** A shot on target that did not go in (not the woodwork): what a keeper saves. */
const savedOrHeld = (o: Observation) => onTarget(o) && o.facts.woodwork !== true && outcome(o) !== "woodwork";
/** Where on the pitch (0 own area … 4 the rival's area, from the actor's side), when the narration says. */
const zoneOf = (o: Observation): number | null => {
  const z = o.facts.zone;
  return typeof z === "string" && z in K.ZONE_INDEX ? K.ZONE_INDEX[z] : null;
};
/** A shot's chance (xG) by the professional table, from what the narration tells about it. */
export function shotXg(f: Observation["facts"]): number {
  if (f.penalty === true) return K.PENALTY_GOAL;
  if (f.directFreekick === true) return K.XG.directFreekick;
  if (f.bodyPart === "head") return K.XG.head;
  if (f.outsideArea === true) return K.XG.outside;
  return K.XG.area;
}
const keeperProb = (f: Observation["facts"]) => (f.bodyPart === "head" ? K.KEEPER_GOAL_PROB.head : f.outsideArea === true ? K.KEEPER_GOAL_PROB.outside : K.KEEPER_GOAL_PROB.area);
/** An observation's minute (the middle of its interval), or null without a time. */
const minuteOf = (o: Observation): number | null => (o.time && Number.isFinite(o.time.from) ? (o.time.from + (Number.isFinite(o.time.to) ? o.time.to : o.time.from)) / 120 : null);
const roleOf = (code: PosCode): Role => (code === "POR" ? "POR" : (`${POSITIONS[code].line}-${POSITIONS[code].side === "centro" ? "centro" : "banda"}` as Role));

/** Pass families for the difficulty: each fails as often as the team's own passes of the kind. */
type PassType = "ground" | "high" | "throw" | "goalkick" | "cross" | "deep";
function passType(f: Observation["facts"]): PassType {
  if (f.restart === "throw_in") return "throw";
  if (f.restart === "goal_kick") return "goalkick";
  if (f.subtype === "cross" || f.restart === "corner" || (f.restart === "freekick" && f.directFreekick !== true)) return "cross";
  if (f.deepPass === true) return "deep";
  return f.height === "high" ? "high" : "ground";
}
const PASS_LABEL: Record<PassType, [string, string]> = {
  ground: ["Pase raso bueno", "Pase raso fallado"],
  high: ["Pase alto bueno", "Pase alto fallado"],
  throw: ["Saque de banda bueno", "Saque de banda fallado"],
  goalkick: ["Saque de puerta bueno", "Saque de puerta fallado"],
  cross: ["Centro bueno", "Centro fallado"],
  deep: ["Pase en profundidad bueno", "Pase en profundidad fallado"],
};

/** The match's observations (the narration over the acta's events), once per match object. */
const observed = new WeakMap<RatingMatch, Observation[]>();
function observationsOf(m: RatingMatch): Observation[] {
  let obs = observed.get(m);
  if (!obs) observed.set(m, (obs = mergedObservations(m)));
  return obs;
}
const isNarrated = (ours: readonly Observation[]) => ours.filter((o) => o.facts.legacyType === undefined).reduce((s, o) => s + quantity(o), 0) >= K.NARRATED_MIN_ACTIONS;
/** The narration tells a side's shots (not only the goals, or la mesa's woodwork and missed penalties: those come
 *  from the acta's events). */
const shotsTold = (obs: readonly Observation[], team: "us" | "opponent") => obs.some((o) => o.team === team && kindOf(o) === "shot" && o.facts.legacyType === undefined);

/** One side's non-penalty shots in a match: their goals and chances by the professional table, and of those on target
 *  the goals and the keeper's table probabilities. */
export interface SideTally {
  goals: number;
  xg: number;
  onTargetGoals: number;
  onTargetProb: number;
}
type Tally = Record<"us" | "opponent", SideTally>;
const tallies = new WeakMap<RatingMatch, Tally>();
/** A narrated match's non-penalty shots, side by side, for the calibrations (a side whose shots the narration does not
 *  tell gives none: its goals alone would inflate them). */
export function shotTally(m: RatingMatch): Tally {
  let t = tallies.get(m);
  if (!t) {
    const side = (): SideTally => ({ goals: 0, xg: 0, onTargetGoals: 0, onTargetProb: 0 });
    t = { us: side(), opponent: side() };
    const obs = observationsOf(m);
    const told = { us: shotsTold(obs, "us"), opponent: shotsTold(obs, "opponent") };
    if (isNarrated(obs.filter(isOurAction)))
      for (const o of obs) {
        const team = o.team === "us" ? "us" : "opponent";
        if (!isShot(o) || o.facts.penalty === true || o.facts.ownGoal === true || !told[team]) continue;
        const q = quantity(o);
        t[team].xg += q * shotXg(o.facts);
        if (isGoal(o)) t[team].goals += q;
        if (isGoal(o) || savedOrHeld(o)) {
          t[team].onTargetProb += q * keeperProb(o.facts);
          if (isGoal(o)) t[team].onTargetGoals += q;
        }
      }
    tallies.set(m, t);
  }
  return t;
}
/** The mean of each side's (goals + prior) / (Σ expected + prior) over these matches. */
function calibration(games: readonly RatingMatch[], goals: (s: SideTally) => number, expected: (s: SideTally) => number, prior: number): number {
  const factor = (team: "us" | "opponent") => {
    let g = 0;
    let e = 0;
    for (const m of games) {
      g += goals(shotTally(m)[team]);
      e += expected(shotTally(m)[team]);
    }
    return (g + prior) / (e + prior);
  };
  return (factor("us") + factor("opponent")) / 2;
}
/** The F7 calibration of the chances over these matches: the table × the mean of each side's (goals + XG_PRIOR_GOALS) /
 *  (Σ its chances + XG_PRIOR_GOALS), so it starts at the table and moves with the season's shots. */
export const xgFactor = (games: readonly RatingMatch[]): number =>
  calibration(games, (s) => s.goals, (s) => s.xg, K.XG_PRIOR_GOALS);
/** The keeper's calibration: the same over the shots on target and the keeper's table probabilities. */
export const keeperFactor = (games: readonly RatingMatch[]): number =>
  calibration(games, (s) => s.onTargetGoals, (s) => s.onTargetProb, K.KEEPER_PRIOR_GOALS);

const memo = new WeakMap<RatingMatch, Map<string, MatchValue>>();
/** `xg` and `keeper`: the season's calibrations up to the acta (xgFactor, keeperFactor; 1 is the professional table). */
export function matchValue(m: RatingMatch, xg = 1, keeper = 1): MatchValue {
  let byCal = memo.get(m);
  if (!byCal) memo.set(m, (byCal = new Map()));
  const key = `${xg}|${keeper}`;
  let v = byCal.get(key);
  if (!v) byCal.set(key, (v = compute(m, xg, keeper)));
  return v;
}

function compute(m: RatingMatch, xg: number, keeper: number): MatchValue {
  const duration = durationOf(m);
  const profile = m.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE;
  const rows = Object.entries(m.ledger ?? {}).filter(([id, r]) => r?.played === true && !isGuestId(id));
  const ids = new Set(rows.map(([id]) => id));
  const obs = observationsOf(m);
  const at = new Map(obs.map((o, i) => [o, i] as const));
  /** The last observation before `o` that matches. */
  const lastBefore = (o: Observation, match: (x: Observation) => boolean): Observation | undefined => {
    for (let j = at.get(o)! - 1; j >= 0; j--) if (match(obs[j])) return obs[j];
    return undefined;
  };
  /** A shot on target's goal probability with a normal keeper, calibrated with the season. */
  const kp = (f: Observation["facts"]) => Math.min(K.KEEPER_PROB_MAX, keeperProb(f) * keeper);
  const kpUnknown = Math.min(K.KEEPER_PROB_MAX, K.KEEPER_GOAL_PROB.unknown * keeper);
  const ours = obs.filter(isOurAction);
  const narrated = isNarrated(ours);
  // (both teams': a side that has the ball makes more actions, the match is not told in more detail for it)
  const theirActions = obs.filter((o) => o.team === "opponent" && ACTIONS.has(kindOf(o)));
  const volume = (([...ours, ...theirActions].reduce((s, o) => s + quantity(o), 0)) * 50) / duration;

  const acc = new Map<string, { narrGood: number; narrBad: number; actaGood: number; actaBad: number; families: PlayerMatchValue["families"]; items: Map<string, Item> }>();
  for (const id of ids) acc.set(id, { narrGood: 0, narrBad: 0, actaGood: 0, actaBad: 0, families: {}, items: new Map() });
  /** `fromNarration`: the volume of play, scaled later by the narration's volume and compared per 50′; else a
   *  one-off event, counted whole. */
  const add = (id: string | undefined, label: string, group: Group, value: number, fromNarration = true, n = 1) => {
    const a = id ? acc.get(id) : undefined;
    if (!a || !value) return;
    if (fromNarration && value > 0) a.narrGood += value;
    else if (fromNarration) a.narrBad += value;
    else if (value > 0) a.actaGood += value;
    else a.actaBad += value;
    if (fromNarration) {
      const f = (a.families[group] ??= { n: 0, good: 0, bad: 0 });
      f.n += n;
      if (value > 0) f.good += value;
      else f.bad += value;
    }
    const it = a.items.get(label) ?? { label, group, n: 0, value: 0, ...(fromNarration ? {} : { acta: true as const }) };
    it.n += n;
    it.value += value;
    a.items.set(label, it);
  };

  // pass difficulty: the team's completion by type this match (with a prior of PASS_PRIOR passes), and of its
  // passes back; a pass is measured against them, so the average one is worth nothing
  const tried = new Map<PassType, [number, number]>();
  let backMade = 0;
  let backAll = 0;
  for (const o of ours) {
    if (kindOf(o) !== "pass" || o.facts.restart === "kickoff") continue;
    const done = passComplete(o, profile);
    if (done === undefined) continue;
    const t = tried.get(passType(o.facts)) ?? [0, 0];
    t[1] += quantity(o);
    if (done) t[0] += quantity(o);
    tried.set(passType(o.facts), t);
    if (o.facts.direction === "backward") {
      backAll += quantity(o);
      if (done) backMade += quantity(o);
    }
  }
  const rate = (t: PassType) => {
    const [made, all] = tried.get(t) ?? [0, 0];
    return (made + K.PASS_PRIOR * K.PASS_PRIOR_RATE) / (all + K.PASS_PRIOR);
  };
  const ref = rate("ground");
  const rateBack = (backMade + K.PASS_PRIOR * K.PASS_PRIOR_RATE) / (backAll + K.PASS_PRIOR);

  const shotOfPass = new Map<string, Observation>();
  for (const o of obs) if (isShot(o) && o.links?.pass) shotOfPass.set(o.links.pass, o);
  const passById = new Map(obs.filter((o) => kindOf(o) === "pass").map((o) => [o.id, o] as const));
  /** Whose chance a key pass's shot is: the shooter's when he dribbles or carries after the pass (he made it), else
   *  the passer's; null when the rule does not apply (a goal keeps it with the pass: the assist). */
  const chanceOf = (p: Observation, s: Observation): "passer" | "shooter" | null => {
    if (kindOf(s) !== "shot" || s.team !== "us" || isGoal(s) || outcome(s) === "goal" || s.facts.penalty === true || !s.actorId || !p.actorId || s.actorId === p.actorId) return null;
    const between = obs.slice(at.get(p)! + 1, at.get(s)!);
    return between.some((x) => x.actorId === s.actorId && (kindOf(x) === "dribble" || kindOf(x) === "carry") && !bad(x)) ? "shooter" : "passer";
  };

  // the same ball once: a «loss» after his own failed action, a recovery after his own won duel or tackle,
  // the actions the narration links as one; a failed pass (or keeper's distribution) the receiver then miscontrols
  // is half each
  const skip = new Set<string>();
  const half = new Set<string>();
  const linked = new Set<string>();
  const failedTouch = (o: Observation) => ["pass", "reception", "control", "dribble", "carry"].includes(kindOf(o)) && (kindOf(o) === "pass" ? passComplete(o, profile) === false : bad(o));
  const failedDistribution = (o: Observation) => isDistribution(o) && passComplete(o, profile) === false;
  ours.forEach((o, i) => {
    const p = ours[i - 1];
    const k = kindOf(o);
    const link = o.links?.action ?? o.links?.duel;
    if (link && ["duel", "tackle", "recovery", "interception"].includes(k)) {
      const key = `${o.actorId}:${link}`;
      if (linked.has(key)) skip.add(o.id);
      linked.add(key);
    }
    if (!p) return;
    if (k === "loss" && p.actorId === o.actorId && failedTouch(p)) skip.add(o.id);
    if (k === "recovery" && p.actorId === o.actorId && (["interception", "clearance", "block"].includes(kindOf(p)) || (["tackle", "duel"].includes(kindOf(p)) && ok(p)))) skip.add(o.id);
    if ((k === "reception" || k === "control") && bad(o) && ((kindOf(p) === "pass" && passComplete(p, profile) === false) || failedDistribution(p)) && p.actorId !== o.actorId) {
      half.add(o.id);
      half.add(p.id);
    }
  });
  ours.forEach((o, i) => {
    const p = ours[i - 1];
    if (kindOf(o) === "loss" && p && half.has(p.id) && p.actorId === o.actorId) skip.add(o.id);
  });

  // receiving: the team's share of passes received against miscontrolled, with the passes' prior (a reception is
  // measured against it)
  let received = 0;
  let missed = 0;
  for (const o of ours) {
    if (skip.has(o.id)) continue;
    const k = kindOf(o);
    if (k === "pass" && o.facts.restart !== "kickoff" && passComplete(o, profile) === true && o.receiverId && o.receiverId !== o.actorId && ids.has(o.receiverId)) received += quantity(o);
    else if ((k === "reception" || k === "control") && bad(o) && ids.has(o.actorId!)) missed += quantity(o);
  }
  const rateReceived = (received + K.PASS_PRIOR * K.PASS_PRIOR_RATE) / (received + missed + K.PASS_PRIOR);

  // one rival attack, one danger: the shots of a move (until we win the ball or play stops) can end in one goal at
  // most, so its blocks and saves share 1 − Π(1 − c) instead of adding up each one's chance (FBref/Opta, ASA)
  const blockXg = (b: Observation) => {
    const shot = lastBefore(b, (x) => x.team === "opponent" && kindOf(x) === "shot");
    return xg * (shot ? shotXg(shot.facts) : K.XG.unknown);
  };
  const saveProb = (s: Observation) => {
    const shot = lastBefore(s, (x) => x.team === "opponent" && isShot(x));
    return shot ? kp(shot.facts) : kpUnknown;
  };
  const closes = (o: Observation) =>
    kindOf(o) === "restart" ||
    (o.team === "us" &&
      ((kindOf(o) === "pass" && passComplete(o, profile) === true) ||
        (["reception", "control"].includes(kindOf(o)) && !bad(o)) ||
        (["carry", "dribble"].includes(kindOf(o)) && ok(o)) ||
        ["recovery", "interception", "shot", "goal", "distribution"].includes(kindOf(o)) ||
        (kindOf(o) === "keeper" && (outcome(o) === "held" || o.facts.subtype === "cross_caught")) ||
        (kindOf(o) === "save" && outcome(o) === "held")));
  const credit = new Map<Observation, number>();
  {
    type Attack = { members: Observation[]; blocks: Observation[]; saves: Observation[]; goal: boolean };
    const attacks: Attack[] = [];
    let cur: Attack | null = null;
    for (const o of obs) {
      if (o.team === "opponent" && isShot(o) && o.facts.penalty !== true && o.facts.ownGoal !== true) {
        if (!cur) attacks.push((cur = { members: [], blocks: [], saves: [], goal: false }));
        cur.members.push(o);
        if (isGoal(o)) {
          cur.goal = true;
          cur = null;
        }
        continue;
      }
      if (!cur) continue;
      if (o.team === "us" && kindOf(o) === "block" && o.facts.subtype !== "pass") {
        cur.members.push(o);
        cur.blocks.push(o);
        continue;
      }
      if (o.team === "us" && kindOf(o) === "save") {
        cur.members.push(o);
        cur.saves.push(o);
        if (outcome(o) === "held") cur = null;
        continue;
      }
      if (closes(o)) cur = null;
    }
    for (const a of attacks) {
      const cs = [...a.blocks.map(blockXg), ...a.saves.map(saveProb)];
      const sum = cs.reduce((s, c) => s + c, 0);
      const together = 1 - cs.reduce((p, c) => p * (1 - Math.min(0.99, c)), 1);
      const factor = a.goal || !(sum > 0) ? 1 : together / sum;
      for (const o of a.members) credit.set(o, factor);
    }
  }
  const creditOf = (o: Observation) => credit.get(o) ?? 1;

  /** Nobody threatened before the keeper held it: the play before was a rival clearance, or our own good pass. */
  const harmless = (o: Observation) => {
    const b = lastBefore(o, (x) => kindOf(x) !== "context");
    return !b || (b.team === "opponent" && kindOf(b) === "clearance") || (b.team === "us" && kindOf(b) === "pass" && passComplete(b, profile) === true);
  };
  const distribution = (o: Observation, id: string | undefined, q: number, h: number) => {
    const done = passComplete(o, profile);
    if (done === true) add(id, "Saque del portero bueno", "pase", q * K.DISTRIBUTION_COMPLETE, true, q);
    else if (done === false) add(id, "Saque del portero fallado", "pase", q * K.PASS_FAIL * (rate("goalkick") / ref) * h, true, q);
  };
  const clearance = (o: Observation, id: string | undefined, q: number, group: Group, label: string, failedLabel: string) => {
    if (bad(o)) add(id, failedLabel, group, q * K.CLEARANCE.failed, true, q);
    else add(id, label, group, q * (o.facts.firstControl === "us" ? K.CLEARANCE.us : o.facts.firstControl === "opponent" ? K.CLEARANCE.opponent : K.CLEARANCE.out), true, q);
  };
  // (only with the club's declared criterion for a big chance: never read from adjectives)
  const bigChances = typeof profile.parameters.bigChanceCriterion === "string" && profile.parameters.bigChanceCriterion.trim() !== "";

  const penaltiesCommitted = new Map<string, Observation[]>();
  const keyPassGoals = new Map<string, number>();
  for (const o of ours) {
    if (skip.has(o.id)) continue;
    const f = o.facts;
    const id = o.actorId;
    const q = quantity(o);
    const h = half.has(o.id) ? 0.5 : 1;
    switch (kindOf(o)) {
      case "pass": {
        if (f.restart === "kickoff") break;
        const t = passType(f);
        const share = f.restart === "throw_in" || f.restart === "goal_kick" ? K.RESTART_SHARE : 1;
        const done = passComplete(o, profile);
        if (done === true) {
          if (f.keyPass === true) {
            const s = shotOfPass.get(o.id);
            // (the chance is his unless the shooter made it himself after the pass: then it was a pass in behind)
            if (s && chanceOf(o, s) === "shooter") add(id, "Pase clave que el rematador se fabrica", "pase", q * K.DEEP_PASS, true, q);
            else add(id, "Pase clave", "pase", q * xg * (s ? shotXg(s.facts) : K.KEY_PASS_DEFAULT), true, q);
            if (s && s.team === "us" && isGoal(s) && id) keyPassGoals.set(id, (keyPassGoals.get(id) ?? 0) + q);
            if (bigChances && s?.facts.bigChance === true) add(id, "Ocasión clarísima creada", "pase", q * K.BIG_CHANCE, true, q);
          } else if (t === "deep") add(id, "Pase en profundidad bueno", "pase", q * K.DEEP_PASS, true, q);
          else if (t === "cross") add(id, "Centro bueno", "pase", q * K.CROSS_COMPLETE, true, q);
          else if (f.entersArea === true) add(id, "Pase al área", "pase", q * K.CROSS_COMPLETE, true, q);
          else if (f.direction === "backward") add(id, "Pase atrás", "pase", q * share * K.PASS_SWING * (1 - rateBack), true, q);
          else add(id, PASS_LABEL[t][0], "pase", q * share * K.PASS_SWING * (1 - rate(t)), true, q);
          if (f.underPressure === true || f.switchOfPlay === true) add(id, "Pase bajo presión o cambio de orientación", "pase", q * K.PASS_PRESSURE_BONUS, true, q);
          if (o.receiverId && o.receiverId !== id) add(o.receiverId, "Pase recibido", "pase", q * K.RECEIVE_SWING * (1 - rateReceived), true, q);
        } else if (done === false) {
          const back = f.direction === "backward" && t !== "cross" && t !== "deep";
          add(id, back ? "Pase atrás fallado" : PASS_LABEL[t][1], "pase", -q * share * K.PASS_SWING * (back ? rateBack : rate(t)) * (f.deflected === true ? 0.5 : 1) * h, true, q);
        }
        break;
      }
      case "distribution":
        distribution(o, id, q, h);
        break;
      case "reception":
      case "control":
        if (bad(o)) add(id, "Control fallado", "pase", -q * K.RECEIVE_SWING * rateReceived * h, true, q);
        break;
      case "loss":
        add(id, "Pérdida", "pase", q * K.LOSS, true, q);
        break;
      case "dribble": {
        const z = zoneOf(o);
        if (ok(o)) add(id, "Regate bueno", "ataque", q * (z === null ? K.DRIBBLE_WON : K.DRIBBLE_BASE + K.ZONE_THREAT[Math.min(4, z + 1)] - K.ZONE_THREAT[z]), true, q);
        else if (bad(o)) add(id, "Regate fallado", "ataque", q * K.DRIBBLE_FAIL, true, q);
        break;
      }
      case "carry":
        if (ok(o)) add(id, "Conducción buena", "ataque", q * K.CARRY_WON, true, q);
        break;
      case "shot": {
        // the goals and the penalties come from the acta; a shot is worth its chance, a bit more on target — the
        // aim alone when the chance was a teammate's key pass
        if (f.goal === true || outcome(o) === "goal" || f.penalty === true) break;
        const p = o.links?.pass ? passById.get(o.links.pass) : undefined;
        const passers = !!p && p.facts.keyPass === true && passComplete(p, profile) === true && chanceOf(p, o) === "passer";
        add(id, onTarget(o) ? "Remate a puerta" : "Remate fuera o bloqueado", "ataque", q * ((passers ? 0 : xg * shotXg(f)) + (onTarget(o) ? K.ON_TARGET_BONUS : 0)), true, q);
        if (bigChances && f.bigChance === true) add(id, "Ocasión clarísima fallada", "ataque", -q * K.BIG_CHANCE, true, q);
        break;
      }
      case "recovery":
        add(id, "Recuperación", "defensa", q * K.RECOVERY * (f.zone === "own_area" ? K.OWN_AREA_FACTOR : 1), true, q);
        break;
      case "interception":
        add(id, "Intercepción", "defensa", q * K.INTERCEPTION * (f.zone === "own_area" ? K.OWN_AREA_FACTOR : 1) * (outcome(o) === "neutral" ? K.NEUTRAL_SHARE : 1), true, q);
        break;
      case "clearance":
        clearance(o, id, q, "defensa", "Despeje", "Despeje fallado");
        break;
      case "block":
        if (f.subtype === "pass") add(id, "Pase bloqueado", "defensa", q * K.BLOCKED_PASS, true, q);
        else add(id, "Remate bloqueado", "defensa", q * blockXg(o) * creditOf(o), true, q);
        break;
      case "tackle":
        if (ok(o)) add(id, "Entrada ganada", "defensa", q * K.TACKLE_WON, true, q);
        else if (outcome(o) === "neutral") add(id, "Entrada neutra", "defensa", q * K.NEUTRAL_SHARE * K.TACKLE_WON, true, q);
        else if (bad(o)) add(id, "Entrada fallada", "defensa", q * K.TACKLE_FAIL, true, q);
        break;
      case "duel":
        if (f.beaten === true) add(id, "Le superan en un duelo", "defensa", q * K.DUEL_BEATEN, true, q);
        else if (ok(o)) add(id, "Duelo ganado", "defensa", q * K.DUEL_WON, true, q);
        else if (bad(o)) add(id, "Duelo perdido", "defensa", q * K.DUEL_LOST, true, q);
        break;
      case "pressure":
        if (ok(o)) add(id, "Presión con éxito", "defensa", q * K.PRESSURE_WON, true, q);
        break;
      case "judgement":
        // (only what the narration calls an error: a defensive cover is no mistake)
        if (f.subtype === "error") add(id, "Error señalado en la narración", "errores", q * K.JUDGEMENT_ERROR, true, q);
        break;
      case "keeper":
        if (f.subtype === "distribution") distribution(o, id, q, h);
        else if (f.subtype === "cross_caught") add(id, "Centro atrapado", "porteria", q * K.RECOVERY * K.OWN_AREA_FACTOR, true, q);
        else if (f.subtype === "punch") clearance(o, id, q, "porteria", "Puñetazo", "Puñetazo fallado");
        else if (f.subtype === "cross_exit") {
          if (ok(o) || outcome(o) === "held") add(id, "Salida del portero", "porteria", q * K.INTERCEPTION * K.OWN_AREA_FACTOR, true, q);
          else if (bad(o)) add(id, "Salida del portero fallada", "porteria", q * K.CLEARANCE.failed, true, q);
        } else if (outcome(o) === "held" && f.subtype === undefined) add(id, "Balón atrapado", "porteria", q * (harmless(o) ? K.HARMLESS_CATCH : K.RECOVERY * K.OWN_AREA_FACTOR), true, q);
        break;
      case "discipline":
        if (f.subtype === "foul") {
          // a tactical foul stops a counter: it costs nothing (its card, if any, costs apart)
          if (f.tactical !== true) add(id, "Falta cometida", "disciplina", q * K.FOUL, true, q);
        } else if (f.subtype === "foul_received") add(id, "Falta recibida", "disciplina", q * K.FOUL_RECEIVED, true, q);
        else if (f.subtype === "penalty_committed" && id) penaltiesCommitted.set(id, [...(penaltiesCommitted.get(id) ?? []), o]);
        break;
    }
  }
  // la mesa's chances, only when the match has no narration of its own (a narrated shot already counts)
  if (!narrated)
    for (const o of obs) if (o.team === "us" && kindOf(o) === "context" && o.facts.chance === true) add(o.actorId, "Ocasión", "ataque", quantity(o) * xg * K.XG.unknown);

  // the acta: goals, assists, cards, own goals and penalties are counted as it says (never scaled)
  const dangerBefore = (o: Observation) => {
    const prev = lastBefore(o, (x) => x.team === "opponent" && ["pass", "dribble", "carry", "shot", "reception", "control"].includes(kindOf(x)));
    const zone = prev && (prev.facts.destinationZone ?? prev.facts.zone);
    // (their zone, from their side: «opponent_area» is our area); our area when the narration does not say
    return typeof zone === "string" && zone in K.ZONE_INDEX ? K.ZONE_THREAT[K.ZONE_INDEX[zone]] : K.ZONE_THREAT[4];
  };
  /** The share of the match left when he was sent off: the acta's minute, else when his last stint ended. */
  const leftAfter = (id: string, stints: readonly { from: number; to: number }[]) => {
    const card = (m.events ?? []).find((e) => (e.type === "red_card" || e.type === "double_yellow") && e.playerId === id && typeof e.minute === "number");
    const minute = card?.minute ?? (stints.length ? Math.max(...stints.map((s) => s.to)) : duration / 2);
    return Math.max(0, Math.min(1, (duration - minute) / duration));
  };
  for (const [id, r] of rows) {
    const scored = Math.max(0, (r.goals ?? 0) - (r.goalPenalty ?? 0));
    if (scored) add(id, "Gol", "ataque", scored * K.GOAL_VALUE, false, scored);
    if (r.goalPenalty) add(id, "Gol de penalti", "ataque", r.goalPenalty * (1 - K.PENALTY_GOAL), false, r.goalPenalty);
    if (r.assists) add(id, "Asistencia", "ataque", r.assists * K.ASSIST_BONUS + Math.max(0, r.assists - (keyPassGoals.get(id) ?? 0)) * xg * K.KEY_PASS_DEFAULT, false, r.assists);
    if (r.penaltyMissed) add(id, "Penalti fallado", "ataque", -r.penaltyMissed * K.PENALTY_GOAL, false, r.penaltyMissed);
    if (r.penaltyReceived) add(id, "Penalti provocado", "ataque", r.penaltyReceived * (K.PENALTY_GOAL - xg * K.ZONE_THREAT[4]), false, r.penaltyReceived);
    if (r.ownGoals) add(id, "Gol en propia", "errores", r.ownGoals * K.OWN_GOAL, false, r.ownGoals);
    const sentOff = Math.max(r.redCards ?? 0, r.doubleYellows ?? 0);
    const yellows = Math.max(0, (r.yellowCards ?? 0) - 2 * (r.doubleYellows ?? 0));
    if (yellows) add(id, "Amarilla", "disciplina", yellows * K.YELLOW, false, yellows);
    if (sentOff) add(id, "Expulsión", "disciplina", sentOff * (K.SENDING_OFF + K.SENDING_OFF_MATCH * leftAfter(id, r.stints ?? [])), false, sentOff);
    // a penalty committed costs what it changed: the penalty's goal probability minus the danger already there
    const narratedPens = penaltiesCommitted.get(id) ?? [];
    for (let i = 0; i < (r.penaltyCommitted ?? 0); i++) add(id, "Penalti cometido", "disciplina", -(K.PENALTY_GOAL - xg * (narratedPens[i] ? dangerBefore(narratedPens[i]) : K.ZONE_THREAT[4])), false);
  }

  // an error that ends in a goal against: our last play, a mistake with the ball (a bad pass or touch, a loss, a
  // keeper's spill, or what the narration calls an error; being dribbled past is no error), the ball still in play,
  // and the goal straight after it (≤ ERROR_WINDOW rival plays, ≤ ERROR_MAX_PASSES passes): it also costs the chance
  // it gave away. A mistake the narration calls an error that leads straight to a shot costs that chance too.
  const failedWithBall = (o: Observation) =>
    failedTouch(o) ||
    failedDistribution(o) ||
    kindOf(o) === "loss" ||
    (kindOf(o) === "judgement" && o.facts.subtype === "error") ||
    (kindOf(o) === "save" && (outcome(o) === "parried" || o.facts.subtype === "parried")) ||
    (kindOf(o) === "keeper" && (o.facts.subtype === "punch" || o.facts.subtype === "cross_exit") && bad(o));
  // (our last play of any kind, a restart included: a restart taken well is no error; any restart between, ours or
  // theirs, means the ball went dead)
  const ourPlay = (o: Observation) => o.team === "us" && !!o.actorId && !["context", "lineup", "substitution", "tactical"].includes(kindOf(o));
  /** Who caused a goal against or a rival chance (his error, his penalty, his own goal): it is not his again in the team's part. */
  const culprit = new Map<Observation, string>();
  const errorBefore = (i: number): Observation | null => {
    let j = i - 1;
    while (j >= 0 && !ourPlay(obs[j])) j--;
    if (j < 0) return null;
    const between = obs.slice(j + 1, i);
    const theirs = between.filter((x) => x.team === "opponent");
    if (between.some((x) => kindOf(x) === "restart") || theirs.length > K.ERROR_WINDOW || theirs.filter((x) => kindOf(x) === "pass").length > K.ERROR_MAX_PASSES) return null;
    return obs[j];
  };
  // (only where the narration tells the rival's play: la mesa notes their goals, not the plays before them)
  const theirPlayTold = obs.some((o) => o.team === "opponent" && o.facts.legacyType === undefined);
  obs.forEach((o, i) => {
    if (!theirPlayTold || o.team !== "opponent" || !isShot(o) || o.facts.penalty === true || o.facts.ownGoal === true) return;
    const e = errorBefore(i);
    if (!e?.actorId) return;
    if (isGoal(o) && failedWithBall(e)) {
      add(e.actorId, "Error que acaba en gol", "errores", K.ERROR_TO_GOAL, false);
      add(e.actorId, "Error que acaba en gol: la ocasión que regala", "errores", -xg * shotXg(o.facts), false);
      culprit.set(o, e.actorId);
    } else if (!isGoal(o) && kindOf(e) === "judgement" && e.facts.subtype === "error") {
      add(e.actorId, "Error que acaba en remate: la ocasión que regala", "errores", -xg * shotXg(o.facts), false);
      culprit.set(o, e.actorId);
    }
  });
  // each rival penalty is his who gave it away: the narrated foul before it, else the one the acta names
  const committers = rows.filter(([, r]) => (r.penaltyCommitted ?? 0) > 0).map(([id]) => id);
  for (const o of obs) {
    if (o.team === "opponent" && isShot(o) && o.facts.penalty === true) {
      const by = lastBefore(o, (x) => x.team === "us" && kindOf(x) === "discipline" && x.facts.subtype === "penalty_committed" && !!x.actorId)?.actorId ?? (committers.length === 1 ? committers[0] : undefined);
      if (by) culprit.set(o, by);
    } else if (o.team === "us" && isGoal(o) && o.facts.ownGoal === true && o.actorId) culprit.set(o, o.actorId);
  }

  // the keeper: goals prevented against the shots on target he faced (penalties at PENALTY_GOAL), shrunk with
  // KEEPER_SHRINK_SHOTS shots of zero; only when the goals tally with the acta and it is proven who was in goal
  // (a narrated GK interval, or the whole match at POR, not estimated)
  const tally = typeof m.goalsAgainst !== "number" || obs.filter(isGoalAgainst).reduce((s, o) => s + quantity(o), 0) === m.goalsAgainst;
  const theirShots = shotsTold(obs, "opponent");
  const savedPens = new Map<string, number>();
  if (tally) {
    const keepers: { id: string; from: number; to: number }[] = [];
    for (const [id, r] of rows)
      if (!r.positionsEstimated && (r.positionsPlayed?.POR ?? 0) >= duration && (r.minutes ?? 0) >= duration) keepers.push({ id, from: 0, to: Infinity });
    for (const o of obs)
      if (o.team === "us" && kindOf(o) === "lineup" && o.facts.role === "GK" && o.actorId && ids.has(o.actorId) && !keepers.some((k) => k.id === o.actorId)) {
        const from = typeof o.facts.intervalStart === "number" ? o.facts.intervalStart / 60 : 0;
        const to = typeof o.facts.intervalEnd === "number" ? o.facts.intervalEnd / 60 : Infinity;
        keepers.push({ id: o.actorId, from, to });
      }
    const keeperAt = (minute: number | null): string | null => {
      const here = minute === null ? keepers.filter((k) => k.from === 0 && k.to === Infinity) : keepers.filter((k) => minute >= k.from && minute <= k.to);
      return here.length === 1 ? here[0].id : null;
    };
    const faced = new Map<string, { exp: number; conc: number; n: number }>();
    const face = (id: string | null, exp: number, goal: boolean, penalty: boolean, q: number) => {
      if (!id) return;
      const f = faced.get(id) ?? { exp: 0, conc: 0, n: 0 };
      f.exp += q * exp;
      f.conc += goal ? q : 0;
      f.n += q;
      faced.set(id, f);
      if (penalty && !goal) savedPens.set(id, (savedPens.get(id) ?? 0) + q);
    };
    if (theirShots) {
      for (const o of obs) {
        // (shots on target: a miss or the woodwork is no save, a penalty's either)
        if (o.team !== "opponent" || !isShot(o) || o.facts.ownGoal === true || !(isGoal(o) || savedOrHeld(o))) continue;
        face(keeperAt(minuteOf(o)), o.facts.penalty === true ? K.PENALTY_GOAL : isGoal(o) ? kp(o.facts) : kp(o.facts) * creditOf(o), isGoal(o), o.facts.penalty === true, quantity(o));
      }
    } else {
      // la mesa: his saves and the goals, without the shots' detail
      for (const o of obs) {
        if (o.team === "us" && kindOf(o) === "save" && o.actorId) face(keepers.some((k) => k.id === o.actorId) ? o.actorId : null, o.facts.penalty === true ? K.PENALTY_GOAL : kpUnknown, false, o.facts.penalty === true, quantity(o));
        else if (isOpponentGoal(o)) face(keeperAt(minuteOf(o)), o.facts.penalty === true ? K.PENALTY_GOAL : kpUnknown, true, o.facts.penalty === true, quantity(o));
      }
    }
    for (const [id, f] of faced) add(id, "Goles evitados", "porteria", ((f.exp - f.conc) * f.n) / (f.n + K.KEEPER_SHRINK_SHOTS), false, f.n);
  }
  // a penalty he saved counts in his goals prevented; the acta's, only when they do not have it
  for (const [id, r] of rows) {
    const extra = (r.penaltySaved ?? 0) - (savedPens.get(id) ?? 0);
    if (extra > 0) add(id, "Penalti parado", "porteria", extra * K.PENALTY_GOAL, false, extra);
  }

  // the team while each one was on the pitch: our goals and theirs (the keeper's shot-stopping is apart, in his goals
  // prevented); what the narration does not place in time, or the goals it misses, in proportion to the minutes
  const threats: { o: Observation | null; minute: number | null; p: number }[] = obs.filter(isGoalAgainst).map((o) => ({ o, minute: minuteOf(o), p: quantity(o) }));
  const toldAgainst = threats.reduce((s, t) => s + t.p, 0);
  if (typeof m.goalsAgainst === "number" && m.goalsAgainst > toldAgainst) threats.push({ o: null, minute: null, p: m.goalsAgainst - toldAgainst });
  const goalsFor = obs.filter(isGoalFor).map((o) => ({ minute: minuteOf(o), n: quantity(o), by: o.team === "us" ? o.actorId : undefined }));
  const toldFor = goalsFor.reduce((s, g) => s + g.n, 0);
  const missingFor = typeof m.goalsFor === "number" ? Math.max(0, m.goalsFor - toldFor) : 0;
  const teamOf = (id: string, r: (typeof rows)[number][1], minutes: number | null): TeamOnPitch => {
    const stints = (r.stints ?? []).filter((s) => Number.isFinite(s.from) && Number.isFinite(s.to) && s.to > s.from);
    const on = stints.length ? Math.min(duration, stints.reduce((s, x) => s + Math.max(0, Math.min(duration, x.to) - x.from), 0)) : (minutes ?? 0);
    const share = Math.min(1, on / duration);
    const here = (minute: number | null) => (minute === null || !stints.length ? share : stints.some((s) => minute >= s.from && minute <= s.to) ? 1 : 0);
    const hisTold = goalsFor.filter((g) => g.by === id).reduce((s, g) => s + g.n, 0);
    const hisMissing = Math.max(0, (r.goals ?? 0) - hisTold);
    const others = goalsFor.filter((g) => g.by !== id);
    const notHis = threats.filter((t) => !t.o || culprit.get(t.o) !== id);
    return {
      on,
      for: others.reduce((s, g) => s + g.n * here(g.minute), 0) + Math.max(0, missingFor - hisMissing) * share,
      against: notHis.reduce((s, t) => s + t.p * here(t.minute), 0),
      matchFor: others.reduce((s, g) => s + g.n, 0) + Math.max(0, missingFor - hisMissing),
      matchAgainst: notHis.reduce((s, t) => s + t.p, 0),
    };
  };

  // plus-minus: the xG for and against with him on the pitch and off it (narrated matches with stints)
  const shots = narrated
    ? obs.filter((o) => isShot(o) && o.facts.ownGoal !== true && minuteOf(o) !== null).map((o) => ({ minute: minuteOf(o)!, ours: o.team === "us", xg: shotXg(o.facts) * quantity(o) }))
    : [];

  const fixed = fixedPositions(m);
  const players = new Map<string, PlayerMatchValue>();
  for (const [id, r] of rows) {
    const a = acc.get(id)!;
    const position = fixed.get(id) ?? null;
    const lines: Partial<Record<Line, number>> = {};
    const roles: Partial<Record<Role, number>> = {};
    if (position) {
      lines[lineOf(position)] = 1;
      roles[roleOf(position)] = 1;
    } else {
      // (the acta cannot place his start: his minutes in each position)
      let total = 0;
      for (const [code, min] of Object.entries(r.positionsPlayed ?? {}))
        if (isPosCode(code) && typeof min === "number" && min > 0) {
          lines[lineOf(code)] = (lines[lineOf(code)] ?? 0) + min;
          roles[roleOf(code)] = (roles[roleOf(code)] ?? 0) + min;
          total += min;
        }
      for (const l of Object.keys(lines) as Line[]) lines[l] = lines[l]! / total;
      for (const p of Object.keys(roles) as Role[]) roles[p] = roles[p]! / total;
    }
    let plusMinus: PlusMinusRaw | null = null;
    const stints = r.stints ?? [];
    if (narrated && stints.length) {
      const isOn = (minute: number) => stints.some((s) => minute >= s.from && minute <= s.to);
      const on = Math.min(duration, stints.reduce((s, x) => s + Math.max(0, x.to - x.from), 0));
      plusMinus = { on, off: Math.max(0, duration - on), forOn: 0, againstOn: 0, forOff: 0, againstOff: 0 };
      for (const s of shots) {
        const here = isOn(s.minute);
        if (s.ours && here) plusMinus.forOn += s.xg;
        else if (s.ours) plusMinus.forOff += s.xg;
        else if (here) plusMinus.againstOn += s.xg;
        else plusMinus.againstOff += s.xg;
      }
    }
    const known = typeof r.minutes === "number" && Number.isFinite(r.minutes);
    const minutes = known ? (typeof r.secondsPlayed === "number" && Number.isFinite(r.secondsPlayed) ? r.secondsPlayed / 60 : r.minutes) : null;
    const items = [...a.items.values()];
    players.set(id, {
      minutes,
      position,
      lines,
      roles,
      narrGood: a.narrGood,
      narrBad: a.narrBad,
      actaGood: a.actaGood,
      actaBad: a.actaBad,
      families: a.families,
      goals: items.filter((it) => GOAL_LABELS.has(it.label)).reduce((s, it) => s + it.value, 0),
      items,
      team: teamOf(id, r, minutes),
      plusMinus,
    });
  }
  return { narrated, volume, team: { for: toldFor + missingFor, against: threats.reduce((s, t) => s + t.p, 0) }, players };
}
