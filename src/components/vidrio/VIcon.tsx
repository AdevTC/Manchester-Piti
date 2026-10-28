// The boards' glyphs (V-Sistema / V-Vivo / V-Integracion symbols v-i-* and vv-i-*), drawn inline so any piece of
// the chrome, the live sheets, search, avisos and «Tú» can use them without a sprite. Decorative: aria-hidden.
import type { ReactNode } from "react";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GLYPHS = {
  home: <path {...S} strokeWidth={2} d="M4 11l8-6.5 8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  fixtures: (
    <>
      <circle {...S} strokeWidth={2} cx="12" cy="12" r="8.5" />
      <path {...S} strokeWidth={2} d="M12 7v5l3.5 2" />
    </>
  ),
  shirt: <path {...S} strokeWidth={1.9} d="M8.5 3.5L3.5 6l1.8 4.2 2.2-.9V20.5h9V9.3l2.2.9L20.5 6l-5-2.5a3.5 3.5 0 01-7 0z" />,
  chart: <path {...S} strokeWidth={2.2} d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  shield: <path {...S} strokeWidth={2} d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" />,
  bell: (
    <>
      <path {...S} strokeWidth={2} d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
      <path {...S} strokeWidth={2} d="M10 20.5a2 2 0 004 0" />
    </>
  ),
  search: (
    <>
      <circle {...S} strokeWidth={2.2} cx="11" cy="11" r="6.5" />
      <path {...S} strokeWidth={2.2} d="M16 16l4.5 4.5" />
    </>
  ),
  pip: (
    <>
      <rect {...S} strokeWidth={2} x="3" y="4.5" width="18" height="15" rx="3" />
      <rect x="11.5" y="11.5" width="7" height="5.5" rx="1.5" fill="currentColor" />
    </>
  ),
  tab: (
    <>
      <rect {...S} strokeWidth={2} x="3" y="4.5" width="18" height="15" rx="3" />
      <path {...S} strokeWidth={2} d="M9 15l6-6M10 9h5v5" />
    </>
  ),
  post: (
    <>
      <path {...S} strokeWidth={2.2} d="M5 20V5h14v15" />
      <circle cx="15.5" cy="9" r="3" fill="currentColor" />
    </>
  ),
  glove: <path {...S} strokeWidth={1.8} d="M7 21v-6.5L4.5 11a1.6 1.6 0 012.4-2L8 10.2V5.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V10V5.5a1.5 1.5 0 013 0V15l-2 6z" />,
  whistle: (
    <>
      <path {...S} strokeWidth={1.9} d="M3 10h11l6-3v5a6 6 0 11-12 0" />
      <circle cx="14" cy="14" r="1.6" fill="currentColor" />
    </>
  ),
  ball: (
    <>
      <circle {...S} strokeWidth={1.8} cx="12" cy="12" r="9" />
      <path d="M12 7.5l3.6 2.6-1.4 4.2H9.8L8.4 10.1z" fill="currentColor" />
      <path {...S} strokeWidth={1.5} d="M12 3v4.5M15.6 10.1l4.6-1.6M14.2 14.3l2.7 3.9M9.8 14.3l-2.7 3.9M8.4 10.1L3.8 8.5" />
    </>
  ),
  swap: <path {...S} strokeWidth={2} d="M7 4v13M3.5 13.5L7 17l3.5-3.5M17 20V7M13.5 10.5L17 7l3.5 3.5" />,
  flag: <path {...S} strokeWidth={2} d="M6 21V4M6 4.5c4-2 6 2 11 0v8c-5 2-7-2-11 0" />,
  expand: <path {...S} strokeWidth={2} d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />,
  collapse: <path {...S} strokeWidth={2} d="M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5" />,
  close: <path {...S} strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />,
  lock: (
    <>
      <rect {...S} strokeWidth={2} x="5" y="11" width="14" height="10" rx="2.5" />
      <path {...S} strokeWidth={2} d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  cake: (
    <>
      <path {...S} strokeWidth={1.9} d="M4 20.5h16V13a2 2 0 00-2-2H6a2 2 0 00-2 2zM4 16c2 1.2 4 1.2 5.3 0 1.4 1.2 4 1.2 5.4 0 1.3 1.2 3.3 1.2 5.3 0M12 11V7.5" />
      <path d="M12 3.2c1.2 1.3 1.2 2.6 0 3.3-1.2-.7-1.2-2 0-3.3z" fill="currentColor" />
    </>
  ),
  cal: (
    <>
      <rect {...S} strokeWidth={2} x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path {...S} strokeWidth={2} d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  check: <path {...S} strokeWidth={2.4} d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow: <path {...S} strokeWidth={2} d="M5 12h14M13 6l6 6-6 6" />,
  star: <path {...S} strokeWidth={1.9} d="M12 3.5l2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.4-4.1 6-.8z" />,
  wash: (
    <>
      <rect {...S} strokeWidth={1.9} x="4" y="3" width="16" height="18" rx="3" />
      <circle {...S} strokeWidth={1.9} cx="12" cy="13" r="4.5" />
      <path {...S} strokeWidth={1.9} d="M7.5 6.5h2" />
    </>
  ),
  poll: <path {...S} strokeWidth={2.4} d="M5 20V9M12 20V4M19 20v-7" />,
  euro: <path {...S} strokeWidth={1.9} d="M17.5 6.3A7 7 0 007 12a7 7 0 0010.5 5.7M4.5 10.2h9M4.5 13.8h9" />,
  bolt: <path {...S} strokeWidth={1.9} d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  away: <path {...S} strokeWidth={1.9} d="M5 20.5V4M5 4.5h11l-2.5 3.5 2.5 3.5H5" />,
  mesa: (
    <>
      <rect {...S} strokeWidth={1.9} x="5" y="4" width="14" height="17" rx="2.5" />
      <path {...S} strokeWidth={1.9} d="M9 4V2.8h6V4M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  share: <path {...S} strokeWidth={2} d="M12 15V3.5M8 7.5l4-4 4 4M5 12v6.5A2 2 0 007 20.5h10a2 2 0 002-2V12" />,
  trophy: <path {...S} strokeWidth={1.9} d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5v1.5A3 3 0 008 10.5M16 6h3.5v1.5a3 3 0 01-3.5 3M12 13v4M8.5 20.5h7M10 17h4" />,
  sun: (
    <>
      <circle {...S} strokeWidth={2} cx="12" cy="12" r="4" />
      <path {...S} strokeWidth={2} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path {...S} strokeWidth={2} d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  logout: <path {...S} strokeWidth={2} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  wifiOff: (
    <>
      <path {...S} strokeWidth={1.9} d="M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.6a10 10 0 015.3-2.6M14.5 10.2A10 10 0 0119 12.6M2 9a14.5 14.5 0 016-3.2M13 5.6A14.5 14.5 0 0122 9" />
      <circle cx="12" cy="20" r="1.3" fill="currentColor" />
    </>
  ),
  // (the Sala de control's: back, more, add, the menu and the strip's undo — r12's sprite)
  chevL: <path {...S} strokeWidth={2.2} d="M15 5l-7 7 7 7" />,
  chevR: <path {...S} strokeWidth={2.2} d="M9 5l7 7-7 7" />,
  chevD: <path {...S} strokeWidth={2.2} d="M5 9l7 7 7-7" />,
  plus: <path {...S} strokeWidth={2.2} d="M12 5v14M5 12h14" />,
  dots: (
    <>
      <circle fill="currentColor" cx="5" cy="12" r="1.8" />
      <circle fill="currentColor" cx="12" cy="12" r="1.8" />
      <circle fill="currentColor" cx="19" cy="12" r="1.8" />
    </>
  ),
  undo: <path {...S} strokeWidth={2} d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-2" />,
} satisfies Record<string, ReactNode>;

export type VIconName = keyof typeof GLYPHS;

export function VIcon({ name, size = 20, className }: { name: VIconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}
