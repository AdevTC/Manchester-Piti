// The floating score: a small glass drop with the live score. Desktop: detached 16 px under the top bar, no neck,
// draggable anywhere, springs to the nearest of nine anchors, remembers its spot per page, double-click or Home
// returns it. Phone/tablet: rides above the tab bar and drags along the bottom edge only. It follows liveDock:
// hidden while a page's lens shows the match, sitting on the page's anchor when one is declared.
// Client only: mount it from the live system (P5), never in the server render.
import { useEffect, useId, useRef } from "react";
import { anchorPoints, type Box, type Pos } from "./anchors";
import { useDesktop } from "./env";
import { floatLabel, floatLines, type FloatMatch } from "./floatText";
import { useLiveDockState } from "./liveDock";
import { useDraggable } from "./useDraggable";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export type FloatPlacement = "right" | "centre" | "bottom-right";

export interface FloatingScoreProps {
  match: FloatMatch;
  /** Now (ms), for the countdown before kick-off. */
  now: number;
  /** Tap: open the sheet. */
  onOpen: () => void;
  /** «Sacar el marcador» (shown on hover/focus when given). */
  onPip?: () => void;
  /** Its remembered spot (per page: «inicio», «partidos», «plantilla»…). */
  storageKey: string;
  /** Desktop home until it is moved: «right» (top-right under the bar, the default), «centre» (top centre:
   *  Inicio, where the lens takes it) or «bottom-right» (the corner clear of a page's title, controls and
   *  boards: every other page, see live/liveModel's floatHome). */
  placement?: FloatPlacement;
  /** The top bar's height on desktop (the float keeps 16 px under it; default 88). */
  barHeight?: number;
  /** The tab bar's height plus its gap on a phone (default 96). */
  dockHeight?: number;
  /** The goal moment's lens classes and rim (useGoalMoment). */
  goal?: string;
  rim?: boolean;
  /** The goal moment's digit roll (useGoalMoment().digit) on the score. */
  scoreClass?: string;
  /** The sheet it opens is open (aria-expanded). */
  sheetOpen?: boolean;
}

function FloatIcon({ off }: { off: boolean }) {
  if (!off) return null;
  return (
    <svg className="vd-drop__off" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 015.2-2.8M19 12.5a10 10 0 00-2.4-1.8M2 8.8A15 15 0 016.6 6M22 8.8A15 15 0 0011 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FloatingScore({ match, now, onOpen, onPip, storageKey, placement = "right", barHeight = 88, dockHeight = 96, goal, rim, scoreClass, sheetOpen }: FloatingScoreProps) {
  const desktop = useDesktop();
  const dock = useLiveDockState();
  const float = useRef<HTMLDivElement | null>(null);
  const handle = useRef<HTMLButtonElement | null>(null);
  const hintId = useId();
  const docked = dock.mode === "anchor" && !!dock.anchor;
  const top = barHeight + 16;
  const home = (b: Box): Pos => {
    if (!desktop) return { x: (b.W - b.w) / 2, y: b.H - b.h - dockHeight };
    if (placement === "centre") return { x: (b.W - b.w) / 2, y: top };
    const points = anchorPoints(b, { top, margin: 24, bottom: 24 });
    // bottom-right: the right column of anchors, bottom row
    if (placement === "bottom-right") return points.reduce((best, p) => (p.x > best.x || (p.x === best.x && p.y > best.y) ? p : best));
    // top-right under the bar (the right column of anchors, top row)
    return points.reduce((best, p) => (p.x > best.x || (p.x === best.x && p.y < best.y) ? p : best));
  };
  useDraggable(float, {
    storageKey: `${storageKey}${desktop ? "" : "-movil"}`,
    handle,
    home,
    top,
    margin: desktop ? 24 : 12,
    bottom: desktop ? 24 : dockHeight,
    axis: desktop ? "both" : "x",
    anchors: "nine",
    enabled: !docked && dock.mode !== "lens",
  });

  // Docked on a page's element (Partidos' tonight segment): follow it as the page scrolls.
  useEffect(() => {
    const el = float.current;
    const anchor = dock.anchor;
    if (!el || !docked || !anchor) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      const r = anchor.getBoundingClientRect();
      el.style.setProperty("--vd-fx", `${Math.round(r.left + r.width / 2 - el.offsetWidth / 2)}px`);
      el.style.setProperty("--vd-fy", `${Math.round(r.top + r.height / 2 - el.offsetHeight / 2)}px`);
      el.dataset.vdPlaced = "1";
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
    };
  }, [docked, dock.anchor]);

  const lines = floatLines(match, now);
  const off = match.state === "offline";
  const expanded = match.state === "directo" && !!match.event;
  const hidden = dock.mode === "lens";
  return (
    <div className="vd-floatzone" hidden={hidden}>
      <div ref={float} className={`vd-float${desktop ? "" : " vd-float--edge"}${docked ? " is-docked" : ""}`} data-state={match.state}>
        <button
          ref={handle}
          type="button"
          className={`vd-glass vd-drop vd-press${expanded ? " vd-drop--expanded" : ""}${off ? " vd-glass--frost" : ""}${goal ? ` ${goal}` : ""}${rim ? " vd-rim-gold" : ""}`}
          aria-label={floatLabel(match, now)}
          aria-describedby={docked ? undefined : hintId}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={onOpen}
        >
          <FloatIcon off={off} />
          {!off && <img className="vd-drop__crest" src={match.crest ?? "/crest-128.webp"} alt="" width={36} height={36} />}
          {lines.big && <span className={`vd-drop__score${match.state === "previa" || match.state === "rsvp" || match.state === "anotador" ? " vd-drop__score--time" : ""}${scoreClass ? ` ${scoreClass}` : ""}`}>{lines.big}</span>}
          {expanded ? (
            <span className="vd-drop__event">
              <b>{lines.main}</b>
              {lines.small && <span>{lines.small}</span>}
            </span>
          ) : (
            <>
              <span className="vd-drop__vs">{lines.main}</span>
              {lines.small && <span className={lines.clock ? "vd-drop__min" : "vd-drop__vs"}>{lines.small}</span>}
            </>
          )}
        </button>
        {onPip && desktop && (
          <button type="button" className="vd-glass vd-float__pip vd-press" onClick={onPip} data-vd-nodrag="" aria-label="Sacar el marcador">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect x="11.5" y="11.5" width="7" height="5.5" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        )}
        {!docked && (
          <span className="vd-float__hint" id={hintId}>
            {desktop ? "Arrástralo a donde quieras; doble clic lo devuelve" : "Arrástralo por el borde de abajo"}
          </span>
        )}
      </div>
    </div>
  );
}
