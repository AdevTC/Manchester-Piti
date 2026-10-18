// Whether a page gets the WebGL ground or keeps the designed still. Kept apart from the engine (no three.js).
//  - reduced motion (the prop or the media query) → the still, always;
//  - Save-Data / prefers-reduced-data → the still;
//  - no WebGL2 (three r170 needs it) → the still;
//  - under automation (navigator.webdriver) → the still, unless the page is being shot on purpose
//    (`window.__SHOT`, one frame and no loop), as the design canvas did.

export type StillReason = "server" | "reduced-motion" | "save-data" | "webdriver" | "no-webgl2";

type Win = Window & { __SHOT?: unknown };
interface NavigatorHints {
  webdriver?: boolean;
  connection?: { saveData?: boolean };
}

/** True while a screenshot tool asked for a single still frame of the WebGL scene. */
export function isShot(): boolean {
  return typeof window !== "undefined" && !!(window as Win).__SHOT;
}

function media(q: string): boolean {
  try {
    return window.matchMedia?.(q).matches ?? false;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && media("(prefers-reduced-motion: reduce)");
}

function webgl2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Why this device keeps the still, or null when the WebGL ground may start. */
export function stillReason(reduced?: boolean): StillReason | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "server";
  const shot = isShot();
  if (reduced || prefersReducedMotion()) return "reduced-motion";
  const nav = navigator as Navigator & NavigatorHints;
  if (!shot && (nav.connection?.saveData || media("(prefers-reduced-data: reduce)"))) return "save-data";
  if (nav.webdriver && !shot) return "webdriver";
  if (!webgl2()) return "no-webgl2";
  return null;
}
