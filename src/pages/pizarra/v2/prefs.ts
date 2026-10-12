// What each member chooses for their own board (this device): sound, the grid in free mode, the
// camera, 3D, and what the cromos show. Not part of the lineup.
export type ShowKey = "num" | "name" | "pos" | "gal" | "chem" | "rt";
export type ShowPrefs = Record<ShowKey, boolean>;
export const SHOW0: ShowPrefs = { num: true, name: true, pos: true, gal: true, chem: false, rt: true };

export interface BoardPrefs {
  snd: boolean;
  grid: boolean;
  /** Estadio · TV or Cenital. */
  cam: "tv" | "top";
  /** 3D for the jugadas and the charla (where the device can). */
  v3: boolean;
  /** What the cromos show. */
  show: ShowPrefs;
}
export const PREFS0: BoardPrefs = { snd: false, grid: true, cam: "tv", v3: true, show: SHOW0 };

const KEY = "mp_pizarra_v2_prefs";

/** What the browser says about this device, for the 3D default (each one may be unknown). */
export interface DeviceHints {
  /** Save-Data, or prefers-reduced-data. */
  saveData?: boolean;
  /** navigator.deviceMemory (GB, rounded by the browser). */
  memory?: number;
  /** Only a coarse pointer (a phone or a tablet). */
  touch?: boolean;
}

/** The smallest memory (GB) that gets the 3D by default (the stadium itself needs 3; see support.ts). */
export const V3_DEFAULT_MEMORY = 4;

export function deviceHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const media = (q: string) => {
    try {
      return typeof window !== "undefined" && !!window.matchMedia?.(q).matches;
    } catch {
      return false;
    }
  };
  return {
    saveData: !!nav.connection?.saveData || media("(prefers-reduced-data: reduce)"),
    memory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    touch: media("(pointer: coarse)") && !media("(any-pointer: fine)"),
  };
}

/**
 * «Estadio 3D» starts on only where it is cheap: never with Save-Data, never on a phone or a tablet,
 * never with little memory. Elsewhere the first visit doesn't download three.js unless asked (Ajustes →
 * Estadio 3D turns it on, and the choice is kept).
 */
export function v3Default(h: DeviceHints = deviceHints()): boolean {
  if (h.saveData || h.touch) return false;
  return h.memory === undefined || h.memory >= V3_DEFAULT_MEMORY;
}

/** The stored choices, each one checked (anything unknown or broken falls back to the default; «3D»,
 *  never chosen, to what this device gets by default). */
export function parsePrefs(raw: string | null, v3d: boolean = v3Default()): BoardPrefs {
  const P0 = v3d === PREFS0.v3 ? PREFS0 : { ...PREFS0, v3: v3d };
  if (!raw) return P0;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== "object") return P0;
    const o = p as Record<string, unknown>;
    const show = { ...SHOW0 };
    if (o.show && typeof o.show === "object") {
      const s = o.show as Record<string, unknown>;
      (Object.keys(SHOW0) as ShowKey[]).forEach((k) => {
        if (typeof s[k] === "boolean") show[k] = s[k];
      });
    }
    return {
      snd: typeof o.snd === "boolean" ? o.snd : PREFS0.snd,
      grid: typeof o.grid === "boolean" ? o.grid : PREFS0.grid,
      cam: o.cam === "top" ? "top" : "tv",
      v3: typeof o.v3 === "boolean" ? o.v3 : v3d,
      show,
    };
  } catch {
    return P0;
  }
}

export function readPrefs(): BoardPrefs {
  const v3d = v3Default();
  try {
    return parsePrefs(localStorage.getItem(KEY), v3d);
  } catch {
    return parsePrefs(null, v3d);
  }
}

export function writePrefs(p: BoardPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: this visit only */
  }
}
