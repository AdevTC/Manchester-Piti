// «El club» · the pieces every screen of the club and the vestuario draws as the CL- boards do: the sprite (the
// kit's glyphs as <symbol>s plus the vitrina's crafted objects), an icon from it, the light field with its bokeh,
// a shelf object, the piece turning on the peana, the room's head and its «Siguiente sala» foot.
import { useEffect, useRef, type AnchorHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { VIcon, type VIconName } from "../../../components/vidrio/VIcon";
import { bokehDiscs, paintDiscs } from "../../../components/vidrio/sky";
import { OBJECTS_SVG } from "./objects";
import { PIECE_OBJ, type Piece } from "./model";

export const CREST = "/crest-128.webp";
export type IconName = VIconName | "chev-l" | "chev-r" | "play" | "pause" | "pin";
const KIT_ICONS: readonly VIconName[] = ["home", "fixtures", "shirt", "chart", "shield", "bell", "search", "tab", "post", "glove", "whistle", "ball", "flag", "expand", "collapse", "close", "lock", "cake", "cal", "check", "arrow", "star", "wash", "poll", "euro", "mesa", "share", "trophy", "logout", "away", "bolt", "swap"];
const ST = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The page's sprite: the glyphs (vi-*) and the objects (ob-*, og-*), in a hidden svg. */
export function Sprite() {
  return (
    <svg className="cb-sprite" width="0" height="0" aria-hidden="true" focusable="false">
      {KIT_ICONS.map((n) => (
        <symbol key={n} id={`vi-${n}`} viewBox="0 0 24 24">
          <VIcon name={n} size={24} />
        </symbol>
      ))}
      <symbol id="vi-chev-l" viewBox="0 0 24 24">
        <path {...ST} strokeWidth={2.2} d="M15 5l-7 7 7 7" />
      </symbol>
      <symbol id="vi-chev-r" viewBox="0 0 24 24">
        <path {...ST} strokeWidth={2.2} d="M9 5l7 7-7 7" />
      </symbol>
      <symbol id="vi-play" viewBox="0 0 24 24">
        <path fill="currentColor" d="M8 5.5v13l11-6.5z" />
      </symbol>
      <symbol id="vi-pause" viewBox="0 0 24 24">
        <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
        <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
      </symbol>
      <symbol id="vi-pin" viewBox="0 0 24 24">
        <path {...ST} strokeWidth={2} d="M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11z" />
        <circle fill="currentColor" cx="12" cy="10" r="2.2" />
      </symbol>
      <g dangerouslySetInnerHTML={{ __html: OBJECTS_SVG }} />
    </svg>
  );
}

/** An icon from the sprite (`cb-i` unless the host's CSS sizes the svg itself). */
export function I({ n, className = "cb-i" }: { n: IconName; className?: string | null }) {
  return (
    <svg className={className ?? undefined} aria-hidden="true" focusable="false">
      <use href={`#vi-${n}`} />
    </svg>
  );
}

/** The light field (the board's vd-sky, Noche floodlit or Día) and its bokeh canvas. */
export function Sky({ day }: { day: boolean }) {
  return (
    <div className={`vd-sky ${day ? "vd-l-day" : "vd-l-flood"}`} aria-hidden="true">
      <div className="vd-sky__base" />
      <div className="vd-sky__sun" />
      <div className="vd-sky__drift">
        <div className="vd-sky__banks" />
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
export function Bokeh({ day }: { day: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const host = cv?.parentElement;
    if (!cv || !host || typeof cv.getContext !== "function") return;
    let width = 0;
    const draw = () => {
      const w = host.clientWidth;
      const h = Math.min(host.clientHeight || 900, 1400);
      if (!w || w === width) return;
      width = w;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const g = cv.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      paintDiscs(g, bokehDiscs(day ? "day" : "flood", w, h));
    };
    draw();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(draw);
    ro.observe(host);
    return () => ro.disconnect();
  }, [day]);
  return <canvas ref={ref} className="cb-bokeh" aria-hidden="true" />;
}

export interface ObjCtx {
  /** The kit's front still (the shirt pieces), undefined until it is drawn. */
  front: string | undefined;
  /** The first jornada, for the ticket: «J1 · 18 oct», «1–8», «Orduña fc», the venue. */
  ticket: { j: string; score: string; rival: string; venue: string };
}
/** A piece as it stands on the shelf (or on the hero's face): the crafted object of its kind. */
export function Obj({ p, has, ctx }: { p: Piece; has: boolean; ctx: ObjCtx }) {
  const o = PIECE_OBJ[p.id];
  return (
    <span className={`cb-obj cb-obj--${o} ${has ? "is-has" : "is-locked"}${p.cup ? " is-big" : ""}`} aria-hidden="true">
      {o === "medal" && (
        <svg className="cb-obj__svg" viewBox="0 0 100 130" focusable="false">
          <use href={`#ob-medal-${p.gold ? "gold" : "silver"}`} />
          <use className="cb-obj__eng" href={`#vi-${p.icon}`} x="37" y="79" width="26" height="26" />
        </svg>
      )}
      {o === "cup" && (
        <svg className="cb-obj__svg" viewBox="0 0 100 130" focusable="false">
          <use href="#ob-cup" />
        </svg>
      )}
      {o === "ball" && (
        <svg className="cb-obj__svg" viewBox="0 0 100 130" focusable="false">
          <use href="#ob-ball" />
        </svg>
      )}
      {o === "plaque" && (
        <svg className="cb-obj__svg" viewBox="0 0 100 130" focusable="false">
          <use href="#ob-plaque" />
          <use className="cb-obj__eng" href={`#vi-${p.icon}`} x="36" y="46" width="28" height="28" />
        </svg>
      )}
      {o === "ticket" && (
        <span className="cb-tk">
          <span className="cb-tk__top">Manchester Piti</span>
          <b className="cb-tk__j">{ctx.ticket.j}</b>
          <span className="cb-tk__score">{ctx.ticket.score}</span>
          <span className="cb-tk__rival">{ctx.ticket.rival}</span>
          <span className="cb-tk__foot">{ctx.ticket.venue}</span>
        </span>
      )}
      {o === "crest" && (
        <span className="cb-puck">
          <img src={CREST} alt="" width={128} height={128} />
        </span>
      )}
      {o === "shirt" && (ctx.front ? <img className="cb-obj__shirt" src={ctx.front} alt="" width={540} height={600} /> : <span className="cb-obj__shirt" />)}
    </span>
  );
}

const BALL_PATH =
  "M50.0 35.0L64.3 45.4L58.8 62.1L41.2 62.1L35.7 45.4ZM7.1 4.3L11.4 17.7L0.0 26.0L-11.4 17.7L-7.1 4.3ZM107.1 4.3L111.4 17.7L100.0 26.0L88.6 17.7L92.9 4.3ZM7.1 76.3L11.4 89.7L0.0 98.0L-11.4 89.7L-7.1 76.3ZM107.1 76.3L111.4 89.7L100.0 98.0L88.6 89.7L92.9 76.3ZM25.0 -11.0L33.6 -4.8L30.3 5.3L19.7 5.3L16.4 -4.8ZM75.0 -11.0L83.6 -4.8L80.3 5.3L69.7 5.3L66.4 -4.8ZM30.3 94.7L33.6 104.8L25.0 111.0L16.4 104.8L19.7 94.7ZM80.3 94.7L83.6 104.8L75.0 111.0L66.4 104.8L69.7 94.7Z";
const K = (n: number) => ({ "--k": n }) as CSSProperties;

/** The piece on the peana, turning as a real object: the ball's panels slide under fixed shading, a medal or a plate
 *  shows its thickness and its back («MP»), the shirt has its back, the cup keeps its shape while its light travels. */
export function Hero3({ p, has, ry, ctx, back }: { p: Piece; has: boolean; ry: number; ctx: ObjCtx; back: string | undefined }) {
  const o = PIECE_OBJ[p.id];
  const ryN = (((ry % 360) + 540) % 360) - 180;
  const style = { "--ry": `${ry}deg`, "--pan": `${((-(ryN + 180) / 360) * 50).toFixed(2)}%`, "--hl": `${(50 - ryN / 3.6).toFixed(1)}%` } as CSSProperties;
  const cls = `cb-hero3 cb-hero--${o}${has ? "" : " is-locked"}${p.gold && has ? " is-gold" : ""}`;
  return (
    <div className={cls} style={style}>
      {o === "ball" && (
        <span className="cb-sph">
          <svg className="cb-sph__pan" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <g className="cb-sph__tile">
              <path d={BALL_PATH} />
            </g>
            <g className="cb-sph__tile" transform="translate(100 0)">
              <path d={BALL_PATH} />
            </g>
          </svg>
          <span className="cb-sph__shade" />
          <span className="cb-sph__rim" />
          <span className="cb-sph__spec" />
        </span>
      )}
      {(o === "medal" || o === "crest") && (
        <span className="cb-thick cb-thick--disc">
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <i key={k} style={K(k)} />
          ))}
          <i className="cb-thick__back" style={K(8)}>
            <b>MP</b>
          </i>
          <span className="cb-thick__face">
            <Obj p={p} has={has} ctx={ctx} />
          </span>
          <span className="cb-thick__shine" />
        </span>
      )}
      {(o === "plaque" || o === "ticket") && (
        <span className="cb-thick cb-thick--plate">
          {[1, 2, 3, 4].map((k) => (
            <i key={k} style={K(k)} />
          ))}
          <i className="cb-thick__back" style={K(5)}>
            <b>MP</b>
          </i>
          <span className="cb-thick__face">
            <Obj p={p} has={has} ctx={ctx} />
          </span>
          <span className="cb-thick__shine" />
        </span>
      )}
      {o === "shirt" && (
        <span className="cb-thick cb-thick--shirt">
          {ctx.front && <img className="cb-thick__front" src={ctx.front} alt="" width={540} height={600} />}
          {back && <img className="cb-thick__rear" src={back} alt="" width={540} height={600} />}
        </span>
      )}
      {o === "cup" && (
        <svg className="cb-cup3" viewBox="0 0 100 130" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="cb-cuphl" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse" gradientTransform={`translate(${(-ryN / 2).toFixed(1)} 0)`}>
              <stop offset="0" stopColor="#4b576a" />
              <stop offset=".25" stopColor="#b9c4d2" />
              <stop offset=".42" stopColor="#ffffff" />
              <stop offset=".52" stopColor="#d9e1ea" />
              <stop offset=".78" stopColor="#7d8aa0" />
              <stop offset="1" stopColor="#3f4a5c" />
            </linearGradient>
          </defs>
          <path d="M22 16c-12 0-16 8-14 16 3 11 13 17 22 18" fill="none" stroke="url(#cb-cuphl)" strokeWidth="5" strokeLinecap="round" />
          <path d="M78 16c12 0 16 8 14 16-3 11-13 17-22 18" fill="none" stroke="url(#cb-cuphl)" strokeWidth="5" strokeLinecap="round" />
          <path fill="url(#cb-cuphl)" d="M20 8h60v12c0 30-14 48-30 48S20 50 20 20z" />
          <ellipse cx="50" cy="9" rx="30" ry="4" fill="#eef3f9" />
          <ellipse cx="50" cy="9" rx="26" ry="2.6" fill="#5d6a80" />
          <rect x="45" y="66" width="10" height="20" fill="url(#cb-cuphl)" />
          <ellipse cx="50" cy="78" rx="9" ry="4" fill="url(#cb-cuphl)" />
          <path fill="url(#cb-cuphl)" d="M32 88h36l4 14H28z" />
          <rect x="22" y="102" width="56" height="16" rx="3" fill="#1b2a4d" />
          <rect x="22" y="102" width="56" height="3" rx="1.5" fill="#3a5288" />
          <rect x="36" y="107" width="28" height="7" rx="1.5" fill="url(#cb-cuphl)" opacity=".85" />
        </svg>
      )}
    </div>
  );
}

/** A room's head: «El club» back, the title, its line (and La historia's story). The touched door grows into it. */
export function RoomHead({ vt, back, backLabel = "El club", title, sub, extra, titleId }: { vt: string; back: () => void; backLabel?: string; title: string; sub: string; extra?: string; titleId?: string }) {
  return (
    <header className="cb-roomhead" style={{ viewTransitionName: vt }}>
      <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm cb-back" onClick={back}>
        <I n="chev-l" />
        {backLabel}
      </button>
      <h1 className="cb-roomhead__t" id={titleId} tabIndex={-1}>
        {title}
      </h1>
      <p className="cb-roomhead__s">{sub}</p>
      {extra && <p className="cb-roomhead__x">{extra}</p>}
    </header>
  );
}

/** The room's foot: the next room (its door's living line), or back to the hub from the last one. */
export function RoomEnd({ label, title, line, go }: { label: string; title: string; line: string; go: (e: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <footer className="cb-roomend">
      <button type="button" className="cb-nextroom" style={{ viewTransitionName: "none" }} onClick={go}>
        <span className="cb-nextroom__k">{label}</span>
        <b>{title}</b>
        <span className="cb-nextroom__d">{line}</span>
        <I n="chev-r" />
      </button>
    </footer>
  );
}

/** The page's toast (the board's say): a polite status for readers, the glass pill for the eye. */
export function Toast({ say, on }: { say: string; on: boolean }): ReactNode {
  return (
    <>
      <p className="vd-vh" role="status" aria-live="polite">
        {say}
      </p>
      <div className={`cb-toast${on ? " is-on" : ""}`} aria-hidden="true">
        <I n="check" />
        <span>{say}</span>
      </div>
    </>
  );
}

/** A link to an address through the router (a plain link for a new tab or a modified click). */
export function Go({ href, children, onClick, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const router = useRouter();
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
    e.preventDefault();
    void router.navigate({ href });
  };
  return (
    <a href={href} onClick={follow} {...rest}>
      {children}
    </a>
  );
}
