// r14 «La pizarra» · Ajustes: the settings as they are right now, and what they change outside the sheet.
//  · prefsNow(P) / changePrefs(P, patch): the store's P.sel.prefs() comes from usePizarraPrefs through the page's
//    host, one render late after a change; a change is shown at once from here until the host catches up.
//  · applyPrefsCss(p): plates, galones and motion on every pitch of the pizarra (one injected <style>).
//  · sonar(kind): the pizarra's sounds, synthesised (no files), only after a gesture and only with «Sonidos» on.
//  · lessMotion(P): «Menos movimiento» or the system's reduced motion (places cut their animations with it).
import type { PzApi, PzPrefs } from "../../store/api";
import type { Camera, PlaceId } from "../../store/types";
import { parsePrefs, PREFS_DEFAULT } from "../../../data/prefs";

let pending: PzPrefs | null = null;
let pendingBase = "";
const keyOf = (p: PzPrefs) => JSON.stringify(p);

/** The settings now (a change just made, before the host's copy catches up; else the host's). */
export function prefsNow(P: Pick<PzApi, "sel">): PzPrefs {
  const live = P.sel.prefs();
  if (pending && pendingBase === keyOf(live)) return pending;
  pending = null;
  return live;
}
/** Change some settings: shown at once, written to the device and to your account (they follow you). */
export function changePrefs(P: Pick<PzApi, "sel" | "act">, patch: Partial<PzPrefs>): PzPrefs {
  const next = parsePrefs({ ...prefsNow(P), ...patch });
  pendingBase = keyOf(P.sel.prefs());
  pending = next;
  P.act.setPrefs(next);
  return next;
}
export const isDefaultPrefs = (p: PzPrefs): boolean => (Object.keys(PREFS_DEFAULT) as (keyof PzPrefs)[]).every((k) => p[k] === PREFS_DEFAULT[k]);
/** Only the settings this sheet changes (vozMute is the charla's own toggle). */
export const SHEET_KEYS = ["sonido", "camara", "capa", "nombre", "galones", "mov"] as const;
export const sheetDefault = (p: PzPrefs): boolean => SHEET_KEYS.every((k) => p[k] === PREFS_DEFAULT[k]);

export function systemReduced(): boolean {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
export const lessMotion = (P: Pick<PzApi, "sel">): boolean => prefsNow(P).mov === "menos" || systemReduced();

/** The CSS the settings put on every pitch of the pizarra. */
export function prefsCss(p: PzPrefs): string {
  const css: string[] = [];
  if (!p.nombre) css.push(".pz .pz-c:not(.pz-c--mini) .pz-c__plate{display:none!important}");
  if (!p.galones) css.push(".pz .pz-c .pz-c__gal{display:none!important}");
  if (p.mov === "menos")
    css.push(
      ".pz,.pz *,.pz *::before,.pz *::after{transition:none!important;animation:none!important}",
      "::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}",
    );
  return css.join("\n");
}
export function applyPrefsCss(p: PzPrefs): void {
  if (typeof document === "undefined" || !document.head) return;
  let el = document.getElementById("pz-prefs-style");
  if (!el) {
    el = document.createElement("style");
    el.id = "pz-prefs-style";
    document.head.appendChild(el);
  }
  el.textContent = prefsCss(p);
  document.documentElement.toggleAttribute("data-pz-menos", p.mov === "menos");
}
export function removePrefsCss(): void {
  if (typeof document === "undefined") return;
  document.getElementById("pz-prefs-style")?.remove();
  document.documentElement.removeAttribute("data-pz-menos");
}

// ── sounds ──────────────────────────────────────────────────────────────────────────────────────────────
export type SoundKind = "clac" | "grada" | "mezcla";
type AudioCtor = typeof AudioContext;
let AC: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const C = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined;
    if (!C) return null;
    if (!AC) AC = new C();
    if (AC.state === "suspended") void AC.resume();
    return AC;
  } catch {
    return null;
  }
}
function clac(a: AudioContext) {
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.07);
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + 0.12);
}
function grada(a: AudioContext) {
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 1.4);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = "bandpass";
  f.frequency.value = 900;
  f.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
  src.connect(f);
  f.connect(g);
  g.connect(a.destination);
  src.start(t);
  src.stop(t + 1.4);
}
/** Plays a sound when «Sonidos» is on (or `force`: «Probar»). false = it could not sound. */
export function sonar(P: Pick<PzApi, "sel"> | null, kind: SoundKind, force = false): boolean {
  if (!force && (!P || !prefsNow(P).sonido)) return false;
  const a = audio();
  if (!a) return false;
  try {
    if (kind === "grada") grada(a);
    else if (kind === "mezcla") {
      clac(a);
      setTimeout(() => {
        try {
          clac(a);
        } catch {
          /* the second click is a nicety */
        }
      }, 90);
    } else clac(a);
    return true;
  } catch {
    return false;
  }
}

/** The camera a place opens with when Ajustes says «Según el sitio» (store.stageDefaults' own rule). */
export function placeCamera(P: Pick<PzApi, "sel" | "state">, place: PlaceId | "perdido"): Camera {
  if (place === "partido" || place === "charla") return "grada";
  if (place === "siete") {
    const b = P.sel.board();
    if (b?.isOfficial && !P.sel.canEdit(b) && !P.sel.me().cap) return "grada";
  }
  return "pizarra";
}
