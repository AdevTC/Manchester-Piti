// Partidos «Vidrio»: the small drawn pieces — the line icons the page needs beyond the Celeste set, a shirt
// (the real still when the page has one), the rival's crest, the pitch lines, the match's signature as SVG and
// the light of the evening (the sun's height around the kick-off, from sun.ts).
import { useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { MatchSignature } from "../../../lib/derived/vidrio/signature";
import { sunPosition } from "../../../lib/derived/sun";
import { StillContext } from "./stills";
import { sunCurve } from "./sunCurve";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const GLYPHS = {
  pin: (
    <>
      <path {...P} d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle {...P} cx="12" cy="9.8" r="2.4" />
    </>
  ),
  filter: <path {...P} d="M4 6h16M7 12h10M10 18h4" />,
  expand: <path {...P} d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />,
  collapse: <path {...P} d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />,
  pip: (
    <>
      <rect {...P} x="3" y="5" width="18" height="14" rx="3" />
      <rect x="12" y="11" width="6.5" height="5" rx="1.2" fill="currentColor" />
    </>
  ),
  glove: <path {...P} strokeWidth={1.7} d="M7 21v-6.5L4.5 11a1.6 1.6 0 012.4-2L8 10.2V5.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V10V5.5a1.5 1.5 0 013 0V15l-2 6z" />,
  post: (
    <>
      <path {...P} d="M5 20V5h14v15" />
      <circle cx="15.5" cy="9" r="2.6" fill="currentColor" />
    </>
  ),
  whistle: (
    <>
      <path {...P} d="M3 10h9.5a4.5 4.5 0 1 1-4.3 5.8L3 14Z" />
      <path {...P} d="M12 10V6h3" />
    </>
  ),
  pass: <path {...P} d="M5 19 19 5M10 5h9v9" />,
  swap: <path {...P} d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  ball: (
    <>
      <circle {...P} strokeWidth={1.8} cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="currentColor" />
      <path {...P} strokeWidth={1.5} d="M12 3v4.5M15.6 10.1l4.6-1.6M14.2 14.3l2.7 3.9M9.8 14.3l-2.7 3.9M8.4 10.1L3.8 8.5" />
    </>
  ),
  chev: <path {...P} d="m6 9 6 6 6-6" />,
  left: <path {...P} d="m15 6-6 6 6 6" />,
  right: <path {...P} d="m9 6 6 6-6 6" />,
  reset: (
    <>
      <path {...P} d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6" />
      <path {...P} d="M4 4v4.6h4.6" />
    </>
  ),
  share: (
    <>
      <path {...P} d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path {...P} d="M16 6l-4-4-4 4M12 2v14" />
    </>
  ),
  down: <path {...P} d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  cal: (
    <>
      <rect {...P} x="3" y="4" width="18" height="18" rx="4" />
      <path {...P} d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  bell: (
    <>
      <path {...P} d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Z" />
      <path {...P} d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  lock: (
    <>
      <rect {...P} x="5" y="11" width="14" height="10" rx="2" />
      <path {...P} d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path {...P} d="M20 6 9 17l-5-5" />,
  close: <path {...P} d="M18 6 6 18M6 6l12 12" />,
  search: (
    <>
      <circle {...P} cx="11" cy="11" r="7" />
      <path {...P} d="m20 20-3.5-3.5" />
    </>
  ),
  arrow: <path {...P} d="M12 19V5M6 11l6-6 6 6" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" fill="currentColor" />,
  cloud: <path {...P} d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.2 3.2 0 0 0 7 18Z" />,
  sun: (
    <>
      <circle {...P} cx="12" cy="12" r="4" />
      <path {...P} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  rain: (
    <>
      <path {...P} d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.2 3.2 0 0 0 7 15Z" />
      <path {...P} d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  trophy: (
    <>
      <path {...P} d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path {...P} d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
} as const;
export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name, className, style }: { name: GlyphName; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} style={style}>
      {GLYPHS[name]}
    </svg>
  );
}

// ───────────────────────── shirts ─────────────────────────

export function Shirt({ num, size = 44, kit = "home", captain = false }: { num?: string; size?: number; kit?: "home" | "away"; captain?: boolean }) {
  const still = useContext(StillContext)(kit);
  const style = { "--s": `${size}px`, ...(still ? { "--vd-shirt-img": `url("${still}")` } : {}) } as CSSProperties;
  return (
    <span className={`vd-shirt${kit === "away" ? " vd-shirt--away" : ""}${still ? " vd-shirt--img" : ""}`} style={style} aria-hidden="true">
      {num ? <b>{num}</b> : null}
      {captain && <i className="vd-arm" />}
    </span>
  );
}

export function RivalCrest({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={`vd-team__crest vd-team__crest--rival${className ? ` ${className}` : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}

/** A horizontal pitch: our goal on the left. */
export function PitchLines() {
  return (
    <svg className="vd-pitch__lines" viewBox="0 0 400 176" preserveAspectRatio="none" aria-hidden="true">
      <rect x="8" y="8" width="384" height="160" rx="4" />
      <path d="M200 8v160" />
      <circle cx="200" cy="88" r="26" />
      <rect x="8" y="48" width="48" height="80" />
      <rect x="344" y="48" width="48" height="80" />
    </svg>
  );
}

// ───────────────────────── the match's signature ─────────────────────────

export function SignatureSvg({ sig, className, labelled }: { sig: MatchSignature; className?: string; labelled?: string }) {
  return (
    <svg className={`vp-sig${className ? ` ${className}` : ""}`} viewBox={sig.viewBox} role={labelled ? "img" : undefined} aria-label={labelled} aria-hidden={labelled ? undefined : true}>
      {sig.future.map((d, i) => (
        <path key={`f${i}`} className="vp-sig__fut" d={d} />
      ))}
      {sig.rings.map((r, i) => (
        <path key={i} className={r.outer ? "vp-sig__o" : "vp-sig__i"} style={{ opacity: r.opacity }} strokeWidth={r.strokeWidth} d={r.d} />
      ))}
      {sig.ticks && <path className="vp-sig__tick" d={sig.ticks} />}
      {sig.halfMarks.map((d, i) => (
        <path key={`h${i}`} className="vp-sig__ko" d={d} />
      ))}
      {sig.marks.map((m) =>
        m.kind === "gol" ? (
          <circle key={m.eventId} className="vp-sig__gol" cx={m.x} cy={m.y} r="3.6" />
        ) : m.kind === "rival" ? (
          <circle key={m.eventId} className="vp-sig__riv" cx={m.x} cy={m.y} r="3.4" />
        ) : m.kind === "tarjeta" ? (
          <rect key={m.eventId} className="vp-sig__am" x={m.x - 2.2} y={m.y - 3.2} width="4.4" height="6.4" rx=".8" />
        ) : m.kind === "palo" ? (
          <path key={m.eventId} className="vp-sig__x" d={`M${m.x - 2.6} ${m.y - 2.6} L${m.x + 2.6} ${m.y + 2.6} M${m.x + 2.6} ${m.y - 2.6} L${m.x - 2.6} ${m.y + 2.6}`} />
        ) : (
          <rect key={m.eventId} className="vp-sig__sq" x={m.x - 2.6} y={m.y - 2.6} width="5.2" height="5.2" />
        ),
      )}
      {sig.needle && (
        <>
          <path className="vp-sig__needle" d={sig.needle.d} />
          <circle className="vp-sig__halo" cx={sig.needle.x} cy={sig.needle.y} r="7" />
          <circle className="vp-sig__head" cx={sig.needle.x} cy={sig.needle.y} r="3.4" />
        </>
      )}
    </svg>
  );
}

// ───────────────────────── the light of that evening ─────────────────────────

export function SunRibbon({ kickoff, duration, id }: { kickoff: number; duration?: number; id: string }) {
  const c = sunCurve(kickoff, duration);
  const stop = c.sunset ?? (sunPosition(kickoff).elevation > 0 ? 1 : 0);
  const gid = `vp-sun-${id}`;
  // «focos» gives way when it would touch the kick-off or an edge label (a narrow column: the 1920 lens's previa);
  // the sunset still reads in the ribbon's own label
  const ribbon = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ribbon.current;
    if (!el) return;
    const fit = () => {
      const labs = [...el.querySelectorAll<HTMLElement>(".vd-ribbon__lab")];
      const focos = labs.find((l) => l.dataset.focos === "1");
      if (!focos) return;
      focos.style.removeProperty("visibility");
      const f = focos.getBoundingClientRect();
      const near = labs.some((l) => {
        if (l === focos) return false;
        const r = l.getBoundingClientRect();
        return r.left < f.right + 6 && f.left < r.right + 6;
      });
      if (near) focos.style.visibility = "hidden";
    };
    fit();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    void document.fonts?.ready.then(fit);
    return () => ro?.disconnect();
  }, [kickoff, duration]);
  return (
    <div ref={ribbon} className="vd-ribbon vp-sunr" role="img" aria-label={c.aria}>
      <svg viewBox="0 0 500 74" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" x2="1">
            <stop offset="0" stopColor="#F3B26B" stopOpacity=".55" />
            <stop offset={Math.max(0, stop - 0.02)} stopColor="#F3B26B" stopOpacity=".35" />
            <stop offset={stop} stopColor="#6CABDD" stopOpacity=".25" />
            <stop offset="1" stopColor="#6CABDD" stopOpacity=".12" />
          </linearGradient>
        </defs>
        <rect x="0" y="46" width="500" height="28" fill="rgba(234,243,252,.05)" />
        <line className="vd-ribbon__axis" x1="0" y1="46" x2="500" y2="46" />
        <path d={`${c.d} L500 56 L0 56 Z`} fill={`url(#${gid})`} />
        <path d={c.d} fill="none" stroke="#F3B26B" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <rect x={c.kick.x} y="8" width={c.kick.w} height="66" fill="rgba(234,243,252,.10)" />
        <line x1={c.kick.x} y1="4" x2={c.kick.x} y2="74" stroke="#EAF3FC" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {c.sunY !== null && <span className="vd-sun" style={{ left: "50%", top: `${c.sunY}%` }} />}
      {c.labels.map((l) => (
        <span key={l.text} className={`vd-ribbon__lab vd-ribbon__lab--${l.align}`} style={{ left: `${l.left}%` }} data-focos={l.text === "focos" ? "1" : undefined}>
          {l.text}
        </span>
      ))}
    </div>
  );
}

/** A label + value pair laid out as the boards' small counts. */
export function Count({ value, label, className }: { value: ReactNode; label: string; className?: string }) {
  return (
    <div className={`vd-count${className ? ` ${className}` : ""}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
