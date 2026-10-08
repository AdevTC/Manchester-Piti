// La pizarra «Noche de partido» — the opening, once per visit (browser session): where the device can
// and «3D» is on, the stadium's own intro (floodlights on, crane flyover, the players rise onto the
// grass) with the 2D board hidden, then the board crossfades in; else the 2D crane (lights, the board
// flies down, chalk lines, cromos dealt). Later visits in the session find the board at rest, and with
// reduced motion there is no intro at all. Pure, plus the session flag.
import type { Unsupported } from "../../../components/pitch3d/support";

export const INTRO_KEY = "mp_pizarra_intro";

/** How long the 3D intro may wait for the stadium once the board is there (ms), as designed. */
export const INTRO_WAIT_MS = 2000;
/** The 3D intro never runs longer than this (ms): then the board is shown anyway. */
export const INTRO_MAX_MS = 3500;
/** The 2D crane intro (ms), as designed. */
export const INTRO_2D_MS = 3300;
/** The cromos deal in after the 3D intro (ms). */
export const DEAL_MS = 1500;

export type IntroKind = "3d" | "2d" | "none";

export interface IntroArgs {
  /** prefers-reduced-motion. */
  rm: boolean;
  /** The intro already played in this session. */
  seen: boolean;
  /** «3D» on in Ajustes. */
  v3: boolean;
  /** Why the device can't have the 3D (null = it can; only asked when it matters). */
  why3d: () => Unsupported | null;
  /** Where the page opened: straight on the charla (it has its own opening: no intro), on the jugadas
   *  (their replay owns the stadium: the 2D intro) or on the board. */
  start: "charla" | "jugadas" | "board";
}

/** Which intro this visit gets. */
export function introKind({ rm, seen, v3, why3d, start }: IntroArgs): IntroKind {
  if (rm || seen || start === "charla") return "none";
  return start === "board" && v3 && why3d() === null ? "3d" : "2d";
}

/** Whether the intro already played in this browser session. */
export function introSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

/** The intro has played (or started): later visits in this session find the board at rest. */
export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* private mode: it may play again on the next visit */
  }
}
