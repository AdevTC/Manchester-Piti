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

/** The stored choices, each one checked (anything unknown or broken falls back to the default). */
export function parsePrefs(raw: string | null): BoardPrefs {
  if (!raw) return PREFS0;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== "object") return PREFS0;
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
      v3: typeof o.v3 === "boolean" ? o.v3 : PREFS0.v3,
      show,
    };
  } catch {
    return PREFS0;
  }
}

export function readPrefs(): BoardPrefs {
  try {
    return parsePrefs(localStorage.getItem(KEY));
  } catch {
    return PREFS0;
  }
}

export function writePrefs(p: BoardPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: this visit only */
  }
}
