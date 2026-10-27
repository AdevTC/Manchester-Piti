// The «valoración Piti» behind GLOBAL: every number of the model in one place. An action's value is in goals
// (how much it changes our chance of scoring and the rival's), unless said otherwise. The decisions and why are
// in docs/medias.md; a change here is a new MODEL_VERSION.

/** v3 (2026-10-27): the volume of play by its rate and the one-off events whole, each position against its own,
 *  the team while he was on the pitch, the F7 chances; frozen with its acta (./frozen) like v2. */
export const MODEL_VERSION = "piti-media-v3";

// ── the match nota (0–10) and the season numbers
/** A normal match. */
export const NOTE_BASE = 6.5;
/** One point of nota is this many goals: fixed, so a nota never depends on the others'. */
export const NOTE_SCALE = 0.65;
/** Below this, a match gives no nota (Sofascore's rule). */
export const MIN_RATED_MINUTES = 10;
/** Within a match: minutes of his position's normal added to his volume of play, so a short stint does not explode. */
export const CUSHION_MINUTES = 10;
/** A position's normal starts from the team's (a keeper's from zero) with this many minutes, until it has more. */
export const POSITION_PRIOR_MINUTES = 200;
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
/** Where GLOBAL's words start (the mesa's form meter, the pizarra's FOR bar): Floja, Normal, Buena, Muy buena (oro). */
export const GLOBAL_BANDS = [55, 62, 68, TIER_ORO] as const;

// ── the team while he was on the pitch (in nota points per goal above what a normal match gives in his minutes)
/** [against, for] by line: the goals against weigh on the back, the goals for on the front; the keeper's saves
 *  are already his goals prevented. A player the acta does not place weighs as a midfielder. */
export const TEAM_WEIGHTS = { POR: [0.05, 0], DEF: [0.15, 0.05], MED: [0.1, 0.1], DEL: [0.05, 0.15] } as const;
/** A short stint is pulled toward the whole match's with this many of its minutes (the ridge of the adjusted plus-minus). */
export const TEAM_CUSHION_MINUTES = 25;

// ── zones: our chance of scoring in the next few actions with the ball there (own area … opponent area)
export const ZONE_THREAT = [0.005, 0.01, 0.02, 0.05, 0.12] as const;
/** (own_third is the defensive third outside the area; opponent_half, the rival's half short of its final third) */
export const ZONE_INDEX: Readonly<Record<string, number>> = { own_area: 0, own_third: 1, own_half: 1, middle_third: 2, opponent_half: 2, final_third: 3, opponent_area: 4 };

// ── shots
/** A shot's chance by the professional table; in F7 it is calibrated with the season (XG_PRIOR_GOALS). */
export const XG = { area: 0.12, outside: 0.04, head: 0.08, directFreekick: 0.05, unknown: 0.08 } as const;
/** The F7 calibration: the table × (goals + this) / (Σ its chances + this), over the season's non-penalty shots of both teams. */
export const XG_PRIOR_GOALS = 10;
export const ON_TARGET_BONUS = 0.02;
export const GOAL_VALUE = 1;
export const ASSIST_BONUS = 0.3;
/** A penalty's goal probability (Opta 0.79, StatsBomb 0.78; the F7 one, 9 m to a 6×2 goal, has the same angles);
 *  its net cost or gain is this minus the danger already there. */
export const PENALTY_GOAL = 0.78;
/** A shot on target's goal probability for the keeper: in the area, header, from outside, unknown (la mesa). */
export const KEEPER_GOAL_PROB = { area: 0.5, head: 0.35, outside: 0.25, unknown: 0.42 } as const;
/** A big chance (only with the club's declared criterion, bigChanceCriterion): created +, missed − (Sofascore). */
export const BIG_CHANCE = 0.1;

// ── passes
/** A pass made against one lost (+0,004 against −0,03): a pass is worth this × (1 − the team's completion of its
 *  kind) made and − this × that completion lost, so the average pass is worth 0 (ASA g+). */
export const PASS_SWING = 0.034;
/** The same for receiving a pass: received against miscontrolled (+0,002 against −0,03). */
export const RECEIVE_SWING = 0.032;
export const PASS_FAIL = -0.03;
export const PASS_PRESSURE_BONUS = 0.004;
export const DEEP_PASS = 0.05;
/** A cross that finds a teammate, or a pass into the area. */
export const CROSS_COMPLETE = 0.05;
/** A key pass without a linked shot is worth this chance. */
export const KEY_PASS_DEFAULT = 0.08;
/** A throw-in or a goal kick is worth this share of a pass, won or lost. */
export const RESTART_SHARE = 0.5;
/** Pass difficulty: the team's completion by type, with this prior (passes at PRIOR_RATE). */
export const PASS_PRIOR = 10;
export const PASS_PRIOR_RATE = 0.7;

// ── ball security and dribbling
export const LOSS = -0.03;
export const DRIBBLE_WON = 0.04;
/** A won dribble where the narration gives the zone: this plus the threat it gains (one zone forward). */
export const DRIBBLE_BASE = 0.01;
/** A failed dribble loses the ball: a loss. */
export const DRIBBLE_FAIL = -0.03;
export const CARRY_WON = 0.004;

// ── defending
export const RECOVERY = 0.03;
export const INTERCEPTION = 0.04;
/** In our own area a recovery or an interception is worth this much more. */
export const OWN_AREA_FACTOR = 2;
export const CLEARANCE = { us: 0.04, out: 0.02, opponent: 0.005, failed: -0.02 } as const;
export const BLOCKED_PASS = 0.02;
export const TACKLE_WON = 0.04;
export const TACKLE_FAIL = -0.02;
/** A tackle or an interception that cuts the ball without keeping it: this share of a won one. */
export const NEUTRAL_SHARE = 0.5;
export const DUEL_WON = 0.01;
export const DUEL_LOST = -0.01;
/** Beaten by a dribble: what the dribble gains. */
export const DUEL_BEATEN = -0.04;
export const PRESSURE_WON = 0.01;

// ── the keeper
/** A ball he holds where the rival was near our goal is an own-area recovery (RECOVERY × OWN_AREA_FACTOR); this
 *  when nobody threatened (after a rival clearance, or our own pass back). */
export const HARMLESS_CATCH = 0.01;
export const DISTRIBUTION_COMPLETE = 0.004;
/** His goals prevented are shrunk with this many shots on target of zero: n / (n + this). */
export const KEEPER_SHRINK_SHOTS = 15;

// ── errors and discipline (one-off events: counted whole, never per 50′)
export const ERROR_TO_GOAL = -0.1;
/** The goal must come within this many rival plays after our failed action, with no restart between… */
export const ERROR_WINDOW = 5;
/** …and at most this many rival passes: the error leads to it directly (Opta). */
export const ERROR_MAX_PASSES = 2;
export const JUDGEMENT_ERROR = -0.05;
export const FOUL = -0.01;
export const FOUL_RECEIVED = 0.01;
export const YELLOW = -0.05;
/** A sending-off: this plus SENDING_OFF_MATCH × the share of the match left (a red in the 1st minute ≈ −1,1 goals, StatsBomb). */
export const SENDING_OFF = -0.1;
export const SENDING_OFF_MATCH = -1;
export const OWN_GOAL = -0.8;

// ── the rival (the current table): good actions × factor, mistakes ÷ factor
export const RIVAL_MAX = 0.15;
/** Points (and goals) per match of a table row are shrunk with this many matches at the league's mean. */
export const RIVAL_PRIOR_MATCHES = 2;
/** A table more than this many jornadas behind our matches adjusts nothing. */
export const RIVAL_MAX_LAG = 2;

// ── plus-minus (measured, not counted until the J11 check)
export const PLUS_MINUS_ACTIVE = false;
export const PLUS_MINUS_CUSHION = 400;
export const PLUS_MINUS_CAP = 0.5;
