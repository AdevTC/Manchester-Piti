// r14 «La pizarra» · a printed shirt on the pitch: the app's kit still (his name and dorsal printed by the 3D scene,
// cropped to the shirt like the prototype: x 63–476, y 46–594 of 540×600) or, while the still renders, a drawn shirt
// with his dorsal (never CSS text over a real still). Also the shared glyph <PzIcon>.
import type { ShirtStill } from "../store/api";
import { PZ_ICONS } from "./icons";

export function PzIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`nx-ic${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={PZ_ICONS[name] ?? PZ_ICONS.dots} />
    </svg>
  );
}

/** The drawn stand-in (the still is not ready yet, or the server render): the kit's colour and the dorsal. */
function DrawnShirt({ num, away }: { num: string; away: boolean }) {
  return (
    <svg className={`pz-c__drawn${away ? " is-away" : ""}`} viewBox="0 0 200 265" aria-hidden="true">
      <path
        className="b"
        d="M70 18 C84 30 116 30 130 18 L178 38 C186 42 192 50 194 60 L198 102 L166 108 L160 84 L160 244 C160 250 156 254 150 254 L50 254 C44 254 40 250 40 244 L40 84 L34 108 L2 102 L6 60 C8 50 14 42 22 38 Z"
      />
      {num && (
        <text className="n" x="100" y="190" textAnchor="middle">
          {num}
        </text>
      )}
    </svg>
  );
}

export function CampoShirt({ still, className = "" }: { still: ShirtStill; className?: string }) {
  return (
    <span className={`pz-c__shirt${className ? ` ${className}` : ""}`}>
      {still.src ? <img src={still.src} alt="" draggable={false} decoding="async" /> : <DrawnShirt num={still.num} away={still.kit === "away"} />}
    </span>
  );
}
