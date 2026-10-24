// One match's value for each player of ours who played it: what every action of his was worth, in goals, from
// the narration (when the match has one; la mesa's events otherwise) and the acta. The acta decides the
// counts (goals, assists, cards, penalties); the narration adds what happened around them. Pure, memoized
// per match object. The numbers are in ./constants; the season turns these values into notas (./season).
import type { ClubMatch } from "../clubData";
import { mergedObservations } from "../../../functions/src/narrated/observations";
import { kindOf, passComplete, quantity } from "../../../functions/src/narrated/operators";
import { DEFAULT_ANALYSIS_PROFILE, type Observation } from "../../../functions/src/narrated/types";
import { isPosCode, lineOf, type Line } from "../positions";
import { durationOf } from "../form";
import { isGuestId } from "../derived/guests";
import * as K from "./constants";

export type Group = "ataque" | "pase" | "defensa" | "porteria" | "errores" | "disciplina";
export interface Item {
  label: string;
  group: Group;
  n: number;
  value: number;
}
export interface PlusMinusRaw {
  /** Minutes on and off the pitch, and the xG for and against while on / off. */
  on: number;
  off: number;
  forOn: number;
  againstOn: number;
  forOff: number;
  againstOff: number;
}
export interface PlayerMatchValue {
  /** His minutes (the acta's; null when it does not know them: then the match gives him no nota). */
  minutes: number | null;
  /** His minutes by line this match, as shares (empty when the acta does not say where he played). */
  lines: Partial<Record<Line, number>>;
  /** The narration's actions (scaled by the match's narration volume) and the acta's, good and bad apart (the
   *  rival adjusts them apart). */
  narrGood: number;
  narrBad: number;
  actaGood: number;
  actaBad: number;
  items: Item[];
  plusMinus: PlusMinusRaw | null;
}
export interface MatchValue {
  /** The match has a narration of its own (not only the acta and la mesa). */
  narrated: boolean;
  /** Our recorded actions per 50′: how much of the match the narration tells. */
  volume: number;
  players: Map<string, PlayerMatchValue>;
}

const ACTIONS = new Set(["pass", "reception", "control", "loss", "dribble", "carry", "shot", "goal", "recovery", "interception", "tackle", "clearance", "block", "duel", "pressure", "judgement", "keeper", "distribution", "discipline", "save"]);
const OK = new Set(["complete", "completed", "success", "won"]);
const BAD = new Set(["failed", "lost"]);
const outcome = (o: Observation) => String(o.facts.outcome ?? "");
const ok = (o: Observation) => OK.has(outcome(o));
const bad = (o: Observation) => BAD.has(outcome(o));
const isOurAction = (o: Observation) => o.team === "us" && !!o.actorId && ACTIONS.has(kindOf(o));
const isOpponentGoal = (o: Observation) => o.team === "opponent" && (kindOf(o) === "goal" || o.facts.goal === true) && o.facts.ownGoal !== true;
const onTarget = (o: Observation) => o.facts.onTarget === true || ["on_target", "saved", "woodwork"].includes(outcome(o)) || o.facts.woodwork === true;
/** Where on the pitch (0 own area … 4 the rival's area, from the actor's side), when the narration says. */
const zoneOf = (o: Observation): number | null => {
  const z = o.facts.zone;
  return typeof z === "string" && z in K.ZONE_INDEX ? K.ZONE_INDEX[z] : null;
};
/** A shot's chance (xG) from what the narration tells about it. */
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

const memo = new WeakMap<ClubMatch, MatchValue>();
export function matchValue(m: ClubMatch): MatchValue {
  let v = memo.get(m);
  if (!v) memo.set(m, (v = compute(m)));
  return v;
}

function compute(m: ClubMatch): MatchValue {
  const duration = durationOf(m);
  const profile = m.analysis?.profile ?? DEFAULT_ANALYSIS_PROFILE;
  const rows = Object.entries(m.ledger ?? {}).filter(([id, r]) => r?.played === true && !isGuestId(id));
  const ids = new Set(rows.map(([id]) => id));
  const obs = mergedObservations(m);
  const ours = obs.filter(isOurAction);
  const narrated = ours.filter((o) => o.facts.legacyType === undefined).reduce((s, o) => s + quantity(o), 0) >= K.NARRATED_MIN_ACTIONS;
  const volume = (ours.reduce((s, o) => s + quantity(o), 0) * 50) / duration;

  const acc = new Map<string, { narrGood: number; narrBad: number; actaGood: number; actaBad: number; items: Map<string, Item> }>();
  for (const id of ids) acc.set(id, { narrGood: 0, narrBad: 0, actaGood: 0, actaBad: 0, items: new Map() });
  /** `fromNarration`: scaled later by the narration's volume (the acta's counts are never scaled). */
  const add = (id: string | undefined, label: string, group: Group, value: number, fromNarration = true, n = 1) => {
    const a = id ? acc.get(id) : undefined;
    if (!a || !value) return;
    if (fromNarration && value > 0) a.narrGood += value;
    else if (fromNarration) a.narrBad += value;
    else if (value > 0) a.actaGood += value;
    else a.actaBad += value;
    const it = a.items.get(label) ?? { label, group, n: 0, value: 0 };
    it.n += n;
    it.value += value;
    a.items.set(label, it);
  };

  // pass difficulty: the team's completion by type this match (with a prior of PASS_PRIOR passes)
  const tried = new Map<PassType, [number, number]>();
  for (const o of ours) {
    if (kindOf(o) !== "pass" || o.facts.restart === "kickoff") continue;
    const done = passComplete(o, profile);
    if (done === undefined) continue;
    const t = tried.get(passType(o.facts)) ?? [0, 0];
    t[1] += quantity(o);
    if (done) t[0] += quantity(o);
    tried.set(passType(o.facts), t);
  }
  const rate = (t: PassType) => {
    const [made, all] = tried.get(t) ?? [0, 0];
    return (made + K.PASS_PRIOR * K.PASS_PRIOR_RATE) / (all + K.PASS_PRIOR);
  };
  const ref = rate("ground");

  // possession, by the passes each side was narrated making: defending more is not defending better
  const passesOf = (team: "us" | "opponent") => obs.filter((o) => o.team === team && kindOf(o) === "pass").reduce((s, o) => s + quantity(o), 0);
  const theirs = passesOf("opponent");
  const all = theirs + passesOf("us");
  const padj = theirs > 0 && all > 0 ? Math.min(K.POSSESSION_RANGE[1], Math.max(K.POSSESSION_RANGE[0], 0.5 / (theirs / all))) : 1;

  const shotOfPass = new Map<string, Observation>();
  for (const o of obs) if ((kindOf(o) === "shot" || kindOf(o) === "goal") && o.links?.pass) shotOfPass.set(o.links.pass, o);

  // the same ball once: a «loss» after his own failed action, a recovery after his own won duel or tackle,
  // the actions the narration links as one; a failed pass the receiver then miscontrols is half each
  const skip = new Set<string>();
  const half = new Set<string>();
  const linked = new Set<string>();
  const failedTouch = (o: Observation) => ["pass", "reception", "control", "dribble", "carry"].includes(kindOf(o)) && (kindOf(o) === "pass" ? passComplete(o, profile) === false : bad(o));
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
    if ((k === "reception" || k === "control") && bad(o) && kindOf(p) === "pass" && passComplete(p, profile) === false && p.actorId !== o.actorId) {
      half.add(o.id);
      half.add(p.id);
    }
  });
  ours.forEach((o, i) => {
    const p = ours[i - 1];
    if (kindOf(o) === "loss" && p && half.has(p.id) && p.actorId === o.actorId) skip.add(o.id);
  });

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
            add(id, "Pase clave", "pase", q * (s ? shotXg(s.facts) : K.KEY_PASS_DEFAULT), true, q);
            if (s && s.team === "us" && (kindOf(s) === "goal" || s.facts.goal === true) && id) keyPassGoals.set(id, (keyPassGoals.get(id) ?? 0) + 1);
          } else if (t === "deep") add(id, "Pase en profundidad bueno", "pase", q * K.DEEP_PASS, true, q);
          else if (t === "cross") add(id, "Centro bueno", "pase", q * K.CROSS_COMPLETE, true, q);
          else if (f.direction === "backward") add(id, "Pase atrás", "pase", q * share * K.PASS_BACKWARD, true, q);
          else add(id, PASS_LABEL[t][0], "pase", q * share * K.PASS_COMPLETE * ((1 - rate(t)) / (1 - ref)), true, q);
          if (f.underPressure === true || f.switchOfPlay === true) add(id, "Pase bajo presión o cambio de orientación", "pase", q * K.PASS_PRESSURE_BONUS, true, q);
          if (o.receiverId && o.receiverId !== id) add(o.receiverId, "Pase recibido", "pase", q * K.PASS_RECEIVED, true, q);
        } else if (done === false) add(id, PASS_LABEL[t][1], "pase", q * share * K.PASS_FAIL * (rate(t) / ref) * (f.deflected === true ? 0.5 : 1) * h, true, q);
        break;
      }
      case "distribution":
        if (passComplete(o, profile) === true) add(id, "Saque del portero bueno", "pase", q * K.DISTRIBUTION_COMPLETE, true, q);
        else if (passComplete(o, profile) === false) add(id, "Saque del portero fallado", "pase", q * K.PASS_FAIL * (rate("goalkick") / ref), true, q);
        break;
      case "reception":
      case "control":
        if (bad(o)) add(id, "Control fallado", "pase", q * K.CONTROL_FAIL * h, true, q);
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
      case "shot":
        // the goals and the penalties come from the acta; a shot is worth its chance, a bit more on target
        if (f.goal === true || outcome(o) === "goal" || f.penalty === true) break;
        add(id, onTarget(o) ? "Remate a puerta" : "Remate fuera o bloqueado", "ataque", q * (shotXg(f) + (onTarget(o) ? K.ON_TARGET_BONUS : 0)), true, q);
        break;
      case "recovery":
        add(id, "Recuperación", "defensa", q * padj * K.RECOVERY * (f.zone === "own_area" ? K.OWN_AREA_FACTOR : 1), true, q);
        break;
      case "interception":
        add(id, "Intercepción", "defensa", q * padj * K.INTERCEPTION * (f.zone === "own_area" ? K.OWN_AREA_FACTOR : 1), true, q);
        break;
      case "clearance":
        if (bad(o)) add(id, "Despeje fallado", "defensa", q * K.CLEARANCE.failed, true, q);
        else add(id, "Despeje", "defensa", q * padj * (f.firstControl === "us" ? K.CLEARANCE.us : f.firstControl === "opponent" ? K.CLEARANCE.opponent : K.CLEARANCE.out), true, q);
        break;
      case "block": {
        if (f.subtype === "pass") {
          add(id, "Pase bloqueado", "defensa", q * K.BLOCKED_PASS, true, q);
          break;
        }
        const i = obs.indexOf(o);
        const shot = obs.slice(0, i).reverse().find((x) => x.team === "opponent" && kindOf(x) === "shot");
        add(id, "Remate bloqueado", "defensa", q * (shot ? shotXg(shot.facts) : K.XG.unknown), true, q);
        break;
      }
      case "tackle":
        if (ok(o)) add(id, "Entrada ganada", "defensa", q * padj * K.TACKLE_WON, true, q);
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
        add(id, "Error señalado en la narración", "errores", q * K.JUDGEMENT_ERROR, true, q);
        break;
      case "keeper":
        if (f.subtype === "cross_caught") add(id, "Centro atrapado", "porteria", q * K.CROSS_CAUGHT, true, q);
        else if (outcome(o) === "held" && f.subtype === undefined) add(id, "Balón atrapado", "porteria", q * K.BALL_CAUGHT, true, q);
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
    for (const o of obs) if (o.team === "us" && kindOf(o) === "context" && o.facts.chance === true) add(o.actorId, "Ocasión", "ataque", quantity(o) * K.XG.unknown);

  // the acta: goals, assists, cards, own goals and penalties are counted as it says (never scaled)
  const dangerBefore = (o: Observation) => {
    const i = obs.indexOf(o);
    const prev = obs.slice(0, i).reverse().find((x) => x.team === "opponent" && ["pass", "dribble", "carry", "shot", "reception", "control"].includes(kindOf(x)));
    const zone = prev && (prev.facts.destinationZone ?? prev.facts.zone);
    // (their zone, from their side: «opponent_area» is our area); our area when the narration does not say
    return typeof zone === "string" && zone in K.ZONE_INDEX ? K.ZONE_THREAT[K.ZONE_INDEX[zone]] : K.ZONE_THREAT[4];
  };
  for (const [id, r] of rows) {
    const scored = Math.max(0, (r.goals ?? 0) - (r.goalPenalty ?? 0));
    if (scored) add(id, "Gol", "ataque", scored * K.GOAL_VALUE, false, scored);
    if (r.goalPenalty) add(id, "Gol de penalti", "ataque", r.goalPenalty * (1 - K.PENALTY_GOAL), false, r.goalPenalty);
    if (r.assists) add(id, "Asistencia", "ataque", r.assists * K.ASSIST_BONUS + Math.max(0, r.assists - (keyPassGoals.get(id) ?? 0)) * K.KEY_PASS_DEFAULT, false, r.assists);
    if (r.penaltyMissed) add(id, "Penalti fallado", "ataque", -r.penaltyMissed * K.PENALTY_GOAL, false, r.penaltyMissed);
    if (r.penaltyReceived) add(id, "Penalti provocado", "ataque", r.penaltyReceived * (K.PENALTY_GOAL - K.ZONE_THREAT[4]), false, r.penaltyReceived);
    if (r.penaltySaved) add(id, "Penalti parado", "porteria", r.penaltySaved * K.PENALTY_GOAL, false, r.penaltySaved);
    if (r.ownGoals) add(id, "Gol en propia", "errores", r.ownGoals * K.OWN_GOAL, false, r.ownGoals);
    const sentOff = Math.max(r.redCards ?? 0, r.doubleYellows ?? 0);
    const yellows = Math.max(0, (r.yellowCards ?? 0) - 2 * (r.doubleYellows ?? 0));
    if (yellows) add(id, "Amarilla", "disciplina", yellows * K.YELLOW, false, yellows);
    if (sentOff) add(id, "Expulsión", "disciplina", sentOff * K.SENDING_OFF, false, sentOff);
    // a penalty committed costs what it changed: the penalty's goal probability minus the danger already there
    const narratedPens = penaltiesCommitted.get(id) ?? [];
    for (let i = 0; i < (r.penaltyCommitted ?? 0); i++) add(id, "Penalti cometido", "disciplina", -(K.PENALTY_GOAL - (narratedPens[i] ? dangerBefore(narratedPens[i]) : K.ZONE_THREAT[4])), false);
  }

  // a direct error before a goal against: our last action, failed, with the ball still in play
  const failed = (o: Observation) => failedTouch(o) || (kindOf(o) === "distribution" && passComplete(o, profile) === false) || (kindOf(o) === "duel" && (bad(o) || o.facts.beaten === true)) || kindOf(o) === "loss" || kindOf(o) === "judgement" || (kindOf(o) === "save" && (outcome(o) === "parried" || o.facts.subtype === "parried")) || (kindOf(o) === "discipline" && o.facts.subtype === "foul" && o.facts.tactical !== true);
  // (our last play of any kind, a restart included: a restart taken well is no error; any restart between,
  // ours or theirs, means the ball went dead)
  const ourPlay = (o: Observation) => o.team === "us" && !!o.actorId && !["context", "lineup", "substitution", "tactical"].includes(kindOf(o));
  obs.forEach((o, i) => {
    if (!isOpponentGoal(o) || o.facts.penalty === true) return;
    let j = i - 1;
    while (j >= 0 && !ourPlay(obs[j])) j--;
    if (j < 0 || !failed(obs[j])) return;
    const between = obs.slice(j + 1, i);
    if (between.some((x) => kindOf(x) === "restart") || between.filter((x) => x.team === "opponent").length > K.ERROR_WINDOW) return;
    add(obs[j].actorId, "Error que acaba en gol", "errores", K.ERROR_TO_GOAL, false);
  });

  // the keeper: goals prevented against the shots on target he faced, only when the goals tally with the acta
  // and it is proven who was in goal (a narrated GK interval, or the whole match at POR, not estimated)
  const goalsAgainst = obs.filter((o) => isOpponentGoal(o)).reduce((s, o) => s + quantity(o), 0);
  if (typeof m.goalsAgainst !== "number" || goalsAgainst === m.goalsAgainst) {
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
      const at = minute === null ? keepers.filter((k) => k.from === 0 && k.to === Infinity) : keepers.filter((k) => minute >= k.from && minute <= k.to);
      return at.length === 1 ? at[0].id : null;
    };
    const faced = new Map<string, { exp: number; conc: number; n: number }>();
    const face = (id: string | null, exp: number, goal: boolean) => {
      if (!id) return;
      const f = faced.get(id) ?? { exp: 0, conc: 0, n: 0 };
      f.exp += exp;
      f.conc += goal ? 1 : 0;
      f.n++;
      faced.set(id, f);
    };
    const theirShots = obs.filter((o) => o.team === "opponent" && kindOf(o) === "shot");
    if (theirShots.length) {
      for (const o of obs) {
        if (o.team !== "opponent" || o.facts.penalty === true) continue;
        if (isOpponentGoal(o)) face(keeperAt(minuteOf(o)), keeperProb(o.facts), true);
        else if (kindOf(o) === "shot" && onTarget(o) && o.facts.woodwork !== true && outcome(o) !== "woodwork") face(keeperAt(minuteOf(o)), keeperProb(o.facts), false);
      }
    } else {
      // la mesa: his saves and the goals, without the shots' detail
      for (const o of obs) {
        if (o.team === "us" && kindOf(o) === "save" && o.facts.penalty !== true && o.actorId) face(keepers.some((k) => k.id === o.actorId) ? o.actorId : null, quantity(o) * K.KEEPER_GOAL_PROB.unknown, false);
        else if (isOpponentGoal(o) && o.facts.penalty !== true) face(keeperAt(minuteOf(o)), K.KEEPER_GOAL_PROB.unknown, true);
      }
    }
    for (const [id, f] of faced) add(id, "Goles evitados", "porteria", f.exp - f.conc, false, f.n);
  }

  // plus-minus: the xG for and against with him on the pitch and off it (narrated matches with stints)
  const shots = narrated
    ? obs.filter((o) => (kindOf(o) === "shot" || kindOf(o) === "goal") && o.facts.ownGoal !== true && minuteOf(o) !== null).map((o) => ({ minute: minuteOf(o)!, ours: o.team === "us", xg: shotXg(o.facts) * quantity(o) }))
    : [];

  const players = new Map<string, PlayerMatchValue>();
  for (const [id, r] of rows) {
    const a = acc.get(id)!;
    const lines: Partial<Record<Line, number>> = {};
    let total = 0;
    for (const [code, min] of Object.entries(r.positionsPlayed ?? {}))
      if (isPosCode(code) && typeof min === "number" && min > 0) {
        lines[lineOf(code)] = (lines[lineOf(code)] ?? 0) + min;
        total += min;
      }
    for (const l of Object.keys(lines) as Line[]) lines[l] = lines[l]! / total;
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
    players.set(id, {
      minutes: known ? (typeof r.secondsPlayed === "number" && Number.isFinite(r.secondsPlayed) ? r.secondsPlayed / 60 : r.minutes) : null,
      lines,
      narrGood: a.narrGood,
      narrBad: a.narrBad,
      actaGood: a.actaGood,
      actaBad: a.actaBad,
      items: [...a.items.values()],
      plusMinus,
    });
  }
  return { narrated, volume, players };
}
