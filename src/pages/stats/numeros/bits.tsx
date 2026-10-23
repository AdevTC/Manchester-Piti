// «Números»: the boards' glyphs (the kit's VIcon set at .nu-i, plus the chevrons, play, pause and the «?» the boards
// add) and the printed shirt of a player (the still the app renders: his name and dorsal on the home kit).
import { useContext, type ReactNode } from "react";
import { VIcon, type VIconName } from "../../../components/vidrio";
import { KitStillContext } from "../../../components/jersey3d/kitStill";

export type NuIcon = VIconName | "chev-l" | "chev-r" | "play" | "pause" | "help";

const ST = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function I({ name, className }: { name: NuIcon; className?: string }) {
  const cls = `nu-i${className ? ` ${className}` : ""}`;
  const svg = (children: ReactNode) => (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
  if (name === "chev-l") return svg(<path {...ST} strokeWidth={2.2} d="M15 5l-7 7 7 7" />);
  if (name === "chev-r") return svg(<path {...ST} strokeWidth={2.2} d="M9 5l7 7-7 7" />);
  if (name === "play") return svg(<path fill="currentColor" d="M8 5.5v13l11-6.5z" />);
  if (name === "pause")
    return svg(
      <>
        <rect fill="currentColor" x="6.5" y="5" width="4" height="14" rx="1.2" />
        <rect fill="currentColor" x="13.5" y="5" width="4" height="14" rx="1.2" />
      </>,
    );
  if (name === "help")
    return svg(
      <>
        <circle {...ST} strokeWidth={1.9} cx="12" cy="12" r="9" />
        <path {...ST} strokeWidth={2} d="M9.6 9.4a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.7" />
        <circle fill="currentColor" cx="12" cy="17" r="1.15" />
      </>,
    );
  return <VIcon name={name} className={cls} />;
}

/** The «?» of a block: what it counts, in plain words. */
export function Q({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`nu-q${className ? ` ${className}` : ""}`} onClick={onClick} aria-label={label}>
      <I name="help" />
    </button>
  );
}

/** A player's printed shirt (home kit, his dorsal): the still once it is ready; until then nothing in its box. */
export function Shirt({ num, alt, className }: { num: number | ""; alt: string; className: string }) {
  const still = useContext(KitStillContext)("home", num === "" ? undefined : String(num));
  if (still) return <img className={className} src={still.src} alt={alt} width={540} height={600} />;
  return <span className={`${className} nu-shirt-wait`} role="img" aria-label={alt} />;
}
