import { afterEach, describe, expect, it } from "vitest";
import { PREFS0, readPrefs } from "../pizarra/v2/prefs";
import {
  introSeen,
  markIntroSeen,
  parseProfilePrefs,
  PROFILE_PREFS0,
  readProfilePrefs,
  readSharedPrefs,
  shouldPlayIntro,
  writeProfilePrefs,
  writeSharedPrefs,
} from "./prefs";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("perfil · ajustes de este móvil", () => {
  it("por defecto: la salida solo la 1.ª vez y el brillo al inclinar activado", () => {
    expect(PROFILE_PREFS0).toEqual({ intro: "primera", tilt: true });
    expect(readProfilePrefs()).toEqual(PROFILE_PREFS0);
  });
  it("lo guardado se comprueba campo a campo", () => {
    expect(parseProfilePrefs(null)).toEqual(PROFILE_PREFS0);
    expect(parseProfilePrefs("{roto")).toEqual(PROFILE_PREFS0);
    expect(parseProfilePrefs("42")).toEqual(PROFILE_PREFS0);
    expect(parseProfilePrefs(JSON.stringify({ intro: "siempre", tilt: false }))).toEqual({ intro: "siempre", tilt: false });
    expect(parseProfilePrefs(JSON.stringify({ intro: "a veces", tilt: "no" }))).toEqual(PROFILE_PREFS0);
  });
  it("se guarda y se vuelve a leer", () => {
    writeProfilePrefs({ intro: "nunca", tilt: false });
    expect(readProfilePrefs()).toEqual({ intro: "nunca", tilt: false });
  });
  it("Sonido y Estadio en 3D son los mismos ajustes que la pizarra", () => {
    expect(readSharedPrefs()).toEqual({ sound: PREFS0.snd, stadium3d: PREFS0.v3 });
    writeSharedPrefs({ sound: true });
    expect(readPrefs().snd).toBe(true);
    expect(readPrefs().v3).toBe(PREFS0.v3);
    writeSharedPrefs({ stadium3d: false });
    expect(readPrefs()).toEqual({ ...PREFS0, snd: true, v3: false });
    expect(readSharedPrefs()).toEqual({ sound: true, stadium3d: false });
  });
  it("cambiar el sonido no toca el resto de la pizarra", () => {
    localStorage.setItem("mp_pizarra_v2_prefs", JSON.stringify({ ...PREFS0, grid: false, cam: "top" }));
    writeSharedPrefs({ sound: true });
    expect(readPrefs()).toMatchObject({ grid: false, cam: "top", snd: true });
  });
});

describe("perfil · cuándo sale la carta", () => {
  it("con menos movimiento, nunca", () => {
    expect(shouldPlayIntro("siempre", true, false)).toBe(false);
    expect(shouldPlayIntro("primera", true, false)).toBe(false);
  });
  it("cada vez, solo la primera de la visita o nunca", () => {
    expect(shouldPlayIntro("siempre", false, true)).toBe(true);
    expect(shouldPlayIntro("primera", false, false)).toBe(true);
    expect(shouldPlayIntro("primera", false, true)).toBe(false);
    expect(shouldPlayIntro("nunca", false, false)).toBe(false);
  });
  it("la visita recuerda que ya salió", () => {
    expect(introSeen()).toBe(false);
    markIntroSeen();
    expect(introSeen()).toBe(true);
  });
});
