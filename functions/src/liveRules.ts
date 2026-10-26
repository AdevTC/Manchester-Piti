// Small shared rules of the "modo banda", with no imports so the app can load them without the engine:
// the callable (live.ts) applies them, the app's catalogue of live actions (src/lib/liveActions.ts) reads them.

/** La mesa's whole live catalogue (functions/src/liveLogic LIVE_TYPES is this list). */
export const MESA_TYPES = [
  "goal", "goal_penalty", "goal_freekick", "opponent_goal", "opponent_own_goal", "own_goal",
  "yellow_card", "double_yellow", "red_card", "penalty_saved", "penalty_missed", "woodwork", "substitution", "position_swap",
  "chance", "opponent_chance", "corner", "opponent_corner",
  "foul", "foul_received", "save", "injury", "penalty_received", "penalty_committed",
  "opponent_foul", "opponent_woodwork", "opponent_offside", "opponent_yellow", "opponent_red", "opponent_penalty_missed",
] as const;
export type MesaType = typeof MESA_TYPES[number];
/** The only plays that can be written live during the break (or a pause): changes, recolocaciones, cards and knocks. */
export const LIVE_AT_BREAK = ["substitution", "position_swap", "yellow_card", "double_yellow", "red_card", "opponent_yellow", "opponent_red", "injury"] as const;
const AT_BREAK = new Set<string>(LIVE_AT_BREAK);
/** Whether a live event of this type can be written during the break. */
export const allowedAtBreak = (type: string): boolean => AT_BREAK.has(type);
