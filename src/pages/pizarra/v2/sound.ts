// The board's small sounds (off by default, Ajustes or the header turn them on): a «clac» when a cromo
// lands, a «flip» when the química scoreboard flips (and for the ficha, the rewind and every cromo the
// charla turns), the crowd swelling for «¡Siete listo!» and «¡A por ellos!» — filtered noise bursts, no
// files. Nothing ever plays on its own: the audio is only created inside a user gesture (a tap, a key)
// while the sound is on; until then the board stays silent. Plus the haptic tap, also only in answer to
// a gesture.
import { useEffect, useRef } from "react";

export type SoundKind = "clac" | "flip" | "crowd";

type AudioCtor = typeof AudioContext;

/** The noise burst of each sound, as designed: length (s), filter, gain. */
export const SOUNDS: Record<SoundKind, { len: number; type: BiquadFilterType; freq: number; q: number; gain: number }> = {
  clac: { len: 0.07, type: "bandpass", freq: 1700, q: 1.4, gain: 0.5 },
  flip: { len: 0.12, type: "bandpass", freq: 3200, q: 1.4, gain: 0.5 },
  crowd: { len: 1.8, type: "lowpass", freq: 900, q: 0.7, gain: 0.22 },
};

function audioCtor(): AudioCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
}

/** Whether the page is inside a user gesture (where a browser lets audio start). */
export function inGesture(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return !!ua?.isActive;
}

/** Whether a sound may play now: the sound on, and the audio there already or a gesture to create it. */
export const canPlay = (on: boolean, hasAudio: boolean, gesture: boolean): boolean => on && (hasAudio || gesture);

function burst(A: AudioContext, kind: SoundKind): void {
  const s = SOUNDS[kind];
  const t = A.currentTime;
  const b = A.createBuffer(1, Math.ceil(A.sampleRate * s.len), A.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (kind === "crowd" ? Math.sin((Math.PI * i) / d.length) : Math.pow(1 - i / d.length, 3));
  const src = A.createBufferSource();
  src.buffer = b;
  const f = A.createBiquadFilter();
  f.type = s.type;
  f.frequency.value = s.freq;
  f.Q.value = s.q;
  const g = A.createGain();
  g.gain.setValueAtTime(s.gain, t);
  src.connect(f);
  f.connect(g);
  g.connect(A.destination);
  src.start(t);
}

/** The board's sound: `snd(kind)` plays it when the sound is on (never before a first gesture). */
export function useBoardSound(on: boolean): (kind: SoundKind) => void {
  const ctx = useRef<AudioContext | null>(null);
  const onNow = useRef(on);
  useEffect(() => {
    onNow.current = on;
    // turned off: the audio sleeps (it wakes on the next sound once turned on again)
    if (!on) ctx.current?.suspend().catch(() => undefined);
  }, [on]);
  /** Creates (or wakes) the audio; only call it inside a gesture. */
  const wake = (): AudioContext | null => {
    try {
      const Ctor = audioCtor();
      if (!Ctor) return null;
      const A = ctx.current ?? (ctx.current = new Ctor());
      if (A.state === "suspended") A.resume().catch(() => undefined);
      return A;
    } catch {
      return null;
    }
  };
  const wakeLatest = useRef(wake);
  useEffect(() => {
    wakeLatest.current = wake;
  });
  // The first tap or key with the sound on creates the audio (browsers only allow it in a gesture).
  useEffect(() => {
    const unlock = () => {
      if (onNow.current) wakeLatest.current();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      ctx.current?.close().catch(() => undefined);
      ctx.current = null;
    };
  }, []);
  return (kind) => {
    if (!canPlay(on, !!ctx.current, inGesture())) return;
    try {
      const A = wake();
      if (A) burst(A, kind);
    } catch {
      /* no audio here: the board stays silent */
    }
  };
}

/** Whether the page may vibrate now: only as the answer to a tap or a key (browsers block — and log —
 *  a vibration before the person has touched the page; and nothing that plays on its own buzzes). */
export function canBuzz(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean; isActive: boolean } }).userActivation;
  // (without the API, a browser that has vibrate does not gate it)
  return !ua || (ua.hasBeenActive && ua.isActive);
}

/** A short vibration where the device has one, in answer to a gesture (never throws). */
export function buzz(pattern: number | number[]): void {
  try {
    if (canBuzz()) navigator.vibrate(pattern);
  } catch {
    /* vibration blocked */
  }
}
