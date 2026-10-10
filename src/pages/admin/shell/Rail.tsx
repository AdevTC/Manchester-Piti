// The rail (≥ 1000 px): Hoy · Partidos · Convocar · Plantilla + «Club» (Fichas, Temporadas, Capitanes,
// Contenido, La puerta ↗), exception-only counters, and at its foot «Plegar menú» (≥ 1200 px, also `[`)
// and the captain, who opens his menu. Icon-only below 1200 px or when folded: the names come back as
// tooltips (name · counter in words · its `g` shortcut) on hover or keyboard focus.
//
// Motion (all transform / opacity, all off when motion is reduced): the «floodlight» — one shared element
// (layoutId) gliding between items on a spring; a soft light following the pointer (rAF-throttled); the
// icons' micro-animations (CSS); counters that roll; the fold in two beats (labels out, then the width;
// the width, then the labels); the first entrance of the session (items stagger in, the floodlight lands
// last). The rail scrolls inside itself on short screens, with fades at the scrolled edges.
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { AdIcon } from "../ui/icons";
import { CaptainAvatar, CaptainMenu } from "./CaptainMenu";
import { Count, NavIcon } from "./ChromeBits";
import { anchorAbove, FLOOD, POP, useChromeMotion, type MenuAnchor } from "./chromeMotion";
import { counterOf, DOOR_LABEL, goHint, goKeys, navLabel, SECTION, SECTIONS, type Captain, type Counters, type SectionKey } from "./nav";
import { markRailEntrance, railEntranceDone } from "./railPrefs";

export interface RailProps {
  current: SectionKey;
  counters: Counters;
  captain: Captain;
  /** Icon-only right now (below 1200 px, or folded). */
  icon: boolean;
  /** ≥ 1200 px: «Plegar menú» shows. */
  foldable: boolean;
  folded: boolean;
  onFold: () => void;
  dark: boolean;
  onTheme: () => void;
  onLogout: () => void;
}

/** What a tooltip says: the name, the counter in words, the shortcut. */
interface TipContent {
  id: string;
  name: string;
  note?: string;
  /** The note is an exception (amber, like the counters). */
  warn?: boolean;
  keys?: string;
}
interface Tip extends TipContent {
  x: number;
  y: number;
}

/** The floodlight under the current item: one shared element gliding between items. */
function Flood({ animate }: { animate: boolean }) {
  return animate ? <motion.span layoutId="ad-rail-flood" className="fl" aria-hidden="true" transition={FLOOD} /> : <span className="fl" aria-hidden="true" />;
}

const showsFocusRing = (el: HTMLElement) => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
};

/** Tooltips in icon mode: after a short delay on hover, at once on keyboard focus; gliding between items. */
function useRailTips(enabled: boolean) {
  const [tip, setTip] = useState<Tip | null>(null);
  const showT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const open = useRef(false);
  useEffect(
    () => () => {
      clearTimeout(showT.current);
      clearTimeout(hideT.current);
    },
    [],
  );
  const place = (el: HTMLElement, c: TipContent) => {
    const r = el.getBoundingClientRect();
    open.current = true;
    setTip({ ...c, x: Math.round(r.right + 10), y: Math.round(r.top + r.height / 2) });
  };
  const hide = () => {
    clearTimeout(showT.current);
    clearTimeout(hideT.current);
    hideT.current = setTimeout(() => {
      open.current = false;
      setTip(null);
    }, 90);
  };
  const bind = (c: TipContent) =>
    enabled
      ? {
          onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
            if (e.pointerType !== "mouse") return;
            const el = e.currentTarget;
            clearTimeout(showT.current);
            clearTimeout(hideT.current);
            if (open.current) place(el, c);
            else showT.current = setTimeout(() => place(el, c), 260);
          },
          onPointerLeave: hide,
          onFocus: (e: FocusEvent<HTMLElement>) => {
            if (!showsFocusRing(e.currentTarget)) return;
            clearTimeout(showT.current);
            clearTimeout(hideT.current);
            place(e.currentTarget, c);
          },
          onBlur: hide,
        }
      : {};
  return { tip: enabled ? tip : null, bind };
}

/**
 * The soft light that follows the pointer inside the rail (mouse only; one write per frame, transform only).
 * It lives in its own clipped layer under the rail (`.rspot`, same grid cell), so it never adds to the
 * rail's scroll.
 */
function useSpotlight(nav: RefObject<HTMLElement | null>, spot: RefObject<HTMLSpanElement | null>, on: boolean) {
  const frame = useRef(0);
  const at = useRef({ x: 0, y: 0 });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  if (!on) return undefined;
  return (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    at.current = { x: e.clientX, y: e.clientY };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = nav.current;
      const s = spot.current;
      if (!el || !s) return;
      const r = el.getBoundingClientRect();
      s.style.transform = `translate3d(${Math.round(at.current.x - r.left)}px,${Math.round(at.current.y - r.top)}px,0)`;
    });
  };
}

/** `data-fade="t b"` while there is more rail above / below (the CSS masks those edges). */
function useScrollFades(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = el.scrollTop > 2;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      const v = `${top ? "t" : ""} ${bottom ? "b" : ""}`.trim();
      if (v) el.dataset.fade = v;
      else delete el.dataset.fade;
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", onChange, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onChange);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", onChange);
      ro?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export function Rail({ current, counters, captain, icon, foldable, folded, onFold, dark, onTheme, onLogout }: RailProps) {
  const animate = useChromeMotion();
  const navRef = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLSpanElement>(null);
  const meRef = useRef<HTMLButtonElement>(null);
  // The entrance plays once per session (read here, marked after mount); the class goes once it has played,
  // so a floodlight mounted later (a new current item) doesn't replay its landing.
  const [entrance, setEntrance] = useState(() => animate && !railEntranceDone());
  useEffect(() => {
    markRailEntrance();
    if (!entrance) return;
    const t = setTimeout(() => setEntrance(false), 1400);
    return () => clearTimeout(t);
  }, [entrance]);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const { tip, bind } = useRailTips(icon);
  const onPointerMove = useSpotlight(navRef, spotRef, animate);
  useScrollFades(navRef);

  const item = (k: SectionKey, at: number) => {
    const s = SECTION[k];
    const c = counterOf(counters, k);
    const active = current === k;
    return (
      <Link
        key={k}
        className="it fr"
        to={s.path}
        aria-current={active ? "page" : undefined}
        aria-label={navLabel(s.name, c)}
        aria-keyshortcuts={goKeys(k)}
        style={{ "--i": at } as CSSProperties}
        {...bind({ id: k, name: s.name, note: c && c.n ? c.label : undefined, warn: true, keys: goHint(k) })}
      >
        {active && <Flood animate={animate} />}
        <NavIcon name={s.icon} />
        <span className="lb">{s.name}</span>
        <span className="nw">
          <Count n={c?.n ?? 0} className="n" />
        </span>
      </Link>
    );
  };
  // Each row's place in the entrance / fold stagger (`--i`).
  const mainKeys = SECTIONS.filter((s) => s.group === "main").map((s) => s.key);
  const clubKeys = SECTIONS.filter((s) => s.group === "club").map((s) => s.key);
  const groupAt = mainKeys.length;
  const doorAt = groupAt + 1 + clubKeys.length;
  const footAt = doorAt + 1;
  const main = mainKeys.map((k, n) => item(k, n));
  const club = clubKeys.map((k, n) => item(k, groupAt + 1 + n));
  const foldLabel = folded ? "Desplegar menú" : "Plegar menú";

  const children: ReactNode = (
    <>
      {main}
      <p className="g" style={{ "--i": groupAt } as CSSProperties}>
        Club
      </p>
      {club}
      <Link className="it fr" to="/vestuario" hash="puerta" aria-label={DOOR_LABEL} style={{ "--i": doorAt } as CSSProperties} {...bind({ id: "puerta", name: "La puerta", note: "sales al vestuario ↗" })}>
        <NavIcon name="door" />
        <span className="lb">La puerta</span>
        <span className="x" aria-hidden="true">
          <AdIcon name="ext" size={14} />
        </span>
      </Link>
      <div className="foot" style={{ "--i": footAt } as CSSProperties}>
        {foldable && (
          <button type="button" className="it fold fr" onClick={onFold} aria-label={foldLabel} aria-expanded={!folded} aria-keyshortcuts="[" {...bind({ id: "fold", name: foldLabel, keys: "[" })}>
            <AdIcon name="side" size={20} />
            <span className="lb">Plegar menú</span>
            <span className="nw" aria-hidden="true">
              <kbd>[</kbd>
            </span>
          </button>
        )}
        <button
          ref={meRef}
          type="button"
          className="me fr"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          onClick={(e) => setMenu(menu ? null : anchorAbove(e.currentTarget))}
          {...bind({ id: "me", name: captain.nickname, note: captain.role })}
        >
          <CaptainAvatar captain={captain} />
          <span className="who">
            <b>{captain.nickname}</b>
            <small>{captain.role}</small>
          </span>
        </button>
      </div>
    </>
  );
  const navProps = {
    ref: navRef,
    id: "ad-rail",
    className: entrance ? "rail in" : "rail",
    "aria-label": "Sala de control",
    "data-motion": animate ? undefined : "off",
    // the floodlight lands after the last row
    style: { "--n": footAt + 1 } as CSSProperties,
    onPointerMove,
  } as const;

  return (
    <>
      {animate ? (
        <LayoutGroup id="rail">
          <motion.nav {...navProps} layoutScroll>
            {children}
          </motion.nav>
        </LayoutGroup>
      ) : (
        <nav {...navProps}>{children}</nav>
      )}
      {animate && (
        <span className="rspot" aria-hidden="true">
          <span ref={spotRef} className="spot" />
        </span>
      )}
      <RailTip tip={tip} animate={animate} />
      <CaptainMenu open={!!menu} anchor={menu} onClose={() => setMenu(null)} returnRef={meRef} captain={captain} dark={dark} onTheme={onTheme} onLogout={onLogout} />
    </>
  );
}

function TipBody({ tip }: { tip: Tip }) {
  return (
    <>
      <b>{tip.name}</b>
      {tip.note && <small className={tip.warn ? "w" : undefined}>{tip.note}</small>}
      {tip.keys && <kbd>{tip.keys}</kbd>}
    </>
  );
}
/** The icon rail's tooltip (decorative: the items' names already say all of it). */
function RailTip({ tip, animate }: { tip: Tip | null; animate: boolean }) {
  if (!animate)
    return tip ? (
      <div className="rtip" aria-hidden="true" style={{ left: tip.x, top: tip.y }}>
        <TipBody tip={tip} />
      </div>
    ) : null;
  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="tip"
          className="rtip"
          aria-hidden="true"
          style={{ left: tip.x, top: 0 }}
          initial={{ opacity: 0, x: -6, y: tip.y, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, y: tip.y, scale: 1, transition: POP }}
          exit={{ opacity: 0, x: -4, transition: { duration: 0.12 } }}
        >
          <TipBody tip={tip} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
