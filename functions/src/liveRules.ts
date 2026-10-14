// Small shared rules of the "modo banda", with no imports so the app can load them without the engine:
// the callable (live.ts) applies them, the app's catalogue of live actions (src/lib/liveActions.ts) reads them.

/** The only plays that can be written live during the break (halftime): changes and cards. */
export const LIVE_AT_BREAK = ["substitution", "yellow_card", "double_yellow", "red_card"] as const;
const AT_BREAK = new Set<string>(LIVE_AT_BREAK);
/** Whether a live event of this type can be written during the break. */
export const allowedAtBreak = (type: string): boolean => AT_BREAK.has(type);
