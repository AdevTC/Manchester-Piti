// Small presentational hooks for the mesa screens: a ticking «now», a one-shot CSS flash when a value
// changes (the LED digit flip, a count bump), and the phone's feedback (vibration, a short beep).
import { useEffect, useRef, useState } from "react";

/** Date.now(), refreshed every `ms`. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Restarts `cls` on the element whenever `value` changes after the first render (never on mount). */
export function useFlash<T extends HTMLElement>(value: unknown, cls: string) {
  const ref = useRef<T>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    const el = ref.current;
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }, [value, cls]);
  return ref;
}

/** A vibration where the phone supports it. */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported: silence is fine */
  }
}
export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

interface AudioCtor {
  new (): AudioContext;
}
/** A short sine beep (the «Probar aviso» test). */
export function beep(freq = 880, ms = 140) {
  try {
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const C = w.AudioContext ?? w.webkitAudioContext;
    if (!C) return;
    const c = new C();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.05);
    o.onended = () => void c.close();
  } catch {
    /* no audio here */
  }
}
