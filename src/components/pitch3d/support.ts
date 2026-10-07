// Whether this device gets the 3D stadium. Kept apart from the engine (no three.js here) so the
// host can decide on its 2D board without downloading the 3D chunk. The 3D never starts:
//  - under automation (navigator.webdriver: Playwright, e2e, layout audits). A headless browser
//    renders WebGL in software (SwiftShader), which can take the whole machine down;
//  - when the person asks for less motion or less data (prefers-reduced-motion / -data, Save-Data);
//  - on devices with little memory (navigator.deviceMemory < 3 GB);
//  - without WebGL2.

export type Unsupported = "webdriver" | "reduced-motion" | "save-data" | "low-memory" | "no-webgl2";

/** Smallest navigator.deviceMemory (GB, as the browser rounds it) that gets the 3D. */
export const MIN_DEVICE_MEMORY = 3;

interface NavigatorHints {
  webdriver?: boolean;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function webgl2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    // give the probe context back at once: browsers cap the live contexts per page
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Why the 3D is off on this device, or null if it can run. The cheap checks go first. */
export function unsupportedReason(): Unsupported | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "no-webgl2";
  const nav = navigator as Navigator & NavigatorHints;
  if (nav.webdriver) return "webdriver";
  const media = (q: string) => {
    try {
      return window.matchMedia?.(q).matches ?? false;
    } catch {
      return false;
    }
  };
  if (media("(prefers-reduced-motion: reduce)")) return "reduced-motion";
  if (nav.connection?.saveData || media("(prefers-reduced-data: reduce)")) return "save-data";
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < MIN_DEVICE_MEMORY) return "low-memory";
  if (!webgl2()) return "no-webgl2";
  return null;
}

/** True when the 3D stadium may start on this device (else the host keeps its 2D board). */
export function supported(): boolean {
  return unsupportedReason() === null;
}
