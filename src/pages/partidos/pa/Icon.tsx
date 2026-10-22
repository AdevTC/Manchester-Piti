// The PA- boards' glyphs: the kit's VIcon set at the page's size (.pa-i), plus the two chevrons the boards add.
import { useContext, type CSSProperties } from "react";
import { VIcon, type VIconName } from "../../../components/vidrio";
import { KitStillContext } from "../../../components/jersey3d/kitStill";

export type IconName = VIconName | "chev-l" | "chev-r";

export function Ic({ name, className }: { name: IconName; className?: string }) {
  const cls = `pa-i${className ? ` ${className}` : ""}`;
  if (name === "chev-l" || name === "chev-r")
    return (
      <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d={name === "chev-l" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    );
  return <VIcon name={name} className={cls} />;
}

/** A shirt as the boards draw it: the printed still (the player's own name and number, or the kit's blank one) in an
 *  <img>; until the still is ready, the kit's drawn shirt in the same box. */
export function ShirtImg({ kit, num, alt, className, size }: { kit: "home" | "away"; num?: string; alt: string; className?: string; size: number }) {
  const still = useContext(KitStillContext)(kit, num);
  if (still) return <img className={className} src={still.src} alt={alt} width={540} height={600} />;
  return (
    <span className={`${className ?? ""} pa-shirtph`} role="img" aria-label={alt}>
      <span className={`vd-shirt${kit === "away" ? " vd-shirt--away" : ""}`} style={{ "--s": `${size}px` } as CSSProperties} aria-hidden="true">
        {num ? <b>{num}</b> : null}
      </span>
    </span>
  );
}
