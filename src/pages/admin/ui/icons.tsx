// The admin's stroke icons, drawn exactly as on the Design canvas (stats-gen/ad-v2-full.mjs and ad-elegida.mjs
// `K` + the shared ICON set they borrow: calendar, team, search, sun, moon, star, ball, bell).
import type { ReactNode } from "react";

const P: Record<string, { d: ReactNode; sw: number }> = {
  check: { d: <path d="m5 12 5 5 9-10" />, sw: 2.6 },
  alert: { d: (<><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17v.5" /></>), sw: 2.2 },
  info: { d: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>), sw: 2.2 },
  clock: { d: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>), sw: 2.2 },
  pencil: { d: (<><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>), sw: 1.8 },
  x: { d: <path d="M6 6l12 12M18 6 6 18" />, sw: 2.2 },
  plus: { d: <path d="M12 5v14M5 12h14" />, sw: 2.6 },
  minus: { d: <path d="M5 12h14" />, sw: 2.6 },
  back: { d: <path d="M15 5 8 12l7 7" />, sw: 2.4 },
  right: { d: <path d="m9 6 6 6-6 6" />, sw: 2.4 },
  ext: { d: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />, sw: 2 },
  door: { d: (<><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18" /><circle cx="15" cy="12" r="1" /></>), sw: 1.8 },
  inbox: { d: (<><path d="M3 13h5l1.5 3h5l1.5-3h5" /><path d="M5 5h14l2 8v6H3v-6Z" /></>), sw: 1.8 },
  flag: { d: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />, sw: 1.8 },
  shield: { d: (<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>), sw: 1.8 },
  doc: { d: (<><path d="M14 3H6v18h12V7Z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>), sw: 1.8 },
  lock: { d: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>), sw: 2.2 },
  swap: { d: <path d="M7 4v13M3 13l4 4 4-4M17 20V7M21 11l-4-4-4 4" />, sw: 2 },
  glove: { d: <path d="M7 21v-6l-2-3V7a1.5 1.5 0 0 1 3 0v4M8 11V4.5a1.5 1.5 0 0 1 3 0V11M11 10V3.5a1.5 1.5 0 0 1 3 0V11M14 10.5V5a1.5 1.5 0 0 1 3 0v8c0 3-1.5 5-3 6v2" />, sw: 1.8 },
  spark: { d: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />, sw: 1.8 },
  home: { d: (<><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>), sw: 1.8 },
  list: { d: (<><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M9 3v3h6V3M8 11h8M8 15h5" /></>), sw: 1.8 },
  dots: { d: (<><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>), sw: 2.2 },
  side: { d: (<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16M15 10l-2 2 2 2" /></>), sw: 1.8 },
  image: { d: (<><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>), sw: 1.8 },
  link: { d: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>), sw: 1.8 },
  bolt: { d: <path d="M13 3 5 14h6l-1 7 8-11h-6Z" />, sw: 1.8 },
  trash: { d: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, sw: 1.8 },
  arch: { d: (<><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10h14V9M10 13h4" /></>), sw: 1.8 },
  undo: { d: (<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>), sw: 2.2 },
  enter: { d: <path d="M20 4v7a4 4 0 0 1-4 4H5M9 11l-4 4 4 4" />, sw: 2 },
  updown: { d: <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />, sw: 2 },
  cal: { d: (<><rect x="3" y="4" width="18" height="18" rx="4" /><path d="M16 2v4M8 2v4M3 10h18" /></>), sw: 1.8 },
  team: { d: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6 6 0 0 1 3 6" /></>), sw: 1.8 },
  search: { d: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>), sw: 1.8 },
  sun: { d: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>), sw: 1.8 },
  moon: { d: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />, sw: 1.8 },
  star: { d: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />, sw: 1.8 },
  ball: { d: (<><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10Z" /></>), sw: 1.6 },
  bell: { d: (<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" /><path d="M10 21h4" /></>), sw: 1.8 },
  shirt: { d: <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" />, sw: 1.9 },
  card: { d: <rect x="7" y="3" width="10" height="16" rx="2" />, sw: 1.9 },
  whistle: { d: (<><circle cx="9" cy="14" r="5" /><path d="M12 10h9v4h-5M5 9 3 6" /></>), sw: 1.9 },
  share: { d: (<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>), sw: 1.9 },
  down: { d: <path d="m6 9 6 6 6-6" />, sw: 2.4 },
};
export type AdIconName =
  | "check" | "alert" | "info" | "clock" | "pencil" | "x" | "plus" | "minus" | "back" | "right" | "ext" | "door"
  | "inbox" | "flag" | "shield" | "doc" | "lock" | "swap" | "glove" | "spark" | "home" | "list" | "dots" | "side"
  | "image" | "link" | "bolt" | "trash" | "arch" | "undo" | "enter" | "updown" | "cal" | "team" | "search" | "sun"
  | "moon" | "star" | "ball" | "bell" | "shirt" | "card" | "whistle" | "share" | "down";

/** One of the admin's icons (decorative: aria-hidden). `size` defaults to the canvas' usual 18. */
export function AdIcon({ name, size = 18 }: { name: AdIconName; size?: number }) {
  const icon = P[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={icon.sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icon.d}
    </svg>
  );
}
