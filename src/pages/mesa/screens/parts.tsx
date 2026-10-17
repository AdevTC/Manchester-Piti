// Pieces the four screens draw the same way: the shirt (sky, keeper, bench), the play icons, small glyphs,
// the LED housing's screws and the header's back button.
import type { ReactNode } from "react";
import type { IconId } from "./model";

const SHIRT = "M15 3 L20 1.5 Q24 6 28 1.5 L33 3 L46 11 L41 20 L36 17 L36 42 L12 42 L12 17 L7 20 L2 11 Z";

/** The gradients the shirts paint with (render once per screen). */
export function ShirtDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="msSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9efff" /><stop offset=".55" stopColor="#9fd0f2" /><stop offset="1" stopColor="#6aa7d6" /></linearGradient>
        <linearGradient id="msGk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a3f78" /><stop offset="1" stopColor="#101b3c" /></linearGradient>
        <linearGradient id="msBench" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d2c58" /><stop offset="1" stopColor="#121c3d" /></linearGradient>
      </defs>
    </svg>
  );
}

/** A shirt with its dorsal: on the pitch (sky, or navy and gold for the keeper) or on the bench. */
export function Shirt({ n, keeper = false, bench = false, w = 40, h = 37 }: { n: string; keeper?: boolean; bench?: boolean; w?: number; h?: number }) {
  if (bench)
    return (
      <span className="shirt">
        <svg width={w} height={h} viewBox="0 0 48 44" aria-hidden="true"><path d={SHIRT} fill="url(#msBench)" stroke="rgba(169,214,245,.75)" strokeWidth="2" strokeLinejoin="round" /></svg>
        <span className="dor" aria-hidden="true">{n}</span>
      </span>
    );
  return (
    <span className="shirt">
      <span className="shadow" />
      <svg width={w} height={h} viewBox="0 0 48 44" aria-hidden="true">
        <path d={SHIRT} fill={keeper ? "url(#msGk)" : "url(#msSky)"} stroke={keeper ? "#FFC659" : "rgba(255,255,255,.55)"} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M20 1.8 Q24 7.5 28 1.8" fill="none" stroke={keeper ? "#FFC659" : "#2a73ad"} strokeWidth="1.6" />
        <path d="M12 17 L12 23 M36 17 L36 23" stroke="rgba(12,23,51,.18)" strokeWidth="1" />
      </svg>
      <span className="dor" style={{ color: keeper ? "#ffd98c" : "#0c1733" }} aria-hidden="true">{n}</span>
    </span>
  );
}

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.1, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const PATHS: Record<IconId, ReactNode> = {
  gol: (
    <g {...S} strokeWidth={1.8}><circle cx="12" cy="12" r="9.5" /><path d="M12 8l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z" fill="currentColor" /><path d="M12 8V2.6M15.8 10.8l5-1.6M14.3 15.2l3.1 4.3M9.7 15.2l-3.1 4.3M8.2 10.8l-5-1.6" /></g>
  ),
  falta: <g {...S}><path d="M10 11H3l2-4h8" /><circle cx="15" cy="13" r="5" /></g>,
  cambio: <g {...S}><path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" /></g>,
  palo: <g {...S}><path d="M4 21V5h16v16" /><circle cx="17" cy="9" r="2.4" /></g>,
  parada: <g {...S} strokeWidth={2}><path d="M7 12V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7 6 6 0 0 1-5.2-3L4.5 14a1.5 1.5 0 0 1 2.6-1.5L8 14" /></g>,
  ocasion: <g {...S}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></g>,
  corner: <g {...S}><path d="M6 21V3l11 4.5L6 12" /><path d="M3 21h8" /></g>,
  amarilla: (
    <g transform="rotate(6 12 12)"><rect x="6" y="3" width="12" height="18" rx="2" fill="#FFC659" /><path d="M9.6 16.6l2.2-8.2h1.2l2.2 8.2M10.4 13.8h3.6" fill="none" stroke="#0c1733" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></g>
  ),
  roja: (
    <g transform="rotate(6 12 12)"><rect x="6" y="3" width="12" height="18" rx="2" fill="#ff6b61" /><path d="M10 16.6V8.4h2.6a2.2 2.2 0 0 1 0 4.4H10M12.4 12.8l2.2 3.8" fill="none" stroke="#0c1733" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></g>
  ),
  tocado: <g {...S}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></g>,
  fuera: <g {...S}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></g>,
  penalti: <g {...S}><circle cx="12" cy="15" r="5" /><path d="M4 4h16M8 4v4M16 4v4" /></g>,
};

/** A play's icon (sized by CSS). */
export function Icon({ id, size }: { id: IconId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {PATHS[id]}
    </svg>
  );
}

export function Check({ size = 13, width = 3.4, color = "currentColor" }: { size?: number; width?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function Whistle({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFC659" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11a5 5 0 015-5h12v4l-5 2a6 6 0 11-12-1z" />
      <circle cx="9" cy="12" r="1.6" />
    </svg>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="back" aria-label={label} onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

/** The LED housing's two top screws, inset by `at` px. */
export function Screws({ at }: { at: number }) {
  return (
    <>
      <span className="screw" style={{ left: at, top: at }} />
      <span className="screw" style={{ right: at, top: at }} />
    </>
  );
}
