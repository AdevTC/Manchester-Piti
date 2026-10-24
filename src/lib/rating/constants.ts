// The «valoración Piti» behind GLOBAL: every number of the model in one place. An action's value is in goals
// (how much it changes our chance of scoring and the rival's), unless said otherwise. The decisions and why are
// in docs/medias.md; a change here is a new MODEL_VERSION.

export const MODEL_VERSION = "piti-media-v1";

// ── the match nota (0–10) and the season numbers
/** A normal match. */
export const NOTE_BASE = 6.5;
/** Below this, a match gives no nota (Sofascore's rule). */
export const MIN_RATED_MINUTES = 10;
/** Within a match: minutes of his line's mean added to his value, so a short stint does not explode. */
export const CUSHION_MINUTES = 10;
/** A line's mean counts as this many teammate-matches of the team's mean until it has more. */
export const LINE_PRIOR = 4;
/** The spread of the season's values never goes below this (goals per 50′). */
export const SD_FLOOR = 0.15;
/** From here a match counts whole in GLOBAL and FOR; below, in proportion (15′ = half a match). */
export const FULL_MATCH_MINUTES = 30;
/** GLOBAL starts from this many matches of NOTE_BASE; FOR from FORM_CUSHION. */
export const SEASON_CUSHION = 3;
export const FORM_CUSHION = 1;
export const FORM_MATCHES = 5;
/** A match without narration (acta and la mesa only) weighs this much in GLOBAL and FOR. */
export const UNNARRATED_WEIGHT = 0.5;
/** A match is narrated from this many actions of ours in the narration. */
export const NARRATED_MIN_ACTIONS = 30;
/** GLOBAL is «provisional» until this many minutes with a nota. */
export const PROVISIONAL_MINUTES = 150;
export const TIER_ORO = 75;
export const TIER_PLATA = 65;

// ── zones: our chance of scoring in the next few actions with the ball there (own area … opponent area)
export const ZONE_THREAT = [0.005, 0.01, 0.02, 0.05, 0.12] as const;
export const ZONE_INDEX: Readonly<Record<string, number>> = { own_area: 0, own_half: 1, middle_third: 2, final_third: 3, opponent_area: 4 };

// ── shots
export const XG = { area: 0.12, outside: 0.04, head: 0.08, directFreekick: 0.05, unknown: 0.08 } as const;
export const ON_TARGET_BONUS = 0.02;
export const GOAL_VALUE = 1;
export const ASSIST_BONUS = 0.3;
/** A penalty's goal probability (its net cost or gain is this minus the danger already there). */
export const PENALTY_GOAL = 0.7;
/** A shot on target's goal probability for the keeper: in the area, header, from outside, unknown (la mesa). */
export const KEEPER_GOAL_PROB = { area: 0.5, head: 0.35, outside: 0.25, unknown: 0.42 } as const;

// ── passes
export const PASS_COMPLETE = 0.004;
export const PASS_BACKWARD = 0.002;
export const PASS_FAIL = -0.03;
export const PASS_PRESSURE_BONUS = 0.004;
export const PASS_RECEIVED = 0.002;
export const DEEP_PASS = 0.05;
export const CROSS_COMPLETE = 0.05;
/** A key pass without a linked shot is worth this. */
export const KEY_PASS_DEFAULT = 0.08;
/** A throw-in or a goal kick is worth this share of a pass, won or lost. */
export const RESTART_SHARE = 0.5;
/** Pass difficulty: the team's completion by type, with this prior (passes at PRIOR_RATE). */
export const PASS_PRIOR = 10;
export const PASS_PRIOR_RATE = 0.7;

// ── ball security and dribbling
export const LOSS = -0.03;
export const CONTROL_FAIL = -0.03;
export const DRIBBLE_WON = 0.04;
/** A won dribble where the narration gives the zone: this plus the threat it gains (one zone forward). */
export const DRIBBLE_BASE = 0.01;
export const DRIBBLE_FAIL = -0.015;
export const CARRY_WON = 0.004;

// ── defending (× the possession adjustment)
export const RECOVERY = 0.03;
export const INTERCEPTION = 0.04;
/** In our own area a recovery or an interception is worth this much more. */
export const OWN_AREA_FACTOR = 2;
export const CLEARANCE = { us: 0.04, out: 0.02, opponent: 0.005, failed: -0.02 } as const;
export const BLOCKED_PASS = 0.02;
export const TACKLE_WON = 0.04;
export const TACKLE_FAIL = -0.02;
export const DUEL_WON = 0.01;
export const DUEL_LOST = -0.01;
export const DUEL_BEATEN = -0.03;
export const PRESSURE_WON = 0.01;
/** The possession adjustment (0.5 / the rival's share of the passes) stays in this range. */
export const POSSESSION_RANGE = [0.7, 1.3] as const;

// ── the keeper
export const CROSS_CAUGHT = 0.04;
export const BALL_CAUGHT = 0.01;
export const DISTRIBUTION_COMPLETE = 0.004;

// ── errors and discipline (not scaled by the narration's volume)
export const ERROR_TO_GOAL = -0.1;
/** The goal must come within this many rival plays after our failed action, with no restart between. */
export const ERROR_WINDOW = 5;
export const JUDGEMENT_ERROR = -0.05;
export const FOUL = -0.01;
export const FOUL_RECEIVED = 0.01;
export const YELLOW = -0.05;
export const SENDING_OFF = -0.3;
export const OWN_GOAL = -0.8;

// ── the rival (the current table): good actions × factor, mistakes ÷ factor
export const RIVAL_MAX = 0.15;
/** Points per match of a table row are shrunk with this many matches at the league's mean. */
export const RIVAL_PRIOR_MATCHES = 2;
/** A table more than this many jornadas behind our matches adjusts nothing. */
export const RIVAL_MAX_LAG = 2;

// ── plus-minus (measured, not counted until the J11 check)
export const PLUS_MINUS_ACTIVE = false;
export const PLUS_MINUS_CUSHION = 400;
export const PLUS_MINUS_CAP = 0.5;
