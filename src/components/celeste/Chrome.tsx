// Shared chrome on every page: the header, the phone/tablet tab bar and the footer, so the whole web reads as one
// (V-Vivo, V-Integracion, V-Sistema). It also loads the Celeste base (styles/celeste/base.css) once for all.
// «Vidrio» (styles/vidrio/chrome.css): the header's nav is the glass capsule «Inicio · Partidos · Plantilla ·
// Números · Club» with one bead that slides to the current page; on the right the round search, the bell and the
// account (a member's avatar pill «J Jordi» that opens «Tú»; a fan's «Entrar»). The phone/tablet tab bar is the
// same capsule at the bottom with the five pages labelled, which tightens to its icons while you scroll down.
// While a match of ours is live «Partidos» carries a small live dot and says «, en directo»; when the floating
// score is hidden until the next goal, the score stays beside «Partidos» as a chip that brings it back. Moving
// between pages runs the choreography (exit → shared objects morph → enter from the direction of travel).
// The theme switch pages still pass in `actions` lives in the account sheet and the footer (chromeSlot).
import { useLayoutEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { NoticesGate } from "./NoticesGate";
import { SearchGate } from "./SearchGate";
import { AccountGate } from "./AccountGate";
import { InChromeHeader } from "./chromeSlot";
import { useTheme } from "../../hooks/useTheme";
import { VIcon, type VIconName } from "../vidrio/VIcon";
import { liveDock, useLiveDockState } from "../vidrio/liveDock";
import { useLightPointer } from "../vidrio/useLightPointer";
import { useRefraction } from "../vidrio/useRefraction";
import { pageDirection, startPageTransition } from "./pageTransition";
import { useScrollShrink } from "./useScrollShrink";
import { prefersReducedMotion } from "../vidrio/env";
import "../../styles/vestuario.css";
import "./celeste-links.css";
import "./state-panel.css";
import "../../styles/celeste/base.css";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/chrome.css";

export type CelestePage = "inicio" | "partidos" | "plantilla" | "stats" | "club" | "vestuario";
const NAV: { key: CelestePage; to: string; label: string; icon: VIconName }[] = [
  { key: "inicio", to: "/", label: "Inicio", icon: "home" },
  { key: "partidos", to: "/partidos", label: "Partidos", icon: "fixtures" },
  { key: "plantilla", to: "/plantilla", label: "Plantilla", icon: "shirt" },
  { key: "stats", to: "/estadisticas", label: "Estadísticas", icon: "chart" },
  { key: "club", to: "/club", label: "Club", icon: "shield" },
];

/** Film grain, once per Celeste page (the faces are self-hosted: styles/fonts.css). */
export function CelesteBackdrop() {
  return <div className="vx-grain" aria-hidden="true" />;
}

/** The live dot and its words on «Partidos» (nothing when no match is live). */
function LiveMark({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <>
      <span className="vd-livedot" aria-hidden="true" />
      <span className="vd-vh">, en directo</span>
    </>
  );
}

/** The score the capsule keeps beside «Partidos» while the float is hidden: tapping it brings the float back. */
function HiddenChip({ hidden }: { hidden: { score: string; said: string } | null }) {
  if (!hidden) return null;
  return (
    <button type="button" className="vd-capchip vd-press" onClick={() => liveDock.reveal()} aria-label={`Mostrar el marcador: ${hidden.said}`}>
      {hidden.score}
    </button>
  );
}

/** A tab tapped lights up at once (the screen holds still while the next page is put together, and the bead only
 *  moves once it is in), then starts the change of page. */
function go(e: MouseEvent<HTMLAnchorElement>, from: string, to: CelestePage) {
  const tab = e.currentTarget;
  tab.dataset.vdGo = "";
  // (a change that never happens — a redirect, a blocked load — gives the tab back)
  setTimeout(() => delete tab.dataset.vdGo, 3000);
  startPageTransition(pageDirection(from, to));
}

/** Where each capsule's bead last sat (per capsule), so the next page's bead starts there and slides over. */
const lastBead = new Map<string, { x: number; w: number }>();

/** The bead travels like a drop of liquid glass: it stretches the way it goes and squeezes, then settles with a
 *  little give, more the further it goes (a tab away barely, across the bar fully). Around itself: its `scale`
 *  composes with the `translate` that carries it (chrome.css). Not with reduced motion. */
function stretch(bead: Element | null, dx: number) {
  if (!(bead instanceof HTMLElement) || typeof bead.animate !== "function" || prefersReducedMotion() || Math.abs(dx) < 3) return;
  const k = Math.min(1, Math.max(0.35, Math.abs(dx) / 300)) * 0.16;
  const s = (x: number, y: number) => `${(1 + x).toFixed(3)} ${(1 + y).toFixed(3)}`;
  bead.animate([{ scale: "1 1" }, { scale: s(k, -k * 0.55), offset: 0.3 }, { scale: s(-k * 0.18, k * 0.12), offset: 0.62 }, { scale: s(k * 0.05, -k * 0.03), offset: 0.82 }, { scale: "1 1" }], {
    duration: 640,
    easing: "cubic-bezier(.3,.7,.4,1)",
  });
}

/** One bead per capsule: measured on the current link, it springs from where the last page left it. */
function useBead(ref: RefObject<HTMLElement | null>, id: string, active: string | undefined, deps: unknown) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    // (`travel`: the slide from the last page's place, the one that stretches; a resize only moves it)
    const place = (travel = false) => {
      const on = box.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!on || !on.offsetWidth) {
        box.style.setProperty("--vd-bw", "0px");
        return;
      }
      // (measured against the capsule itself, whatever wraps the link)
      const r = on.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const x = Math.round(r.left - b.left - box.clientLeft);
      const w = Math.round(r.width);
      const from = lastBead.get(id);
      box.style.setProperty("--vd-bx", `${x}px`);
      box.style.setProperty("--vd-bw", `${w}px`);
      lastBead.set(id, { x, w });
      if (travel && from) stretch(box.querySelector(".vd-bead"), x - from.x);
    };
    const before = lastBead.get(id);
    if (before) {
      // (start where the last page left it, then slide: the bead is one object travelling between pages)
      box.style.setProperty("--vd-bx", `${before.x}px`);
      box.style.setProperty("--vd-bw", `${before.w}px`);
      box.dataset.vdBeadStill = "";
      void box.offsetWidth;
      delete box.dataset.vdBeadStill;
      const raf = requestAnimationFrame(() => place(true));
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
      ro?.observe(box);
      return () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
      };
    }
    box.dataset.vdBeadStill = "";
    place();
    const raf = requestAnimationFrame(() => delete box.dataset.vdBeadStill);
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => place()) : null;
    ro?.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [ref, id, active, deps]);
}

function NavLinks({ active, live, hidden, from }: { active?: CelestePage; live: boolean; hidden: { score: string; said: string } | null; from: string }) {
  return (
    <>
      {NAV.map((n) => {
        const on = n.key === active;
        const dot = live && n.key === "partidos";
        return (
          <span key={n.key} className="vx-nav-item">
            <Link
              to={n.to}
              className={on ? "on" : undefined}
              aria-current={on ? "page" : undefined}
              onClick={(e) => {
                if (on || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                go(e, from, n.key);
              }}
              viewTransition={!on}
            >
              {n.label}
              <LiveMark on={dot} />
            </Link>
            {n.key === "partidos" && <HiddenChip hidden={hidden} />}
          </span>
        );
      })}
    </>
  );
}

/** `active`: the nav item lit (none on a page outside the nav: a 404, the admin's door). `live`: a match of ours
 *  is on (default: what the live system says through liveDock). `sub` (the page's name) is kept for callers; the
 *  bar names the club, as the boards do (the page's h1 names the page). `actions`: page extras (the theme switch
 *  passed here moves to the account sheet). */
export function CelesteHeader({ active, actions, live }: { active?: CelestePage; sub?: string; actions?: ReactNode; live?: boolean }) {
  const dock = useLiveDockState();
  const isLive = live ?? dock.live;
  const capsule = useRef<HTMLDivElement | null>(null);
  useBead(capsule, "capsule", active, `${isLive}:${dock.hidden?.score ?? ""}`);
  useRefraction(capsule, { bezel: 16, strength: 1.1, blur: 16 });
  useLightPointer(capsule);
  return (
    <header className="vx-top">
      <Link className="vx-brand" to="/" aria-label="Manchester Piti, inicio">
        <img src="/crest-128.webp" alt="" />
        <span className="vx-brand-name">Manchester Piti</span>
      </Link>
      <nav className="vx-nav" aria-label="Navegación principal">
        <div ref={capsule} className="vx-nav-in vd-glass">
          <span className="vd-bead" aria-hidden="true" />
          <NavLinks active={active} live={isLive} hidden={dock.hidden} from={active ?? "otra"} />
        </div>
      </nav>
      <div className="vx-actions">
        <InChromeHeader.Provider value={true}>{actions}</InChromeHeader.Provider>
        {/* Search (everyone, client only), the bell (members) and the account share one slot: the actions keep
            their count and places, so React's ids (the pages' useId) and the server-rendered HTML stay byte for
            byte the fan's (the account renders the fan's «Entrar» there until the browser knows better). */}
        <>
          <>
            <SearchGate />
            <NoticesGate />
          </>
          <AccountGate here={active === "vestuario"} />
        </>
      </div>
    </header>
  );
}

export function CelesteDock({ active, live }: { active?: CelestePage; live?: boolean }) {
  const dock = useLiveDockState();
  const isLive = live ?? dock.live;
  const cap = useRef<HTMLDivElement | null>(null);
  const min = useScrollShrink();
  useBead(cap, "dock", active, `${isLive}:${min}`);
  // (no refraction here: the dock is the glass, and a lens on its inner capsule nests a second backdrop-filter that
  // only sees the dock's own tint — grey in Día; the boards draw the dock with its blur glass alone)
  useLightPointer(cap);
  return (
    <nav className={`vx-dock vd-glass${min ? " is-min" : ""}`} aria-label="Navegación móvil">
      <div ref={cap} className="vx-dock-in">
        <span className="vd-bead" aria-hidden="true" />
        {NAV.map((d) => {
          const on = d.key === active;
          const dot = isLive && d.key === "partidos";
          return (
            <Link
              key={d.key}
              to={d.to}
              className={on ? "on" : undefined}
              aria-current={on ? "page" : undefined}
              viewTransition={!on}
              onClick={(e) => {
                if (on || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                go(e, active ?? "otra", d.key);
              }}
            >
              <span className="ico">
                <VIcon name={d.icon} size={22} />
                {dot && <span className="vd-livedot" aria-hidden="true" />}
              </span>
              <span className="lbl">{d.label}</span>
              {dot && <span className="vd-vh">, en directo</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The footer's theme switch (the top bar has none: the boards keep it in the account sheet and here). */
function FootTheme() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "claro" : "oscuro";
  return (
    <button type="button" className="mp-theme-toggle" onClick={toggle} aria-label={`Cambiar a tema ${next}`} title={`Cambiar a tema ${next}`}>
      <VIcon name={theme === "dark" ? "sun" : "moon"} size={19} />
    </button>
  );
}

export function CelesteFooter() {
  return (
    <footer className="vx-foot">
      <span className="b">
        <img src="/crest-128.webp" alt="" />
        Manchester Piti
      </span>
      <nav aria-label="Pie de página">
        <Link to="/partidos">Partidos</Link>
        <Link to="/plantilla">Plantilla</Link>
        <Link to="/estadisticas">Estadísticas</Link>
        <Link to="/club">Club</Link>
        <Link to="/vestuario">Vestuario</Link>
      </nav>
      <div className="vx-foot-theme">
        <FootTheme />
      </div>
      <small>
        Hecho por y para el equipo · © {new Date().getFullYear()} Manchester Piti
        <br />
        {/* CC BY 4.0 requires crediting the 3D kit model. */}
        Camiseta 3D basada en{" "}
        <a href="https://sketchfab.com/3d-models/football-jersey-style-design-d00dffa54c5b49b2941e0a34995f914e" target="_blank" rel="noopener noreferrer">
          «Football Jersey Style Design»
        </a>{" "}
        de Wearable3D · CC BY 4.0
      </small>
    </footer>
  );
}
