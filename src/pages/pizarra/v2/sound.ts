// The board's small sounds (off by default): a «clac» when a cromo lands, a «flip» for the ficha and the
// rewind, the crowd for «¡Siete listo!» — filtered noise bursts, no files. Plus the haptic tap.
import { useEffect, useRef } from "react";

export type SoundKind = "clac" | "flip" | "crowd";

type AudioCtor = typeof AudioContext;

export function useBoardSound(on: boolean): (kind: SoundKind) => void {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      ctx.current?.close().catch(() => undefined);
      ctx.current = null;
    },
    [],
  );
  return (kind) => {
    if (!on || typeof window === "undefined") return;
    try {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return;
      const A = ctx.current ?? (ctx.current = new Ctor());
      const t = A.currentTime;
      const len = kind === "crowd" ? 1.8 : kind === "flip" ? 0.12 : 0.07;
      const b = A.createBuffer(1, Math.ceil(A.sampleRate * len), A.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (kind === "crowd" ? Math.sin((Math.PI * i) / d.length) : Math.pow(1 - i / d.length, 3));
      const src = A.createBufferSource();
      src.buffer = b;
      const f = A.createBiquadFilter();
      f.type = kind === "crowd" ? "lowpass" : "bandpass";
      f.frequency.value = kind === "crowd" ? 900 : kind === "flip" ? 3200 : 1700;
      f.Q.value = kind === "crowd" ? 0.7 : 1.4;
      const g = A.createGain();
      g.gain.setValueAtTime(kind === "crowd" ? 0.22 : 0.5, t);
      src.connect(f);
      f.connect(g);
      g.connect(A.destination);
      src.start(t);
    } catch {
      /* no audio here: the board stays silent */
    }
  };
}

/** A short vibration where the device has one (never throws). */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    /* vibration blocked */
  }
}
