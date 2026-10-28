// HOY Y PARTIDOS · the printed shirt of the boards (`img.sc-shirt`): the photo of the real kit with the player's
// season name and dorsal (jersey3d stills, rendered once and kept on the device), the kit of the match. While the
// photo is not there yet (first visit, no WebGL), a plain shirt with the dorsal in its place, the same size.
import type { CSSProperties } from "react";
import "./hp.css";

export type Kit = "home" | "away";
export interface ShirtWho {
  name: string;
  number: number | string | null;
}
export type ShirtSize = "xs" | "s" | "m" | "l";
const PX: Record<ShirtSize, number> = { xs: 34, s: 46, m: 64, l: 110 };

/** One shirt (decorative: the button or row around it carries the name). `src`: from useShirts; `blank`: no player
 *  (a free place, a guest). */
export function Shirt({ src, who, size = "s", kit = "home", blank, className = "" }: { src?: string; who?: ShirtWho | null; size?: ShirtSize; kit?: Kit; blank?: boolean; className?: string }) {
  if (src && !blank) return <img className={`sc-shirt sc-shirt--${size} ${className}`.trim()} src={src} alt="" decoding="async" draggable={false} />;
  const style = { "--sw": `${PX[size]}px` } as CSSProperties;
  return (
    <span className={`sc-shirt hp-shirt hp-shirt--${kit}${blank ? " is-blank" : ""} ${className}`.trim()} style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d="M30 8 C37 15 63 15 70 8 L94 20 L87 42 L77 38 L77 96 L23 96 L23 38 L13 42 L6 20 Z" />
      </svg>
      {!blank && who?.number != null && who.number !== "" && <b>{who.number}</b>}
    </span>
  );
}
