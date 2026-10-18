import { useRef, type CSSProperties } from "react";
import { skyCss } from "./light";
import { horizonFraction, rigDef, rigKey } from "./rigs";
import { useGround, type GroundMode } from "./useGround";
import type { PalomerasSliceView } from "./types";
import "./palomeras.css";

interface Props {
  /** The slices, in order; slot i uses vantage point `spot ?? i + 1`. */
  views: readonly PalomerasSliceView[];
  /** Keep the stills (as with prefers-reduced-motion). */
  reduced?: boolean;
  className?: string;
  onReady?: (mode: GroundMode) => void;
}

/**
 * Several slices of Palomeras (Partidos' calendar of light), each at its own hour and weather, drawn by
 * ONE WebGL context. Static frames: the players stand on their spots, nothing loops.
 */
export function PalomerasSlices({ views, reduced, className, onReady }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ground = views.map((v, i) => {
    const spot = v.spot ?? i + 1;
    return { rig: rigDef(v.rig, spot), rigId: rigKey(v.rig, spot), state: v.state, w: v.w, h: v.h, maxDpr: 1.25, walk: false };
  });
  const { canvasRef, platesRef, mode } = useGround({ host, views: ground, reduced, onReady });

  return (
    <div ref={host} className={className ? `pm-slices ${className}` : "pm-slices"} data-mode={mode}>
      {views.map((v, i) => {
        const style = {
          width: v.w,
          height: v.h,
          "--pm-hy": `${(horizonFraction(ground[i].rig) * 100).toFixed(1)}%`,
        } as CSSProperties;
        return (
          <div key={i} className={v.className ? `pm pm-slice ${v.className}` : "pm pm-slice"} style={style}>
            <div className="pm-still" style={{ background: skyCss(v.state.at, v.state.weather) }} aria-hidden="true" />
            <canvas
              ref={canvasRef(i)}
              className="pm-cv"
              aria-hidden="true"
            />
            <div
              ref={platesRef(i)}
              className="pm-plates"
              aria-hidden="true"
            />
            {v.children}
          </div>
        );
      })}
    </div>
  );
}
