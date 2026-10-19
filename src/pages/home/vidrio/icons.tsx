// The stroke icons of the V-Inicio boards (their defs.html symbols), drawn inline.
import type { ReactNode } from "react";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const PATHS = {
  ball: (
    <>
      <circle cx="12" cy="12" r="9" {...S} strokeWidth="1.8" />
      <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="currentColor" />
      <path d="M12 3v4.5M15.6 10.1l4.6-1.6M14.2 14.3l2.7 3.9M9.8 14.3l-2.7 3.9M8.4 10.1L3.8 8.5" {...S} strokeWidth="1.5" />
    </>
  ),
  swap: <path d="M7 4v13M3.5 13.5L7 17l3.5-3.5M17 20V7M13.5 10.5L17 7l3.5 3.5" {...S} strokeWidth="2" />,
  post: (
    <>
      <path d="M5 20V5h14v15" {...S} strokeWidth="2.2" />
      <circle cx="15.5" cy="9" r="3" fill="currentColor" />
    </>
  ),
  glove: <path d="M7 21v-6.5L4.5 11a1.6 1.6 0 012.4-2L8 10.2V5.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V10V5.5a1.5 1.5 0 013 0V15l-2 6z" {...S} strokeWidth="1.8" />,
  whistle: (
    <>
      <path d="M3 10h11l6-3v5a6 6 0 11-12 0" {...S} strokeWidth="1.9" />
      <circle cx="14" cy="14" r="1.6" fill="currentColor" />
    </>
  ),
  pass: <path d="M4 17c4-8 10-11 16-11M14 4l6 2-2 6" {...S} strokeWidth="2" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" {...S} strokeWidth="2" />
      <circle cx="12" cy="9.5" r="2.5" {...S} strokeWidth="2" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...S} strokeWidth="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" {...S} strokeWidth="2" />
    </>
  ),
  pip: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" {...S} strokeWidth="2" />
      <rect x="11.5" y="11.5" width="7" height="5.5" rx="1.5" fill="currentColor" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" {...S} strokeWidth="2" />
      <path d="M10 20.5a2 2 0 004 0" {...S} strokeWidth="2" />
    </>
  ),
  shirt: <path d="M8.5 3.5L3.5 6l1.8 4.2 2.2-.9V20.5h9V9.3l2.2.9L20.5 6l-5-2.5a3.5 3.5 0 01-7 0z" {...S} strokeWidth="1.9" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" {...S} strokeWidth="2.2" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" {...S} strokeWidth="2" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" {...S} strokeWidth="2" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" {...S} strokeWidth="2" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...S} strokeWidth="2.4" />,
  share: <path d="M12 15V3.5M8 7.5l4-4 4 4M5 12v6.5A2 2 0 007 20.5h10a2 2 0 002-2V12" {...S} strokeWidth="2" />,
  down: <path d="M12 3.5V15M8 11l4 4 4-4M5 19.5h14" {...S} strokeWidth="2" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" {...S} strokeWidth="2" />
      <path d="M8 11V8a4 4 0 018 0v3" {...S} strokeWidth="2" />
    </>
  ),
  sunset: <path d="M4 17h16M7 17a5 5 0 0110 0M12 4v4M5 9.5l2 1.5M19 9.5l-2 1.5M3 20.5h18" {...S} strokeWidth="1.9" />,
  cake: (
    <>
      <path d="M4 20.5h16V13a2 2 0 00-2-2H6a2 2 0 00-2 2zM4 16c2 1.2 4 1.2 5.3 0 1.4 1.2 4 1.2 5.4 0 1.3 1.2 3.3 1.2 5.3 0M12 11V7.5" {...S} strokeWidth="1.9" />
      <path d="M12 3.2c1.2 1.3 1.2 2.6 0 3.3-1.2-.7-1.2-2 0-3.3z" fill="currentColor" />
    </>
  ),
  trophy: <path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1.5A3 3 0 008 10.5M16 6h3.5v1.5a3 3 0 01-3.5 3M12 13v4M8.5 20.5h7M10 17h4" {...S} strokeWidth="1.9" />,
  euro: <path d="M17.5 6.5a7 7 0 100 11M4 10h9M4 14h9" {...S} strokeWidth="2" />,
  expand: <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" {...S} strokeWidth="2" />,
  flag: <path d="M6 21V4M6 4.5c4-2 6 2 11 0v8c-5 2-7-2-11 0" {...S} strokeWidth="2" />,
  card: <rect x="7" y="4" width="10" height="16" rx="2" {...S} strokeWidth="2" />,
  chance: <path d="M4 17c4-8 10-11 16-11M14 4l6 2-2 6" {...S} strokeWidth="2" />,
  offside: <path d="M6 21V4M6 4.5c4-2 6 2 11 0v8c-5 2-7-2-11 0" {...S} strokeWidth="2" />,
} satisfies Record<string, ReactNode>;

export type IconId = keyof typeof PATHS;

export function Ico({ id, className }: { id: IconId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {PATHS[id]}
    </svg>
  );
}
