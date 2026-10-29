// «El partido»: the small drawn pieces every screen uses — the line icons (VIcon's glyphs and the few the
// broadcast adds: chevrons, play and pause, the card, the pin, a cloud, the link), the printed shirt still
// (the page's KitStillContext: a player's own still with his name and number, else the kit's blank one, else
// a drawn shape until they are ready) and a link that leaves for another page through the router.
import { useContext, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { VIcon, type VIconName } from "../../../components/vidrio";
import { KitStillContext, type Kit } from "../../../components/jersey3d/kitStill";
import { RivalMark } from "../../../components/vidrio/RivalMark";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;
const EXTRA = {
  "chev-l": <path {...S} strokeWidth={2.2} d="M15 5l-7 7 7 7" />,
  "chev-r": <path {...S} strokeWidth={2.2} d="M9 5l7 7-7 7" />,
  play: <path fill="currentColor" d="M8 5.5v13l11-6.5z" />,
  pause: (
    <>
      <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
      <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  card: <rect fill="currentColor" x="7" y="4" width="10" height="16" rx="2" />,
  pin: (
    <>
      <path {...S} strokeWidth={2} d="M12 21s-6-5.6-6-11a6 6 0 0112 0c0 5.4-6 11-6 11z" />
      <circle fill="currentColor" cx="12" cy="10" r="2.2" />
    </>
  ),
  cloud: <path {...S} strokeWidth={2} d="M7 18h10a4 4 0 00.6-7.96A5.5 5.5 0 006.5 9.6 4.2 4.2 0 007 18z" />,
  link: <path {...S} strokeWidth={2} d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />,
  filter: <path {...S} strokeWidth={2} d="M4 6h16M7 12h10M10 18h4" />,
};
export type IconName = VIconName | keyof typeof EXTRA;

/** A line icon, sized by its class (.pp-i: 20 px unless a rule says otherwise). */
export function Icon({ name, className = "pp-i" }: { name: IconName; className?: string }) {
  if (name in EXTRA)
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {EXTRA[name as keyof typeof EXTRA]}
      </svg>
    );
  return <VIcon name={name as VIconName} className={className} />;
}

/** The printed shirt still (540 × 600, the shirt cropped by .pp-tee): `num` prints his own, none the kit's blank. */
export function Tee({ kit, num, className = "", gold }: { kit: Kit; num?: string | number | null; className?: string; gold?: boolean }) {
  const still = useContext(KitStillContext)(kit, num != null && num !== "" ? String(num) : undefined);
  return (
    <span className={`pp-tee${gold ? " pp-tee--gold" : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {still ? (
        <img src={still.src} alt="" />
      ) : (
        <svg className="pp-tee__drawn" viewBox="0 0 413 548" aria-hidden="true" focusable="false">
          <path d="M120 20 L60 50 L8 150 L70 190 L92 160 L92 530 L321 530 L321 160 L343 190 L405 150 L353 50 L293 20 Q206 70 120 20Z" fill={kit === "away" ? "#1b1d26" : "#9fd0f2"} stroke="rgba(255,255,255,.35)" strokeWidth="6" />
        </svg>
      )}
    </span>
  );
}

/** The rival's crest: its escudo, else its initials, in a ring. */
export function RivalCrest({ logo, code, className }: { logo?: string | null; code: string; className: string }) {
  return (
    <span className={`${className} vd-team__crest--rival`} aria-hidden="true">
      <RivalMark logo={logo}>{code}</RivalMark>
    </span>
  );
}

/** A link to another page of the app (its own address; the router follows it without a reload). */
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
