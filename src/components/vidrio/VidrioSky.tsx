// The light field: the ground of a Vidrio screen. Layered CSS gradients paint it on the server and on first
// paint; in the browser a small canvas adds the bokeh discs once (redrawn only when the light or the width
// changes: no animation loop). Grain and vignette on top; `gold` floods it for the goal moment.
import { useEffect, useRef, type CSSProperties } from "react";
import { bokehDiscs, paintDiscs, skyLightOf, type SkyInput } from "./sky";
import { isShot, useReducedMotion } from "./env";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/sky.css";
import "../../styles/vidrio/field.css";

export interface VidrioSkyProps {
  /** The kick-off's light (sun.ts LightKey) or «noon». */
  light: SkyInput;
  /** Floodlights on (default: at night). */
  floodlit?: boolean;
  /** Cloud cover softens the sun and raises the haze. */
  weather?: "despejado" | "nubes" | "lluvia";
  /** Override the viewer's reduced-motion preference (no drift). */
  reduced?: boolean;
  /** The goal moment's gold flood (useGoalMoment().sky). */
  gold?: boolean;
  /** The rival's goal: a cold coral flash. */
  cold?: boolean;
  /** The first screen's height in px (the stops are laid out on it; default 900). */
  height?: number;
  className?: string;
}

export function VidrioSky({ light, floodlit, weather, reduced, gold, cold, height, className }: VidrioSkyProps) {
  const sky = skyLightOf(light, floodlit);
  const calm = useReducedMotion();
  const still = reduced ?? calm;
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drift = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cv = canvas.current;
    const host = cv?.parentElement;
    if (!cv || !host || typeof cv.getContext !== "function") return;
    let width = 0;
    const draw = () => {
      const w = host.clientWidth;
      const h = host.clientHeight || height || 900;
      if (!w || w === width) return;
      width = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      paintDiscs(g, bokehDiscs(sky, w, h));
    };
    draw();
    if (isShot() || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  }, [sky, height]);

  // The drift only runs while its layer is on screen and the tab is shown ([data-vd-off] pauses it where it is).
  useEffect(() => {
    const el = drift.current;
    if (!el || still || isShot()) return;
    let seen = true;
    const sync = () => {
      if (seen && !document.hidden) el.removeAttribute("data-vd-off");
      else el.setAttribute("data-vd-off", "");
    };
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            seen = entries[entries.length - 1].isIntersecting;
            sync();
          })
        : null;
    io?.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      el.removeAttribute("data-vd-off");
    };
  }, [still]);

  const cls = ["vd-sky", `vd-l-${sky}`, !still && "vd-sky--drift", weather && weather !== "despejado" && "vd-sky--cloud", gold && "vd-sky--gold", cold && "vd-sky--cold", className]
    .filter(Boolean)
    .join(" ");
  const style = height ? ({ "--vd-sky-h": `${height}px` } as CSSProperties) : undefined;
  return (
    <div className={cls} style={style} aria-hidden="true" data-light={sky}>
      <div className="vd-sky__base" />
      <div className="vd-sky__sun" />
      <div className="vd-sky__drift" ref={drift}>
        <div className="vd-sky__banks" />
        <canvas className="vd-sky__bokeh" ref={canvas} />
      </div>
      <div className="vd-sky__rays" />
      <div className="vd-sky__haze" />
      <div className="vd-sky__turf" />
      <div className="vd-sky__gold" />
      <div className="vd-sky__cold" />
      <div className="vd-sky__grain" />
      <div className="vd-sky__vig" />
    </div>
  );
}
