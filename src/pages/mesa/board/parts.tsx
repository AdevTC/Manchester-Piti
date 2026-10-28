// La mesa (r12) · the small drawn pieces: the boards' line icons (their sprite vi-*, drawn inline), the printed shirt
// still (the page's KitStillContext: a player's own still with his name and number, else the kit's blank still, else
// a drawn blank shirt until they are ready — never a dorsal or a name set in CSS) and a key hint.
import { useContext, type CSSProperties, type ReactNode } from "react";
import { KitStillContext, type Kit } from "../../../components/jersey3d/kitStill";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const GLYPHS = {
  "chev-l": <path {...S} strokeWidth={2.2} d="M15 5l-7 7 7 7" />,
  plus: <path {...S} strokeWidth={2.2} d="M12 5v14M5 12h14" />,
  minus: <path {...S} strokeWidth={2.2} d="M5 12h14" />,
  undo: (
    <>
      <path {...S} strokeWidth={2} d="M9 7L4 12l5 5" />
      <path {...S} strokeWidth={2} d="M4 12h10a6 6 0 010 12h-2" />
    </>
  ),
  card: <rect {...S} strokeWidth={2} x="7" y="4" width="10" height="16" rx="2" />,
  list: (
    <>
      <path {...S} strokeWidth={2} d="M9 6h11M9 12h11M9 18h11" />
      <circle fill="currentColor" cx="4.5" cy="6" r="1.3" />
      <circle fill="currentColor" cx="4.5" cy="12" r="1.3" />
      <circle fill="currentColor" cx="4.5" cy="18" r="1.3" />
    </>
  ),
  edit: (
    <>
      <path {...S} strokeWidth={2} d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path {...S} strokeWidth={2} d="M13 7l4 4" />
    </>
  ),
  trash: <path {...S} strokeWidth={2} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  pause: (
    <>
      <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  warn: (
    <>
      <path {...S} strokeWidth={2} d="M12 3l10 18H2z" />
      <path {...S} strokeWidth={2} d="M12 10v5" />
      <circle fill="currentColor" cx="12" cy="18" r="1.2" />
    </>
  ),
  clock: (
    <>
      <circle {...S} strokeWidth={2} cx="12" cy="12" r="9" />
      <path {...S} strokeWidth={2} d="M12 7v5l3 2" />
    </>
  ),
  dots: (
    <>
      <circle fill="currentColor" cx="5" cy="12" r="1.8" />
      <circle fill="currentColor" cx="12" cy="12" r="1.8" />
      <circle fill="currentColor" cx="19" cy="12" r="1.8" />
    </>
  ),
  close: <path {...S} strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />,
  swap: <path {...S} strokeWidth={2} d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4" />,
  whistle: (
    <>
      <path {...S} strokeWidth={2} d="M3 11.5a5.5 5.5 0 1011 0V9h7V6H8.5A5.5 5.5 0 003 11.5z" />
      <circle fill="currentColor" cx="8.5" cy="11.5" r="1.6" />
    </>
  ),
  ball: (
    <>
      <circle {...S} strokeWidth={2} cx="12" cy="12" r="9" />
      <path {...S} strokeWidth={1.8} d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" />
    </>
  ),
  wifiOff: <path {...S} strokeWidth={2} d="M2 8.5a15 15 0 0120 0M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19h.01M3 3l18 18" />,
} satisfies Record<string, ReactNode>;
export type IconName = keyof typeof GLYPHS;

export function Icon({ name, className = "me-i" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}

/** A key hint on a button (shown from the desktop widths, in the flow of the button). */
export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="me-kbd" aria-hidden="true">
    {children}
  </kbd>
);

/** The printed still of a shirt: `num` his own (name and number printed by the 3D scene), none the kit's blank. */
export function Shirt({ kit, num, className = "", style }: { kit: Kit; num?: string; className?: string; style?: CSSProperties }) {
  const still = useContext(KitStillContext)(kit, num ? num : undefined);
  if (still) return <img className={`me-shirt ${className}`.trim()} style={style} src={still.src} alt="" draggable={false} />;
  return (
    <svg className={`me-shirt ${className}`.trim()} style={style} viewBox="0 0 413 548" aria-hidden="true" focusable="false">
      <path d="M120 20 L60 50 L8 150 L70 190 L92 160 L92 530 L321 530 L321 160 L343 190 L405 150 L353 50 L293 20 Q206 70 120 20Z" fill={kit === "away" ? "#1b1d26" : "#9fd0f2"} stroke="rgba(255,255,255,.35)" strokeWidth="6" />
    </svg>
  );
}
