// The floating score: a small glass drop with the live score. Desktop: detached 16 px under the top bar, no neck,
// draggable anywhere, springs to the nearest of eight anchors (never the screen's centre), remembers its spot per
// page, double-click or Home returns it. Phone/tablet: rides above the tab bar and drags along the bottom edge
// only. It follows liveDock: hidden while a page's lens shows the match; on desktop it sits on the page's anchor
// when one is declared (Partidos' tonight segment), the whole drop centred on it, as the board (dockWidth); on a
// phone it never docks.
// It carries the shared view-transition-name the lens and the match page's scoreboard use (one mounted at a
// time), so the score morphs from page to page and into its sheet (the drop steps aside while the sheet is open).
// The goal plays on it: inhale, two rings of light and gold dust leave the drop, a glint sweeps it, the scorer's
// name sets; the rival's goal a cold coral rim. Client only: mount it from the live system, never on the server.
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { anchorPoints, type Box, type Pos } from "./anchors";
import { useDesktop } from "./env";
import { floatLabel, floatLines, type FloatMatch } from "./floatText";
import { dockWidth, useLiveDockState } from "./liveDock";
import { useDraggable } from "./useDraggable";
import { VIcon } from "./VIcon";
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
   *  Inicio, where the lens takes it) or «bottom-right» (pages whose top-right is their own: a match page's
   *  scoreboard, Partidos' tools; see live/liveModel's floatHome). */
  placement?: FloatPlacement;
  /** The top bar's height on desktop (the float keeps 16 px under it: y 96, the boards' VK.drag top; default 80). */
  barHeight?: number;
  /** The tab bar's height plus its gap on a phone (default 96). */
  dockHeight?: number;
  /** The goal moment's lens classes and rim (useGoalMoment). */
  goal?: string;
  rim?: boolean;
  /** The goal moment's digit roll (useGoalMoment().digit) on the score. */
  scoreClass?: string;
  /** The sheet it opens is open (aria-expanded; the drop steps aside: the sheet took its place). */
  sheetOpen?: boolean;
  /** The view-transition-name it shares with the lens, the sheet and the match page's scoreboard. */
  vtName?: string;
  /** The goal moment is playing: the rings and the dust (ours), or the cold flash (theirs). */
  fx?: "us" | "them" | null;
  /** The glint sweeping the drop (useGoalMoment().glint) and the scorer's name setting (.name). */
  glint?: string;
  nameClass?: string;
  /** A gold pulse, once (the MVP's moment). */
  flash?: boolean;
  /** The rival scored last: a cold coral rim until the next play (ours is gold: `rim`). */
  coldRim?: boolean;
}

export function FloatingScore({ match, now, onOpen, onPip, storageKey, placement = "right", barHeight = 80, dockHeight = 96, goal, rim, scoreClass, sheetOpen, vtName, fx = null, glint, nameClass, flash, coldRim }: FloatingScoreProps) {
  const desktop = useDesktop();
  const dock = useLiveDockState();
  const float = useRef<HTMLDivElement | null>(null);
  const handle = useRef<HTMLButtonElement | null>(null);
  const hintId = useId();
  // (a phone never docks: the float stays above the tab bar, where every page has it)
  const docked = desktop && dock.mode === "anchor" && !!dock.anchor;
  const top = barHeight + 16;
  const home = (b: Box): Pos => {
    if (!desktop) return { x: (b.W - b.w) / 2, y: b.H - b.h - dockHeight };
    if (placement === "centre") return { x: (b.W - b.w) / 2, y: top };
    const points = anchorPoints(b, { top, margin: 24, bottom: 24, anchors: "eight" });
    // bottom-right: where the Partidos board rests it (28 px from the right edge, 30 from the bottom; a drag
    // then snaps to the anchors' corner)
    if (placement === "bottom-right") return { x: b.W - b.w - 28, y: b.H - b.h - 30 };
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
    anchors: "eight",
    enabled: !docked && dock.mode !== "lens",
  });

  // Docked on a page's element (Partidos' tonight segment): follow it as the page scrolls, as wide as it allows.
  useEffect(() => {
    const el = float.current;
    const anchor = dock.anchor;
    if (!el || !docked || !anchor) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      const r = anchor.getBoundingClientRect();
      // (a point anchor — Partidos' 1 px mark in the middle of tonight's segment — takes the width of what holds it)
      // (layout widths: a segment still rising in — scaled by its entrance — must not read as narrow)
      const widthOf = (x: Element) => (x instanceof HTMLElement ? x.offsetWidth : x.getBoundingClientRect().width);
      let room: Element | null = anchor;
      while (room && widthOf(room) < 40) room = room.parentElement;
      const w = dockWidth(widthOf(room ?? anchor));
      el.style.setProperty("--vd-dockw", `${w}px`);
      // (tight: the crest goes before anything clips; tighter: the minute goes too, the score stays)
      if (w < 140) el.dataset.vdTight = w < 100 ? "2" : "1";
      else delete el.dataset.vdTight;
      el.style.setProperty("--vd-fx", `${Math.round(r.left + r.width / 2 - el.offsetWidth / 2)}px`);
      el.style.setProperty("--vd-fy", `${Math.round(r.top + r.height / 2 - el.offsetHeight / 2)}px`);
      el.dataset.vdPlaced = "1";
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    // (once more after the width settles: the drop is centred on its final size; and after the page's own
    // entrance has moved the anchor into place)
    queue();
    const later = [450, 1000].map((ms) => window.setTimeout(queue, ms));
    window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      later.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("scroll", queue, { capture: true });
      window.removeEventListener("resize", queue);
      el.style.removeProperty("--vd-dockw");
      delete el.dataset.vdTight;
    };
  }, [docked, dock.anchor]);

  const lines = floatLines(match, now);
  const off = match.state === "offline";
  const expanded = !!match.event && !off;
  const hidden = dock.mode === "lens";
  const time = match.state === "previa" || match.state === "rsvp" || match.state === "anotador";
  const cold = fx === "them" || !!coldRim;
  const style: CSSProperties | undefined = vtName && !sheetOpen ? { viewTransitionName: vtName } : undefined;
  return (
    <div className="vd-floatzone" hidden={hidden}>
      <div
        ref={float}
        className={`vd-float${desktop ? "" : " vd-float--edge"}${docked ? " is-docked" : ""}${sheetOpen ? " is-open" : ""}${fx ? ` is-fx is-fx--${fx}` : ""}${flash ? " is-flash" : ""}`}
        data-state={match.state}
      >
        <button
          ref={handle}
          type="button"
          className={`vd-glass vd-drop vd-press${expanded ? " vd-drop--expanded" : ""}${off ? " vd-glass--frost" : ""}${goal ? ` ${goal}` : ""}${rim ? " vd-rim-gold" : ""}${cold ? " vd-rim-coral" : ""}${vtName ? " vd-morph" : ""}`}
          style={style}
          aria-label={floatLabel(match, now)}
          aria-describedby={docked ? undefined : hintId}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={onOpen}
        >
          {off ? <VIcon name="wifiOff" className="vd-drop__off" size={22} /> : <img className="vd-drop__crest" src={match.crest ?? "/crest-128.webp"} alt="" width={36} height={36} />}
          {lines.big && <span className={`vd-drop__score${time ? " vd-drop__score--time" : ""}${scoreClass ? ` ${scoreClass}` : ""}${fx === "them" ? " vd-digit--cold" : ""}`}>{lines.big}</span>}
          {expanded ? (
            <span className="vd-drop__event">
              <b className={nameClass || undefined}>{lines.main}</b>
              {lines.small && <span>{lines.small}</span>}
            </span>
          ) : (
            <>
              <span className="vd-drop__vs">{lines.main}</span>
              {lines.small && <span className={lines.clock ? "vd-drop__min" : "vd-drop__vs"}>{lines.small}</span>}
            </>
          )}
          <span className={`vd-glint${glint ? ` ${glint}` : ""}`} aria-hidden="true" />
        </button>
        {/* the goal leaves the drop: two rings of light and gold dust (CSS only, never in the way) */}
        <span className="vd-wave" aria-hidden="true" />
        <span className="vd-wave vd-wave--2" aria-hidden="true" />
        <span className="vd-dust" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        {onPip && desktop && !docked && (
          <button type="button" className="vd-glass vd-float__pip vd-press" onClick={onPip} data-vd-nodrag="" aria-label="Sacar el marcador">
            <VIcon name="pip" size={18} />
          </button>
        )}
        {!docked && (
          <span className="vd-float__hint" id={hintId}>
            {desktop ? "Arrástralo; doble clic y vuelve a su sitio" : "Arrástralo por el borde de abajo"}
          </span>
        )}
      </div>
    </div>
  );
}
