// r14 «La pizarra» · La charla: the captain's voice per step, for real. The clips live in lineups/{id}/voz under the
// CONTENT key of their step (data/voz.ts: siete:<pid>, jugada:<id>[:k], plan…), so a voice follows its player or its
// play when the charla is reordered. Recording is the browser's MediaRecorder (≤ 30 s, stops by itself), with the
// same helpers and Spanish errors as v2's voice (v2/voz.ts); playback is an <audio> the charla's clock drives.
import { useEffect, useMemo, useRef, useState } from "react";
import { removeVoz, saveVoz, useVozR14, vozByKey, VOZ_R14, type VozClipR14 } from "../../../data/voz";
import { blobToBase64, pickMime, VOZ_BPS, vozErrorTxt, vozSrc, vozSupport, vozSupportTxt } from "../../../v2/voz";

export type RecPhase = "idle" | "asking" | "rec" | "saving";
export interface CharlaVoz {
  clips: VozClipR14[];
  byKey: Map<string, VozClipR14>;
  /** Each content key's length (s). */
  lens: Map<string, number>;
  phase: RecPhase;
  /** The key being recorded and what it is about. */
  recKey: string | null;
  recWho: string;
  /** Seconds recorded so far. */
  elapsed: number;
  error: string | null;
  clearError(): void;
  /** Why this browser can't record (null = it can). */
  unsupported: string | null;
  record(key: string, who: string): void;
  stop(): void;
  cancel(): void;
  remove(key: string): Promise<VozClipR14 | null>;
  restore(c: VozClipR14): Promise<void>;
  /** Drive the player: the step's key, whether it should sound, and from where (s). */
  sync(key: string | null, on: boolean, at: number): void;
  /** The voice is really sounding (the browser may refuse autoplay). */
  sounding: boolean;
  blocked: boolean;
}

interface Live {
  mr: MediaRecorder;
  stream: MediaStream;
  t0: number;
  timer: number;
  tick: number;
  keep: boolean;
  key: string;
}

const now = (): number => Date.now();

export function useCharlaVoz(o: { boardId: string | null; on: boolean; uid: string; say: (t: string) => void }): CharlaVoz {
  const { clips } = useVozR14(o.boardId, o.on);
  const byKey = useMemo(() => vozByKey(clips), [clips]);
  const lens = useMemo(() => {
    const m = new Map<string, number>();
    byKey.forEach((c, k) => m.set(k, c.ms / 1000));
    return m;
  }, [byKey]);
  const [phase, setPhase] = useState<RecPhase>("idle");
  const [recKey, setRecKey] = useState<string | null>(null);
  const [recWho, setRecWho] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sounding, setSounding] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const live = useRef<Live | null>(null);
  const audio = useRef<{ el: HTMLAudioElement; key: string; id: string } | null>(null);
  const latest = useRef({ clips, byKey, o });
  useEffect(() => {
    latest.current = { clips, byKey, o };
  });
  const sup = typeof window === "undefined" ? "no-recorder" : vozSupport(window as unknown as Parameters<typeof vozSupport>[0]);
  const unsupported = sup === "ok" ? null : vozSupportTxt(sup);

  const stopAudio = () => {
    const a = audio.current;
    audio.current = null;
    if (a) {
      a.el.onended = null;
      a.el.onplaying = null;
      a.el.pause();
    }
    setSounding(false);
  };
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
  // nothing sounds or records once the charla closes
  useEffect(() => {
    if (!o.on) {
      discard();
      stopAudio();
    }
  }, [o.on]);
  useEffect(
    () => () => {
      discard();
      const a = audio.current;
      if (a) a.el.pause();
    },
    [],
  );

  const sync = (key: string | null, on: boolean, at: number) => {
    const c = key ? latest.current.byKey.get(key) : undefined;
    if (!c || !on || typeof Audio === "undefined" || at >= c.ms / 1000) {
      if (audio.current) stopAudio();
      return;
    }
    const id = c.slot + ":" + c.at + ":" + c.data.length;
    let a = audio.current;
    if (!a || a.id !== id) {
      stopAudio();
      const el = new Audio(vozSrc(c));
      a = { el, key: c.key, id };
      audio.current = a;
      el.onplaying = () => {
        setSounding(true);
        setBlocked(false);
      };
      el.onended = () => setSounding(false);
      el.onpause = () => setSounding(false);
      try {
        el.currentTime = at;
      } catch {
        /* not seekable yet: from the start */
      }
    } else if (!a.el.paused) return;
    const el = a.el;
    const p: Promise<void> | undefined = el.play();
    if (p !== undefined)
      p.catch(() => {
        if (audio.current?.el === el) setBlocked(true);
      });
  };

  const record = (key: string, who: string) => {
    if (phase !== "idle") return;
    if (unsupported) {
      setError(unsupported);
      o.say(unsupported);
      return;
    }
    setError(null);
    stopAudio();
    setPhase("asking");
    setRecKey(key);
    setRecWho(who);
    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        setPhase("idle");
        setRecKey(null);
        const m = vozErrorTxt(err);
        setError(m);
        latest.current.o.say(m);
        return;
      }
      if (!latest.current.o.on) {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("idle");
        setRecKey(null);
        return;
      }
      const mime = pickMime(typeof MediaRecorder.isTypeSupported === "function" ? (t) => MediaRecorder.isTypeSupported(t) : undefined);
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: VOZ_BPS });
      } catch (err) {
        stream.getTracks().forEach((t) => t.stop());
        setPhase("idle");
        setRecKey(null);
        const m = vozErrorTxt(err);
        setError(m);
        latest.current.o.say(m);
        return;
      }
      const chunks: Blob[] = [];
      const l: Live = { mr, stream, t0: now(), timer: 0, tick: 0, keep: true, key };
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
          setPhase("idle");
          setRecKey(null);
          return;
        }
        const ms = Math.min(VOZ_R14.ms, now() - l.t0);
        const type = (mr.mimeType || mime || chunks[0]?.type || "audio/webm").toLowerCase();
        setPhase("saving");
        void (async () => {
          const L = latest.current;
          try {
            if (!L.o.boardId) throw new Error("Guarda el tablero para poder grabar la voz.");
            const data = await blobToBase64(new Blob(chunks, { type }));
            await saveVoz(L.o.boardId, L.clips, l.key, { mime: type, ms, data }, L.o.uid);
            L.o.say("Voz guardada para «" + who + "» · " + Math.round(ms / 1000) + " s");
          } catch (err) {
            const m = err instanceof Error && err.message ? err.message : "No se ha podido guardar la voz.";
            setError(m);
            L.o.say(m);
          } finally {
            setPhase("idle");
            setRecKey(null);
          }
        })();
      };
      setElapsed(0);
      l.tick = window.setInterval(() => setElapsed(Math.min(VOZ_R14.ms / 1000, (now() - l.t0) / 1000)), 250);
      l.timer = window.setTimeout(() => {
        if (mr.state !== "inactive") mr.stop();
      }, VOZ_R14.ms);
      mr.start();
      setPhase("rec");
      latest.current.o.say("Grabando la voz para «" + who + "»: 30 segundos como mucho. Pulsa Parar al terminar.");
    })();
  };
  const stop = () => {
    const l = live.current;
    if (l && l.mr.state !== "inactive") l.mr.stop();
  };
  const cancel = () => {
    discard();
    setPhase("idle");
    setRecKey(null);
  };
  const remove = async (key: string): Promise<VozClipR14 | null> => {
    const L = latest.current;
    const c = L.byKey.get(key) ?? null;
    if (!c || !L.o.boardId) return null;
    if (audio.current?.key === key) stopAudio();
    try {
      await removeVoz(L.o.boardId, L.clips, key);
      return c;
    } catch {
      setError("No se ha podido borrar la voz.");
      return null;
    }
  };
  const restore = async (c: VozClipR14) => {
    const L = latest.current;
    if (!L.o.boardId) return;
    try {
      await saveVoz(L.o.boardId, L.clips, c.key, { mime: c.mime, ms: c.ms, data: c.data }, L.o.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido recuperar la voz.");
    }
  };
  return { clips, byKey, lens, phase, recKey, recWho, elapsed, error, clearError: () => setError(null), unsupported, record, stop, cancel, remove, restore, sync, sounding, blocked };
}
