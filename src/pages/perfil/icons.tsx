// /profile «La carta»: the design's stroke icons (stats-gen/pf-g.mjs, pf-d-data.mjs, common*.mjs), all
// decorative (aria-hidden) — the text next to them always says the same thing.
import type { ReactNode } from "react";

const PATHS = {
  // pf-g «J»
  prev: <path d="M16 5 7 12l9 7Z" fill="currentColor" />,
  next: <path d="m8 5 9 7-9 7Z" fill="currentColor" />,
  flip: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1.5S9.5 8 12 8Zm0 0c2-4 6-4 6-1.5S14.5 8 12 8Z" />
    </>
  ),
  tilt: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" transform="rotate(-14 12 12)" />
      <path d="M3 8a10 10 0 0 0 0 8M21 8a10 10 0 0 1 0 8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  press: (
    <>
      <path d="M4 9h16v4H4Z" />
      <path d="M12 9V3M8 3h8M6 17h12M8 20h8" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  // pf-d «I»
  check: <path d="m5 12 5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  right: <path d="m9 6 6 6-6 6" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="3" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18M15 12h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  inf: <path d="M12 12c-2-2.7-3.6-4-5.5-4a4 4 0 0 0 0 8c1.9 0 3.5-1.3 5.5-4Zm0 0c2 2.7 3.6 4 5.5 4a4 4 0 0 0 0-8c-1.9 0-3.5 1.3-5.5 4Z" />,
  board: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  vote: (
    <>
      <path d="M4 13h16v7H4Z" />
      <path d="m8 9 3 3 5-6" />
    </>
  ),
  replay: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  armband: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M14.5 10.2a2.6 2.6 0 1 0 0 3.6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  // pf-d «I» (Avisos · Ajustes · Cuenta)
  chev: <path d="m6 9 6 6 6-6" />,
  out: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  phone: (
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  cube: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  motion: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  minus: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M16 11h6" />
    </>
  ),
  apple: (
    <>
      <path d="M16.5 3.5c-1.4.1-2.9 1-3.6 2.3-.6 1.1-.5 2.2-.4 2.4 1.4.1 2.8-.8 3.5-2 .5-.9.6-1.9.5-2.7Z" />
      <path d="M19.6 16.6c-.6 1.4-.9 2-1.7 3.2-1.1 1.7-2.6 2.2-3.6 1.4-.8-.5-1.9-.6-2.8 0-1.3.8-2.4.4-3.4-.9C5.4 17 4.6 12.6 6.6 10.2c1-1.2 2.4-1.6 3.6-1.3.9.2 1.6.6 2 .6.4 0 1.3-.5 2.4-.7 1.4-.2 2.9.4 3.8 1.6-3.3 1.9-2.8 5.9 1.2 7.2Z" />
    </>
  ),
  // pf-g «J»
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  // common «ICON»
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="4" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 4.5h-5L8 10Z" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 21h4" />
    </>
  ),
  shirt: <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />,
  // common3 «ICON2»
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  flame: <path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7Z" />,
  medal: (
    <>
      <circle cx="12" cy="15" r="6" />
      <path d="M8.5 10 6 3h4l2 4 2-4h4l-2.5 7" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type PIcon = keyof typeof PATHS;

/** Stroke widths the design draws each icon with (default 1.8). */
const STROKE: Partial<Record<PIcon, number>> = {
  prev: 1.4,
  next: 1.4,
  gift: 2,
  clock: 2,
  lock: 2,
  info: 2,
  check: 2.4,
  x: 2.4,
  right: 2.2,
  alert: 2,
  inf: 2,
  armband: 2,
  arrow: 2.2,
  ball: 1.6,
  shirt: 1.6,
  chev: 2.2,
  ban: 2,
};

export function Ic({ n, w = 18 }: { n: PIcon; w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE[n] ?? 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[n]}
    </svg>
  );
}

export const CREST = "/crest-128.webp";

/** Google's «G» (the design's GLOGO), in its own colours. */
export function GLogo({ w = 20 }: { w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
