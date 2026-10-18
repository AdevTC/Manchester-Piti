import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type Ref, type RefObject } from "react";
import { skyCss } from "./light";
import { horizonFraction, projector, rigDef, rigKey } from "./rigs";
import { pitchToWorld } from "./scene";
import { useGround, type GroundMode } from "./useGround";
import type { PalomerasHandle, PalomerasRig, PalomerasState } from "./types";
import "./palomeras.css";

interface Props {
  ref?: Ref<PalomerasHandle>;
  rig: PalomerasRig;
  state: PalomerasState;
  /** Keep the still (as with prefers-reduced-motion). */
  reduced?: boolean;
  className?: string;
  /** A picture is on screen: first the still, then (when it starts) the WebGL ground. */
  onReady?: (mode: GroundMode) => void;
}

function useSize(ref: RefObject<HTMLElement | null>): [number, number] {
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setSize((s) => (s[0] === w && s[1] === h ? s : [w, h]));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * CDM Palomeras lit by the real sun. The server renders the CSS sky; the client paints the designed still
 * at once and swaps to WebGL (lazy chunk) after load, when visible. Decorative: the page's text carries
 * the match; the broadcast name plates are DOM over the canvas.
 */
export function Palomeras({ ref, rig, state, reduced, className, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [w, h] = useSize(host);
  const def = rigDef(rig);
  const { canvasRef, platesRef, engine, mode } = useGround({
    host,
    views: [{ rig: def, rigId: rigKey(rig), state, w, h }],
    reduced,
    onReady,
  });
  const live = useRef({ def, w, h });
  useEffect(() => {
    live.current = { def, w, h };
  });

  useImperativeHandle(
    ref,
    () => ({
      goal: (ours, scorerId) => engine.current?.goal(0, ours, scorerId),
      ignite: () => engine.current?.ignite(0),
      mvp: (id) => engine.current?.mvp(0, id),
      pointer: (nx, ny) => engine.current?.pointer(0, nx, ny),
      project: (x, y, height = 0) => {
        const p = pitchToWorld(x, y);
        const e = engine.current;
        if (e) return e.project(0, p.x, height, p.z);
        const { def: d, w: cw, h: ch } = live.current;
        if (!cw || !ch) return null;
        const q = projector(d, cw, ch)(p.x, height, p.z);
        return q ? { x: q.x, y: q.y } : null;
      },
    }),
    [engine],
  );

  const style = { "--pm-hy": `${(horizonFraction(def) * 100).toFixed(1)}%` } as CSSProperties;
  return (
    <div ref={host} className={className ? `pm ${className}` : "pm"} style={style} data-mode={mode} aria-hidden="true">
      <div className="pm-still" style={{ background: skyCss(state.at, state.weather) }} />
      <canvas
        ref={canvasRef(0)}
        className="pm-cv"
      />
      <div
        ref={platesRef(0)}
        className="pm-plates"
      />
    </div>
  );
}
