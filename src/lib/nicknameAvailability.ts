// Pure decision logic for the NicknameSetup inline "taken" error. Extracted so
// the effect's transition table (especially the backspace-to-invalid edge) is
// unit-testable without React. No React, no Firestore.

/** Inputs the effect has at the moment it decides what to do with the field error. */
export interface NicknameErrorInputs {
  /** The current valid (schema-passing, normalized) nickname, or null if invalid. */
  validNickname: string | null;
  /** The debounced value the availability query ran for (or null). */
  debouncedNickname: string | null;
  /** Has the availability query settled successfully for `debouncedNickname`? */
  availabilitySuccess: boolean;
  /** The settled availability result: true = available, false = taken (else undefined/in-flight). */
  available: boolean | undefined;
  /** Do WE currently own the manual "taken" error (set on a previous run)? */
  ownsTakenError: boolean;
}

/** What the effect should do with the manual "taken" error this run. */
export type NicknameErrorAction = "set" | "clear" | "release" | "none";

/**
 * Decide the action for the inline "taken" error:
 *  - "set":     this valid value settled as TAKEN → show the manual error (we own it).
 *  - "clear":   this same valid value settled as AVAILABLE while we owned the error → clear it.
 *  - "release": value became invalid → drop ownership WITHOUT clearing (Zod owns the field now).
 *  - "none":    nothing to do (in-flight, or we never owned an error).
 *
 * Key edge (fix #1): when the value becomes invalid we MUST release ownership
 * without clearing, so a later valid keystroke doesn't fire a stale "clear"
 * that stomps Zod's length/regex error before availability is even known.
 * Clearing only ever happens once the SAME valid value settles as available.
 */
export function decideNicknameError(input: NicknameErrorInputs): NicknameErrorAction {
  if (!input.validNickname) {
    return input.ownsTakenError ? "release" : "none";
  }
  const settledForCurrent = input.validNickname === input.debouncedNickname && input.availabilitySuccess;
  if (settledForCurrent && input.available === false) return "set";
  if (input.ownsTakenError && settledForCurrent) return "clear";
  return "none";
}
