// The pizarra's line icons, the cromo shirt and the crest, as drawn in the design.
import type { ReactNode } from "react";

const Svg = ({ w, sw = 1.8, children }: { w: number; sw?: number; children: ReactNode }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

type P = { w?: number };
const ICONS = {
  undo: ({ w = 18 }: P) => <Svg w={w} sw={2}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></Svg>,
  redo: ({ w = 18 }: P) => <Svg w={w} sw={2}><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></Svg>,
  whistle: ({ w = 20 }: P) => <Svg w={w}><path d="M3 11a5 5 0 1 0 10 0h8V7H8" /><circle cx="8" cy="11" r="1.4" /><path d="M14 7V4" /></Svg>,
  wand: ({ w = 18 }: P) => <Svg w={w}><path d="m4 20 10-10M13 5V3M19 11h2M17.5 6.5 19 5M14 10l2 2" /><path d="M9 4v2M5 8H3M18 15v2M15 18h-2" /></Svg>,
  pack: ({ w = 18 }: P) => (
    <Svg w={w} sw={1.6}>
      <rect x="5" y="3" width="11" height="15" rx="2" transform="rotate(-8 10 10)" />
      <rect x="9" y="6" width="11" height="15" rx="2" />
      <path d="m14.5 10 1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3Z" />
    </Svg>
  ),
  reset: ({ w = 16 }: P) => <Svg w={w}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></Svg>,
  x: ({ w = 18 }: P) => <Svg w={w} sw={2.4}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  check: ({ w = 16 }: P) => <Svg w={w} sw={2.6}><path d="m5 12 5 5 9-10" /></Svg>,
  alert: ({ w = 16 }: P) => <Svg w={w} sw={2.2}><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></Svg>,
  card: ({ w = 21 }: P) => <Svg w={w}><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M8.5 17h7M9 6.5h2" /><circle cx="12" cy="11" r="2.6" /></Svg>,
  spark: ({ w = 21 }: P) => (
    <Svg w={w}>
      <circle cx="5" cy="17" r="2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="19" cy="15" r="2" />
      <path d="m6.5 15.5 4-7.5M13.6 7.4l4.2 6M7 17.4l10 -1.8" strokeDasharray="2 2" />
    </Svg>
  ),
  film: ({ w = 21 }: P) => <Svg w={w}><circle cx="6" cy="18" r="2.2" /><path d="M8 16.5c4-1 3-6 7-7.5" /><circle cx="18" cy="6" r="2.2" /><path d="m13 7 2 2-2 2" /></Svg>,
  pen: ({ w = 21 }: P) => <Svg w={w}><path d="m4 20 3-1 12-12-2-2L5 17Z" /><path d="m15 7 2 2" /><path d="M14 21c2-2 4-2 6-1" strokeDasharray="1.5 2" /></Svg>,
  dots: ({ w = 21 }: P) => <Svg w={w} sw={2}><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></Svg>,
  boards: ({ w = 20 }: P) => (
    <Svg w={w}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <path d="M17 14v6M14 17h6" />
    </Svg>
  ),
  compare: ({ w = 20 }: P) => <Svg w={w}><path d="M12 3v18M4 7h5v10H4ZM15 7h5v10h-5Z" /></Svg>,
  sliders: ({ w = 20 }: P) => (
    <Svg w={w}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Svg>
  ),
  copy: ({ w = 16 }: P) => <Svg w={w}><rect x="8" y="8" width="13" height="13" rx="3" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></Svg>,
  trash: ({ w = 16 }: P) => <Svg w={w}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>,
  eye: ({ w = 16 }: P) => <Svg w={w}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>,
  thumb: ({ w = 16 }: P) => <Svg w={w}><path d="M7 11v9H4v-9ZM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.3 7A2 2 0 0 1 17.7 20H7" /></Svg>,
  download: ({ w = 16 }: P) => <Svg w={w} sw={2}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Svg>,
  link: ({ w = 16 }: P) => <Svg w={w}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>,
  lock: ({ w = 14 }: P) => <Svg w={w} sw={2.2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>,
  doubt: ({ w = 16 }: P) => <Svg w={w} sw={2}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5M12 17h.01" /></Svg>,
  chevL: ({ w = 18 }: P) => <Svg w={w} sw={2.4}><path d="m15 6-6 6 6 6" /></Svg>,
  chevR: ({ w = 18 }: P) => <Svg w={w} sw={2.4}><path d="m9 6 6 6-6 6" /></Svg>,
  bench: ({ w = 16 }: P) => <Svg w={w}><path d="M3 14h18M5 14v5M19 14v5M6 14V9h12v5" /></Svg>,
  rot: ({ w = 16 }: P) => <Svg w={w}><path d="M4 7h12l-3-3M20 17H8l3 3" /></Svg>,
  sndOn: ({ w = 18 }: P) => <Svg w={w}><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></Svg>,
  sndOff: ({ w = 18 }: P) => <Svg w={w}><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="m17 9 5 6M22 9l-5 6" /></Svg>,
  rewind: ({ w = 16 }: P) => <Svg w={w} sw={2}><path d="M11 6 4 12l7 6ZM20 6l-7 6 7 6Z" /></Svg>,
  swap: ({ w = 18 }: P) => <Svg w={w} sw={2}><path d="M7 4v13M3 13l4 4 4-4M17 20V7M21 11l-4-4-4 4" /></Svg>,
  info: ({ w = 18 }: P) => <Svg w={w}><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></Svg>,
  share: ({ w = 18 }: P) => (
    <Svg w={w}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </Svg>
  ),
  plan: ({ w = 18 }: P) => <Svg w={w}><path d="M4 4h16v11l-5 5H4Z" /><path d="M15 20v-5h5M8 9h8M8 13h4" /></Svg>,
  plus: ({ w = 17 }: P) => <Svg w={w} sw={2.2}><path d="M12 5v14M5 12h14" /></Svg>,
  search: ({ w = 19 }: P) => <Svg w={w}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>,
};

export type IconName = keyof typeof ICONS;

/** A line icon of the board, at its designed size unless `w` says otherwise. */
export function Icon({ n, w }: { n: IconName; w?: number }) {
  const Draw = ICONS[n];
  return <Draw w={w} />;
}

/** The cromo's shirt (the dorsal sits on top of it). */
export const Shirt = () => (
  <svg className="sh" viewBox="0 0 200 210" aria-hidden="true">
    <path d="M62 8 C75 22 125 22 138 8 L190 34 L176 84 L156 76 L156 202 L44 202 L44 76 L24 84 L10 34 Z" />
  </svg>
);

export const CREST = "/crest-128.webp";

/** The small gold «nuevo» pill. */
export const Nuevo = ({ children = "nuevo" }: { children?: ReactNode }) => <span className="nv">{children}</span>;
