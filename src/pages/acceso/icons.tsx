// The door's extra line icons (same 24px grid and stroke as components/celeste/icons).
import type { CSSProperties, ReactNode } from "react";

const P = {
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  bell: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 21h4" /></>),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  link: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  replay: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  door: (<><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18M15 12h.01" /></>),
  copy: (<><rect x="8" y="8" width="13" height="13" rx="3" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>),
  chat: (<><path d="M4 20l1.4-4A8 8 0 1 1 8 18.6Z" /><path d="M9 10h6M9 13.5h4" /></>),
  qr: (<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h3M21 18v3h-3" /></>),
  print: (<><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7Z" /></>),
  out: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  wifi: (<><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><path d="M12 19.5h.01" /></>),
  phone: (<><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>),
  ticket: (<><path d="M3 9.5a2 2 0 0 0 0 4v4a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-4a2 2 0 0 1 0-4v-3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1Z" /><path d="M14 6v13" strokeDasharray="2 2" /></>),
  alert: (<><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>),
  hour: <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9" />,
  undo: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>),
  chev: <path d="m6 9 6 6 6-6" />,
  route: (<><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>),
  wall: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 12h18M9 4v8M15 12v8" /></>),
} satisfies Record<string, ReactNode>;
export type DoorIconName = keyof typeof P;

export function DIcon({ name, size = 18, stroke = 1.8 }: { name: DoorIconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

export function GoogleLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const SHIRT = "M62 8 C75 22 125 22 138 8 L190 34 L176 84 L156 76 L156 202 L44 202 L44 76 L24 84 L10 34 Z";
/** Small flat shirt with the dorsal (sky, gold, navy or switched off). */
export function MiniShirt({ num, tone = "" }: { num: string; tone?: "" | "gold" | "navy" | "off" }) {
  return (
    <span className={`msh ${tone}`} aria-hidden="true">
      <svg viewBox="0 0 200 210">
        <path d={SHIRT} />
      </svg>
      <b>{num}</b>
    </span>
  );
}
/** A shirt back drawn in SVG: name over the dorsal (no WebGL). */
export function ShirtBack({ name, num, scale = 1, className = "" }: { name: string; num: string; scale?: number; className?: string }) {
  return (
    <div className={`sback ${className}`} style={{ "--s": scale } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 200 210">
        <defs>
          <linearGradient id="dr-sbh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d4ecfc" />
            <stop offset="1" stopColor="#6CABDD" />
          </linearGradient>
        </defs>
        <path d={SHIRT} fill="url(#dr-sbh)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        <path d="M62 8 C75 22 125 22 138 8" fill="none" stroke="rgba(12,23,51,.35)" strokeWidth="5" />
      </svg>
      <span className="nm">{name}</span>
      <span className="nb">{num}</span>
    </div>
  );
}
