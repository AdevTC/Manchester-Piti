// «La jugada en vídeo»: records the jugada on screen (clip.ts) and hands it to the group (share sheet,
// else a download). Behind feature detection: a browser that can't record says so, in Spanish, and
// offers nothing to press. Used in Jugadas and in Compartir.
import { useEffect, useRef, useState } from "react";
import type { Play } from "../plays";
import { Icon } from "./icons";
import { download, type ShareResult } from "./cartel";
import { browserClock, CLIP_H, CLIP_W, clipFile, clipLength, clipSupport, drawClipFrame, recordClip, shareClip, type ClipCtx, type ClipJob, type ClipSupport, type Clock, type CaptureCanvas } from "./clip";

/** What the clip needs from the browser (tests pass fakes). */
export interface ClipEnv {
  support: () => ClipSupport;
  clock: Clock;
  canvas: () => (CaptureCanvas & { width: number; height: number; getContext(k: "2d"): unknown }) | null;
  share: (blob: Blob, file: string, title: string) => Promise<ShareResult>;
  save: (blob: Blob, file: string) => void;
}
const browserEnv: ClipEnv = {
  support: () => clipSupport(),
  clock: browserClock,
  canvas: () => (typeof document === "undefined" ? null : document.createElement("canvas")),
  share: (b, f, t) => shareClip(b, f, t),
  save: download,
};

type St = { k: "idle" } | { k: "rec"; pct: number } | { k: "ready"; blob: Blob; file: string } | { k: "error"; msg: string };

export interface ClipExportProps {
  play: Play;
  who: Record<string, { num: number; name: string }>;
  /** «J8 · MAD SKY» or the board's name (in the clip's corner). */
  head: string;
  /** The replay's speed (0.5, 1 or 1.5): the clip plays at it. */
  rate: number;
  /** The board's one announcer. */
  say: (msg: string) => void;
  env?: ClipEnv;
}

export function ClipExport({ play, who, head, rate, say, env = browserEnv }: ClipExportProps) {
  const [sup] = useState(env.support);
  const [st, setSt] = useState<St>({ k: "idle" });
  const job = useRef<ClipJob | null>(null);
  useEffect(() => () => job.current?.cancel(), []);
  const secs = Math.round(clipLength(play.frames.length, rate) / 1000);
  if (!sup.ok) {
    return (
      <p className="soon dr-clip-no">
        <Icon n="film" w={16} />
        <span>{sup.why}</span>
      </p>
    );
  }
  const start = () => {
    const canvas = env.canvas();
    const ctx = canvas?.getContext("2d") as ClipCtx | null | undefined;
    if (!canvas || !ctx) {
      setSt({ k: "error", msg: "Este navegador no puede dibujar el vídeo." });
      say("Este navegador no puede dibujar el vídeo.");
      return;
    }
    canvas.width = CLIP_W;
    canvas.height = CLIP_H;
    const ms = clipLength(play.frames.length, rate);
    const scene = { play, who, head };
    const j = recordClip({
      canvas,
      Recorder: sup.Recorder,
      mime: sup.mime,
      ms,
      clock: env.clock,
      draw: (t) => drawClipFrame(ctx, scene, t, ms),
      onProgress: (p) => setSt((s) => (s.k === "rec" && s.pct !== Math.round(p * 100) ? { k: "rec", pct: Math.round(p * 100) } : s)),
    });
    job.current = j;
    setSt({ k: "rec", pct: 0 });
    say("Grabando la jugada en vídeo (" + Math.round(ms / 1000) + " segundos)");
    j.done.then(
      (blob) => {
        if (job.current !== j) return;
        job.current = null;
        setSt({ k: "ready", blob, file: clipFile(play.name, sup.mime) });
        say("Vídeo listo: mándalo al grupo o descárgalo");
      },
      (err: unknown) => {
        if (job.current !== j) return;
        job.current = null;
        if (err instanceof Error && err.name === "AbortError") {
          setSt({ k: "idle" });
          say("Grabación cancelada");
          return;
        }
        console.error("No se pudo grabar la jugada", err);
        setSt({ k: "error", msg: "No se ha podido grabar el vídeo." });
        say("No se ha podido grabar el vídeo");
      },
    );
  };
  const send = (blob: Blob, file: string) => {
    env
      .share(blob, file, "Jugada · " + play.name)
      .then((r) => {
        if (r === "shared") say("Vídeo listo para el grupo");
        else if (r === "downloaded") say("Vídeo descargado: mándalo al grupo");
      })
      .catch((err: unknown) => {
        console.error("No se pudo compartir el vídeo", err);
        say("No se ha podido compartir el vídeo");
      });
  };
  return (
    <div className="dr-clip" role="group" aria-label="La jugada en vídeo">
      {st.k === "rec" ? (
        <>
          <progress className="dr-prog" max={100} value={st.pct} aria-label="Grabando el vídeo de la jugada" />
          <span className="dr-clip-t">Grabando… {st.pct} %</span>
          <button type="button" className="b3" onClick={() => job.current?.cancel()}>
            <Icon n="x" w={15} />
            Cancelar
          </button>
        </>
      ) : st.k === "ready" ? (
        <>
          <button type="button" className="b3 dr-gold" onClick={() => send(st.blob, st.file)}>
            <Icon n="share" w={16} />
            Mandar el vídeo al grupo
          </button>
          <button type="button" className="b3" onClick={() => env.save(st.blob, st.file)} aria-label={"Descargar el vídeo (" + st.file + ")"}>
            <Icon n="download" w={16} />
            Descargar
          </button>
          <button type="button" className="b3" onClick={start}>
            <Icon n="film" w={16} />
            Grabar otra vez
          </button>
        </>
      ) : (
        <>
          <button type="button" className="b3" onClick={start}>
            <Icon n="film" w={16} />
            Grabar la jugada en vídeo
          </button>
          <span className="dr-clip-t">{"720p · " + secs + " s · " + (sup.mime.startsWith("video/mp4") ? "MP4" : "WebM")}</span>
          {st.k === "error" && <span className="why dr-clip-err">{st.msg}</span>}
        </>
      )}
    </div>
  );
}
