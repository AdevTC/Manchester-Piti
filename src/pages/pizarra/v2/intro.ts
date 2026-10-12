// La pizarra «Noche de partido» — the opening, once per visit (browser session): the 2D crane (lights,
// the board flies down, chalk lines, cromos dealt). The stadium's own intro (floodlights on, crane
// flyover, the players rise onto the grass, the 2D board hidden until it crossfades in) is opt-in:
// «Ver la presentación en 3D» (Ajustes) plays it where the device can and «3D» is on — the page never
// downloads three.js just to open. Later visits in the session find the board at rest, and with
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
  /** The person asked for it («Ver la presentación en 3D»): the 3D intro is opt-in, so opening the page
   *  never downloads three.js just for the opening. Absent = what this device keeps (intro3dWanted). */
  optIn?: boolean;
}

/** Which intro this visit gets: the 2D crane, or the 3D stadium's when asked for (and the device can). */
export function introKind({ rm, seen, v3, why3d, start, optIn }: IntroArgs): IntroKind {
  if (rm || seen || start === "charla") return "none";
  return start === "board" && v3 && (optIn ?? intro3dWanted()) && why3d() === null ? "3d" : "2d";
}

/** Where this device keeps «Ver la presentación en 3D». */
export const INTRO3D_KEY = "mp_pizarra_intro3d";

/** Whether the person asked to open the pizarra with the 3D presentation (this device). */
export function intro3dWanted(): boolean {
  try {
    return localStorage.getItem(INTRO3D_KEY) === "1";
  } catch {
    return false;
  }
}

/** «Ver la presentación en 3D» on or off (private mode: it can't be kept, it stays off). */
export function setIntro3dWanted(on: boolean): void {
  try {
    if (on) localStorage.setItem(INTRO3D_KEY, "1");
    else localStorage.removeItem(INTRO3D_KEY);
  } catch {
    /* private mode */
  }
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
