// The PL- boards' small pieces: the glyphs (the kit's VIcon set plus the chevrons, play and the hanger's hook) and
// the shirt (the printed still of the 3D scene in an <img>; an empty box of the same size until it is ready, never a
// CSS-printed number).
import { useContext, type CSSProperties } from "react";
import { VIcon, type VIconName } from "../../../components/vidrio";
import { KitStillContext } from "../../../components/jersey3d/kitStill";

export type IconName = VIconName | "chev-l" | "chev-r" | "play";
const ST = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function Ic({ name, className = "pl-i" }: { name: IconName; className?: string }) {
  if (name === "chev-l" || name === "chev-r")
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path {...ST} strokeWidth={2.2} d={name === "chev-l" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    );
  if (name === "play")
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M8 5.5v13l11-6.5z" />
      </svg>
    );
  return <VIcon name={name} className={className} />;
}

/** The hook: it wraps the rail, a short neck goes down into the collar (the arms are inside the shirt). */
export function Hook() {
  return (
    <svg className="pl-hook" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path {...ST} strokeWidth={2.8} d="M20 44V26C20 19.5 27.5 18.5 27.5 11.5a7.5 7.5 0 00-15 0" />
    </svg>
  );
}

/** `<span class="pl-shirt …"><img class="pl-shirt__img"></span>`: the board's shirt. */
export function Shirt({ kit, num, className, vtn }: { kit: "home" | "away"; num?: string; className: string; vtn?: string }) {
  // (his own still, with name and dorsal printed by the scene; the kit's blank one only for a shirt without dorsal)
  const still = useContext(KitStillContext)(kit, num || undefined);
  const src = still && (still.printed || !num) ? still.src : undefined;
  return (
    <span className={`pl-shirt ${className}`} aria-hidden="true">
      {src && <img className="pl-shirt__img" src={src} alt="" width={540} height={600} style={vtn ? ({ viewTransitionName: vtn } as CSSProperties) : undefined} />}
    </span>
  );
}
