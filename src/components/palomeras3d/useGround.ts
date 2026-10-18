// One ground for N views: paints the still at once, then (after load and idle, only when visible, never
// for reduced motion / Save-Data / no WebGL) lazy-loads the WebGL chunk and hands the same canvases to one
// engine. Pauses offscreen and with the tab hidden; a lost context goes back to the still for good.
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Engine } from "./engine";
import type { RigDef } from "./rigs";
import { paintStill } from "./still";
import { isShot, stillReason } from "./support";
import type { PalomerasState } from "./types";

export interface GroundView {
  rig: RigDef;
  /** Identifies the camera (a view whose camera changes re-mounts the engine). */
  rigId: string;
  state: PalomerasState;
  w: number;
  h: number;
  maxDpr?: number;
  walk?: boolean;
}

export type GroundMode = "still" | "webgl";

interface Options {
  host: RefObject<HTMLElement | null>;
  views: readonly GroundView[];
  reduced?: boolean;
  onReady?: (mode: GroundMode) => void;
}

function afterLoadAndIdle(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => {
      if (signal.aborted) return;
      if (isShot()) return resolve();
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(() => resolve(), { timeout: 2500 });
      else setTimeout(resolve, 300);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true, signal });
  });
}

function whenVisible(el: Element, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (typeof IntersectionObserver === "undefined") return resolve();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        resolve();
      }
    });
    io.observe(el);
    signal.addEventListener("abort", () => io.disconnect());
  });
}

export function useGround({ host, views, reduced, onReady }: Options) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const plates = useRef<(HTMLElement | null)[]>([]);
  const engine = useRef<Engine | null>(null);
  const [mode, setMode] = useState<GroundMode>("still");
  const [painted, setPainted] = useState(false);
  const latest = useRef({ views, onReady });
  useEffect(() => {
    latest.current = { views, onReady };
  });

  const sized = views.length > 0 && views.every((v) => v.w > 0 && v.h > 0);
  const shape = views.map((v) => v.rigId).join("|");
  const stillKey = JSON.stringify(views.map((v) => [v.rigId, Math.round(v.w), Math.round(v.h), v.state]));
  const stateKeys = views.map((v) => JSON.stringify(v.state));
  const sizeKeys = views.map((v) => `${Math.round(v.w)}x${Math.round(v.h)}`);

  /* the still: first paint, and whenever the scene changes while there is no engine */
  useEffect(() => {
    if (mode !== "still" || !sized) return;
    latest.current.views.forEach((v, i) => {
      const c = canvases.current[i];
      if (c) paintStill(c, v.w, v.h, v.rig, v.state, plates.current[i]);
    });
    if (!painted) {
      setPainted(true);
      latest.current.onReady?.("still");
    }
  }, [mode, sized, stillKey, painted]);

  /* the WebGL ground: once per camera set */
  useEffect(() => {
    if (!sized || stillReason(reduced) !== null) return;
    const el = host.current;
    if (!el) return;
    const ac = new AbortController();
    let made: Engine | null = null;
    (async () => {
      await afterLoadAndIdle(ac.signal);
      if (ac.signal.aborted) return;
      await whenVisible(el, ac.signal);
      if (ac.signal.aborted) return;
      const { createEngine } = await import("./engine");
      if (ac.signal.aborted) return;
      const vs = latest.current.views;
      const cvs = vs.map((_, i) => canvases.current[i]);
      if (cvs.some((c) => !c)) return;
      for (const p of plates.current) p?.replaceChildren();
      made = await createEngine({
        views: vs.map((v, i) => ({
          canvas: cvs[i] as HTMLCanvasElement,
          w: v.w,
          h: v.h,
          rig: v.rig,
          plates: plates.current[i],
          state: v.state,
          maxDpr: v.maxDpr,
          walk: v.walk,
        })),
        live: 0,
        onLost: () => {
          made?.dispose();
          made = null;
          engine.current = null;
          setMode("still");
        },
      });
      if (ac.signal.aborted) {
        made.dispose();
        made = null;
        return;
      }
      engine.current = made;
      // the views may have changed while the chunk loaded
      latest.current.views.forEach((v, i) => {
        made?.resize(i, v.w, v.h);
        made?.setState(i, v.state);
      });
      setMode("webgl");
      latest.current.onReady?.("webgl");
    })().catch((error: unknown) => {
      if (ac.signal.aborted) return;
      console.error("No se ha podido cargar Palomeras en 3D:", error);
      made?.dispose();
      made = null;
      engine.current = null;
      setMode("still");
    });
    return () => {
      ac.abort();
      made?.dispose();
      made = null;
      engine.current = null;
      setMode("still");
    };
    // one engine per camera set; the scene and the sizes flow in through the effects below
  }, [shape, sized, reduced, host]);

  /* scene changes → the engine */
  const stateKey = stateKeys.join("\u0000");
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    latest.current.views.forEach((v, i) => e.setState(i, v.state));
  }, [stateKey, mode]);
  const sizeKey = sizeKeys.join(",");
  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    latest.current.views.forEach((v, i) => e.resize(i, v.w, v.h));
  }, [sizeKey, mode]);

  /* sleep offscreen and with the tab hidden */
  useEffect(() => {
    const el = host.current;
    const e = engine.current;
    if (mode !== "webgl" || !el || !e) return;
    let inView = true;
    const sync = () => (inView && !document.hidden ? e.resume() : e.pause());
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            inView = entries.some((x) => x.isIntersecting);
            sync();
          });
    io?.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [mode, host]);

  return { canvases, plates, engine, mode, painted };
}
