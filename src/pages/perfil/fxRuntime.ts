// /profile «La carta»: the small browser effects — the rising beeps of a replayed walkout (only with
// Sonido on, the audio created inside the tap), the haptic taps, copying a link (with a fallback for
// browsers without the async clipboard), saving a file (the share image), the gyro permission on iOS and
// the error copy of the callables.

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audioCtor(): AudioCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
}

/**
 * The 24 rising «pitch» ticks while the rating rolls up (from 1.95 s of the walkout, 25 ms apart, as
 * designed). Call it inside the gesture (the ↻ tap): browsers only start audio there.
 */
export function playBeeps(): void {
  try {
    const Ctor = audioCtor();
    if (!Ctor) return;
    const ac = ctx ?? (ctx = new Ctor());
    if (ac.state === "suspended") ac.resume().catch(() => undefined);
    const t0 = ac.currentTime + 1.95;
    for (let i = 0; i < 24; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const t = t0 + i * 0.025;
      o.type = "square";
      o.frequency.value = 320 + i * 38;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + 0.04);
    }
  } catch {
    /* no audio on this device: the walkout plays silent */
  }
}

/** Saves a file on this device: an object URL on a hidden <a download>, revoked once the click has taken it. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A haptic tap, only in answer to a gesture: the intro's slams also buzz, and before any tap the browser blocks it (with a console error). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean; isActive: boolean } }).userActivation;
    if (ua && !(ua.hasBeenActive && ua.isActive)) return;
    navigator.vibrate(pattern);
  } catch {
    /* no vibration: nothing */
  }
}

/** Copies text; the async clipboard first, else a hidden textarea + execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try the old way */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

type OrientationCtor = { requestPermission?: () => Promise<"granted" | "denied"> };
/** Whether this browser asks before giving the gyro (iOS Safari). */
export function gyroNeedsPermission(): boolean {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  return typeof (window.DeviceOrientationEvent as unknown as OrientationCtor).requestPermission === "function";
}
/** Asks for the gyro (inside a tap). A refusal or an error just means no tilt: never an error shown. */
export async function askGyro(): Promise<boolean> {
  try {
    const req = (window.DeviceOrientationEvent as unknown as OrientationCtor).requestPermission;
    if (!req) return true;
    return (await req()) === "granted";
  } catch {
    return false;
  }
}

/** What a failed callable says to the member (the server's own Spanish copy when there is one). */
export function errorMessage(e: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return OFFLINE;
  const err = (e && typeof e === "object" ? e : {}) as { code?: unknown; message?: unknown };
  const code = typeof err.code === "string" ? err.code : "";
  if (code === "functions/unavailable" || code === "functions/internal" || code === "functions/not-found" || code === "functions/deadline-exceeded")
    return "No se puede conectar con el servicio del club. Inténtalo de nuevo en unos instantes.";
  if (code === "functions/unauthenticated") return "Tu sesión ha caducado: vuelve a entrar con tu Google.";
  const msg = typeof err.message === "string" ? err.message.trim() : "";
  return msg || "No se ha podido guardar. Vuelve a intentarlo.";
}
export const OFFLINE = "Sin conexión: no se ha guardado. Vuelve a intentarlo cuando tengas cobertura.";
export const isOffline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;
/** «already-exists» from a callable (a taken handle or shirt name). */
export const isTaken = (e: unknown): boolean => !!e && typeof e === "object" && (e as { code?: unknown }).code === "functions/already-exists";
