// r14 «La pizarra» · Siete: a printed shirt in a list (bench rows, Candidatos, La ficha): the app's kit still
// cropped like the prototype's `.pz-shirt`, or, while the still renders, a drawn shirt with his dorsal.
import type { CSSProperties } from "react";
import type { ShirtStill } from "../../store/api";

export function RowShirt({ still, size, off = false, className = "" }: { still: ShirtStill; size?: number; off?: boolean; className?: string }) {
  const style = size ? ({ "--s": size + "px" } as CSSProperties) : undefined;
  return (
    <span className={`pz-shirt${off ? " is-off" : ""}${className ? " " + className : ""}`} style={style} aria-hidden="true">
      {still.src ? (
        <img src={still.src} alt="" draggable={false} decoding="async" />
      ) : (
        <svg className={`ps-drawn${still.kit === "away" ? " is-away" : ""}`} viewBox="0 0 200 265">
          <path d="M70 18 C84 30 116 30 130 18 L178 38 C186 42 192 50 194 60 L198 102 L166 108 L160 84 L160 244 C160 250 156 254 150 254 L50 254 C44 254 40 250 40 244 L40 84 L34 108 L2 102 L6 60 C8 50 14 42 22 38 Z" />
          {still.num && (
            <text x="100" y="190" textAnchor="middle">
              {still.num}
            </text>
          )}
        </svg>
      )}
    </span>
  );
}
