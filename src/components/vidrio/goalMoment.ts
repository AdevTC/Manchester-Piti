// The goal, one orchestrated moment (PLAN-V «Signature moment»), pure: 0 ms the lens inhales (−6 %) · 120 ms it
// springs out · 200 ms the field floods gold · 320 ms a glint sweeps the glass · 450 ms the digit rolls ·
// 700 ms the scorer's name sets (width 75 → 100) · 900 ms the gold peak rises on the ribbon · 4 s it cools; a
// thin gold rim stays until the next play. The rival's goal: a cold coral flash, no gold. Reduced motion: the
// number just changes and the rim stays.
export type GoalStage = "idle" | "inhale" | "spring" | "flood" | "glint" | "roll" | "name" | "peak" | "cool";
export interface GoalMoment {
  /** Changes with each goal (the play's id). */
  key: string | number;
  side: "us" | "them";
}

export const GOAL_TIMELINE: readonly (readonly [number, GoalStage])[] = [
  [0, "inhale"],
  [120, "spring"],
  [200, "flood"],
  [320, "glint"],
  [450, "roll"],
  [700, "name"],
  [900, "peak"],
  [4000, "cool"],
];

const ORDER: readonly GoalStage[] = ["idle", "inhale", "spring", "flood", "glint", "roll", "name", "peak", "cool"];
const reached = (stage: GoalStage, at: GoalStage) => ORDER.indexOf(stage) >= ORDER.indexOf(at);

/** The stage `ms` after the goal. */
export function goalStageAt(ms: number): GoalStage {
  let stage: GoalStage = "idle";
  for (const [at, s] of GOAL_TIMELINE) if (ms >= at) stage = s;
  return stage;
}

export interface GoalClasses {
  stage: GoalStage;
  /** The moment is playing (inhale … peak). */
  active: boolean;
  /** On a wrapper of the glass: tints every glass surface gold while it plays (vd-goal / vd-goal--them). */
  root: string;
  /** On the Lens (goal prop) or the floating drop: the inhale and spring. */
  lens: string;
  /** VidrioSky's gold / cold props. */
  sky: { gold: boolean; cold: boolean };
  /** On the .vd-glint layer (Lens draws it). */
  glint: string;
  /** On the digit that changed. */
  digit: string;
  /** On the scorer's name. */
  name: string;
  /** MomentumRibbon's peakClassName. */
  peak: string;
  /** The thin gold rim (vd-rim-gold) — ours, until the next play. */
  rim: boolean;
}

/** The classes for a stage of a goal by `side`. */
export function goalClasses(stage: GoalStage, side: "us" | "them" | null): GoalClasses {
  const playing = stage !== "idle" && stage !== "cool";
  const us = side === "us";
  const them = side === "them";
  const at = (s: GoalStage) => playing && reached(stage, s);
  return {
    stage,
    active: playing,
    root: playing ? (us ? "vd-goal" : "vd-goal vd-goal--them") : "",
    lens: at("inhale") ? (us ? "vd-goal-lens" : "vd-goal-lens vd-goal-lens--them") : "",
    sky: { gold: us && at("flood"), cold: them && at("flood") },
    glint: us && at("glint") ? "vd-glint--sweep" : "",
    digit: at("roll") ? "vd-digit--roll" : "",
    name: us && at("name") ? "vd-scorer--set" : "",
    peak: us && at("peak") ? "vd-peak--rise" : "",
    rim: us && stage !== "idle",
  };
}
