// /profile › Ajustes on this device: «Salida de la carta» (the walkout intro) and «Brillo al inclinar»
// (gyro/pointer tilt). «Sonido» and «Estadio en 3D» are the pizarra's own prefs (snd, v3): the profile
// reads and writes those same values so both pages always agree.
import { readPrefs as readBoardPrefs, writePrefs as writeBoardPrefs } from "../pizarra/v2/prefs";

export type IntroPref = "siempre" | "primera" | "nunca";
export interface ProfilePrefs {
  /** Cada vez · Solo la 1.ª (once per visit) · Nunca. */
  intro: IntroPref;
  /** The card's foil and glare follow the phone (or the pointer). */
  tilt: boolean;
}
export const PROFILE_PREFS0: ProfilePrefs = { intro: "primera", tilt: true };

const KEY = "mp_perfil_prefs";
const SEEN_KEY = "mp_perfil_intro_seen";

/** The stored choices, each one checked (anything unknown or broken falls back to the default). */
export function parseProfilePrefs(raw: string | null): ProfilePrefs {
  if (!raw) return PROFILE_PREFS0;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== "object") return PROFILE_PREFS0;
    const o = p as Record<string, unknown>;
    return {
      intro: o.intro === "siempre" || o.intro === "primera" || o.intro === "nunca" ? o.intro : PROFILE_PREFS0.intro,
      tilt: typeof o.tilt === "boolean" ? o.tilt : PROFILE_PREFS0.tilt,
    };
  } catch {
    return PROFILE_PREFS0;
  }
}
export function readProfilePrefs(): ProfilePrefs {
  try {
    return parseProfilePrefs(localStorage.getItem(KEY));
  } catch {
    return PROFILE_PREFS0;
  }
}
export function writeProfilePrefs(p: ProfilePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: this visit only */
  }
}

/** «Sonido» and «Estadio en 3D»: the pizarra's prefs, shared. */
export interface SharedPrefs {
  sound: boolean;
  stadium3d: boolean;
}
export function readSharedPrefs(): SharedPrefs {
  const b = readBoardPrefs();
  return { sound: b.snd, stadium3d: b.v3 };
}
/** Changes only these two values; the rest of the pizarra's prefs stay as they are. */
export function writeSharedPrefs(next: Partial<SharedPrefs>): SharedPrefs {
  const b = readBoardPrefs();
  const merged = { ...b, ...(next.sound !== undefined ? { snd: next.sound } : {}), ...(next.stadium3d !== undefined ? { v3: next.stadium3d } : {}) };
  writeBoardPrefs(merged);
  return { sound: merged.snd, stadium3d: merged.v3 };
}

/** Whether the walkout plays: never with reduced motion; «Solo la 1.ª» = once per visit (session). */
export function shouldPlayIntro(pref: IntroPref, reducedMotion: boolean, sessionSeen: boolean): boolean {
  if (reducedMotion || pref === "nunca") return false;
  return pref === "siempre" || !sessionSeen;
}
export function introSeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: it plays again next time */
  }
}
