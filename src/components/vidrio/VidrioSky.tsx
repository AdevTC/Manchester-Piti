// The light field: the ground of a Vidrio screen. Layered CSS gradients paint it on the server and on first
// paint; in the browser a small canvas adds the bokeh discs once (redrawn only when the light or the width
// changes: no animation loop). Grain and vignette on top; `gold` floods it for the goal moment.
import { useEffect, useRef, type CSSProperties } from "react";
import { bokehDiscs, paintDiscs, skyLightOf, type SkyInput } from "./sky";
import { isShot, useReducedMotion } from "./env";
import { afterTransitions, transitionRunning } from "../celeste/pageTransition";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/sky.css";
import "../../styles/vidrio/field.css";

export interface VidrioSkyProps {
  /** The kick-off's light (sun.ts LightKey) or «noon». */
  light: SkyInput;
  /** The bokeh's light in the «día» theme, when the page's light changes with the theme. The stylesheet paints the rest
   *  of the day sky whatever the light (sky.css), so such a page passes its night light as `light` and its day one
   *  here: the server's markup is then the same for both themes (it can't know which: it painted the day light, and
   *  the night's visitors saw the sky change when React took the page over). */
  day?: SkyInput;
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

export function VidrioSky({ light, day, floodlit, weather, reduced, gold, cold, height, className }: VidrioSkyProps) {
  const sky = skyLightOf(light, floodlit);
  // (the discs are drawn in the browser, after React took the page over: there the theme is known)
  const theme = useDocumentTheme();
  const discs = day !== undefined && theme === "light" ? skyLightOf(day) : sky;
  const calm = useReducedMotion();
  const still = reduced ?? calm;
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drift = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cv = canvas.current;
    const host = cv?.parentElement;
    if (!cv || !host || typeof cv.getContext !== "function") return;
    let width = 0;
    let gone = false;
    const draw = () => {
      if (gone) return;
      // (nor while a View Transition runs: the arriving page is captured live, and the discs and their fade-in would
      // be captured again on every frame of it)
      if (transitionRunning()) {
        void afterTransitions().then(draw);
        return;
      }
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
      paintDiscs(g, bokehDiscs(discs, w, h));
      cv.dataset.on = "";
    };
    if (isShot() || typeof ResizeObserver !== "function") {
      draw();
      return;
    }
    // (the discs light up once the page is in: painted at the first idle moment, not inside a change of page,
    // where the screen holds still until the next page is ready; they fade in, styles/vidrio/sky.css)
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(draw, { timeout: 700 }) : window.setTimeout(draw, 150);
    const ro = new ResizeObserver(() => width && draw());
    ro.observe(host);
    return () => {
      gone = true;
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      ro.disconnect();
    };
  }, [discs, height]);

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
