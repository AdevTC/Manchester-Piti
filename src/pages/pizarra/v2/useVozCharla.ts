// Bloque 5 · la voz en off during La charla: each step's clip plays when the step comes (unless the voice
// is muted on this device), the charla waits for it to finish before going on, and — on a board the user
// may edit — the step's voice is recorded (MediaRecorder, ≤ 30 s, stopping by itself), re-recorded or
// deleted. Where the browser can't record, it says why in Spanish. The clips are kept by the store
// (vozStore.ts); this hook never touches Firebase.
import { useEffect, useMemo, useRef, useState } from "react";
import { blobToBase64, pickMime, VOZ_BPS, VOZ_LIMITS, vozByStep, vozDe, vozErrorTxt, vozKey, vozSrc, vozStepTxt, vozSupport, vozSupportTxt, vozTime, type VozClip } from "./voz";
import type { VozStore } from "./vozStore";

const MUTE_KEY = "mp_pizarra_voz_mute";
/** The wall clock, for the recording's length (only ever read from events and timers). */
const clock = (): number => Date.now();
function readMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeMute(v: boolean) {
  try {
    if (v) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* storage can be off */
  }
}

export type VozRec = "idle" | "asking" | "rec" | "saving";

export interface VozCharlaArgs {
  store: VozStore | undefined;
  /** La charla is on screen (and not asking about the holes in the seven). */
  on: boolean;
  step: number;
  last: number;
  /** The charla plays by itself (then it waits for the voice). */
  playing: boolean;
  canEdit: boolean;
  /** Pause the charla (a voice is about to play, or a recording starts). */
  pause: () => void;
  /** Play the charla on again (the voice that held it has finished). */
  resume: () => void;
  announce: (msg: string) => void;
}

export interface VozCharlaApi {
  /** There is anything to show: a clip for this step, or a board where one can be recorded. */
  shown: boolean;
  key: string;
  stepTxt: string;
  clip: VozClip | null;
  count: number;
  muted: boolean;
  /** A clip is sounding now. */
  sounding: boolean;
  /** The browser refused to start the sound by itself: a tap plays it. */
  blocked: boolean;
  rec: VozRec;
  /** Seconds recorded so far (while recording). */
  elapsed: number;
  canRecord: boolean;
  /** Why it can't be recorded here (null = it can, or the board is not the user's). */
  why: string | null;
  error: string | null;
  toggleMute: () => void;
  play: () => void;
  record: () => void;
  stop: () => void;
  remove: () => void;
}

interface Live {
  mr: MediaRecorder;
  stream: MediaStream;
  t0: number;
  key: string;
  timer: number;
  tick: number;
  keep: boolean;
}

export function useVozCharla(a: VozCharlaArgs): VozCharlaApi {
  const { store, on, step, last } = a;
  const key = vozKey(step, last);
  const byStep = useMemo(() => vozByStep(store?.clips ?? []), [store?.clips]);
  const clip = byStep.get(key) ?? null;
  const [muted, setMuted] = useState(readMute);
  const [sounding, setSounding] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [rec, setRec] = useState<VozRec>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  /** The step whose voice holds the charla (it plays on when that voice ends). */
  const held = useRef<number | null>(null);
  const live = useRef<Live | null>(null);
  const latest = useRef(a);
  useEffect(() => {
    latest.current = a;
  });

  const support = typeof window === "undefined" ? "no-recorder" : vozSupport(window as unknown as Parameters<typeof vozSupport>[0]);
  const canRecord = a.canEdit && !!store?.stored && support === "ok";
  const why = a.canEdit ? (!store?.stored ? "Guarda el tablero para poder grabar la voz." : vozSupportTxt(support)) : null;

  // (the element's own events say when it sounds and when it stops: nothing is set while an effect runs)
  const stopAudio = () => {
    const el = audio.current;
    audio.current = null;
    if (el) {
      el.onended = null;
      el.onerror = null;
      el.pause();
    }
  };
  /** Plays the clip on screen; the charla waits for it while it plays by itself. */
  const startAudio = (c: VozClip, s: number) => {
    stopAudio();
    if (typeof Audio === "undefined") return;
    const el = new Audio(vozSrc(c));
    audio.current = el;
    const L = latest.current;
    if (L.playing && s < L.last) {
      held.current = s;
      L.pause();
    }
    const done = () => {
      if (audio.current !== el) return;
      audio.current = null;
      setSounding(false);
      const now = latest.current;
      if (held.current === s && now.step === s && now.on) {
        held.current = null;
        now.resume();
      }
    };
    el.onended = done;
    el.onerror = done;
    el.onplaying = () => {
      if (audio.current !== el) return;
      setBlocked(false);
      setSounding(true);
    };
    el.onpause = () => {
      if (audio.current == null || audio.current === el) setSounding(false);
    };
    // (older browsers return nothing from play())
    const p: Promise<void> | undefined = el.play();
    if (p !== undefined)
      p.catch(() => {
        // (autoplay refused: the voice waits for a tap, and so does the charla)
        if (audio.current !== el) return;
        audio.current = null;
        setSounding(false);
        setBlocked(true);
      });
  };

  // each step's voice when the step comes (and nothing when the charla closes or the voice is muted)
  const clipId = clip ? clip.slot + ":" + clip.at + ":" + clip.data.length : "";
  useEffect(() => {
    if (!on || muted || !clip || rec !== "idle") {
      stopAudio();
      return;
    }
    startAudio(clip, step);
    return () => stopAudio();
    // (the clip is named by clipId — a new array from the store with the same clip must not replay it — and
    // startAudio / stopAudio read the latest values through refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, muted, clipId, step, rec]);
  useEffect(() => {
    if (held.current != null && held.current !== step) held.current = null;
  }, [step]);

  // a recording never outlives the charla
  // (the recorder's own stop event puts the controls back: see onstop)
  const discard = () => {
    const l = live.current;
    if (!l) return;
    l.keep = false;
    try {
      if (l.mr.state !== "inactive") l.mr.stop();
    } catch {
      /* already stopped */
    }
    l.stream.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => {
    if (!on) discard();
  }, [on]);
  useEffect(
    () => () => {
      const l = live.current;
      if (l) {
        l.keep = false;
        l.stream.getTracks().forEach((t) => t.stop());
        try {
          if (l.mr.state !== "inactive") l.mr.stop();
        } catch {
          /* already stopped */
        }
      }
      const el = audio.current;
      if (el) el.pause();
    },
    [],
  );

  const record = async () => {
    if (!canRecord || rec !== "idle" || !store) return;
    setError(null);
    stopAudio();
    latest.current.pause();
    const k = key;
    setRec("asking");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setRec("idle");
      const m = vozErrorTxt(err);
      setError(m);
      latest.current.announce(m);
      return;
    }
    if (!latest.current.on) {
      stream.getTracks().forEach((t) => t.stop());
      setRec("idle");
      return;
    }
    const mime = pickMime(typeof MediaRecorder.isTypeSupported === "function" ? (t) => MediaRecorder.isTypeSupported(t) : undefined);
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: VOZ_BPS });
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRec("idle");
      const m = vozErrorTxt(err);
      setError(m);
      latest.current.announce(m);
      return;
    }
    const chunks: Blob[] = [];
    const l: Live = { mr, stream, t0: clock(), key: k, timer: 0, tick: 0, keep: true };
    live.current = l;
    mr.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    mr.onstop = () => {
      window.clearTimeout(l.timer);
      window.clearInterval(l.tick);
      stream.getTracks().forEach((t) => t.stop());
      if (live.current === l) live.current = null;
      if (!l.keep) {
        setRec("idle");
        return;
      }
      const ms = Math.min(VOZ_LIMITS.ms, clock() - l.t0);
      const type = (mr.mimeType || mime || chunks[0]?.type || "audio/webm").toLowerCase();
      setRec("saving");
      void (async () => {
        try {
          const data = await blobToBase64(new Blob(chunks, { type }));
          await store.save(l.key, { mime: type, ms, data });
          latest.current.announce("Voz guardada para " + vozStepTxt(l.key) + " (" + vozTime(ms) + ")");
        } catch (err) {
          const m = err instanceof Error && err.message ? err.message : "No se ha podido guardar la voz.";
          setError(m);
          latest.current.announce(m);
        } finally {
          setRec("idle");
        }
      })();
    };
    setElapsed(0);
    l.tick = window.setInterval(() => setElapsed(Math.min(VOZ_LIMITS.ms / 1000, Math.floor((clock() - l.t0) / 1000))), 250);
    l.timer = window.setTimeout(() => {
      if (mr.state !== "inactive") mr.stop();
    }, VOZ_LIMITS.ms);
    mr.start();
    setRec("rec");
    latest.current.announce("Grabando la voz para " + vozStepTxt(k) + ": 30 segundos como mucho. Pulsa «Parar» al terminar.");
  };
  const stop = () => {
    const l = live.current;
    if (!l) return;
    if (l.mr.state !== "inactive") l.mr.stop();
  };
  const remove = async () => {
    if (!store || !clip || !a.canEdit) return;
    stopAudio();
    try {
      await store.remove(key);
      a.announce("Voz borrada " + vozDe(key));
    } catch {
      const m = "No se ha podido borrar la voz.";
      setError(m);
      a.announce(m);
    }
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    writeMute(next);
    a.announce(next ? "Voz de la charla silenciada" : "Voz de la charla activada");
  };
  const play = () => {
    if (clip) startAudio(clip, step);
  };

  return {
    shown: !!store && on && (!!clip || a.canEdit),
    key,
    stepTxt: vozStepTxt(key),
    clip,
    count: byStep.size,
    muted,
    sounding,
    blocked,
    rec,
    elapsed,
    canRecord,
    why,
    error,
    toggleMute,
    play,
    record: () => void record(),
    stop,
    remove: () => void remove(),
  };
}
