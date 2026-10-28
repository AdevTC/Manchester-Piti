// CAJA · small pieces of the caja's screens: the glyphs the sprite has no word for yet (minus, warn) and the printed
// shirt of a row (the page's real kit stills, KitStillContext; the drawn shirt until they are ready).
import { useContext } from "react";
import { KitStillContext, type Kit } from "../../../../components/jersey3d/kitStill";

const S = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const GLYPHS = {
  minus: <path {...S} strokeWidth={2.2} d="M5.5 12h13" />,
  warn: (
    <>
      <path {...S} strokeWidth={1.9} d="M12 4.2 2.9 19.5h18.2L12 4.2z" />
      <path {...S} strokeWidth={2.2} d="M12 10v4.4M12 17.2v.1" />
    </>
  ),
};
export function CajaGlyph({ name, size = 20 }: { name: keyof typeof GLYPHS; size?: number }) {
  return (
    <svg className="sc-i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {GLYPHS[name]}
    </svg>
  );
}

/** A row's printed shirt (`num` his own still, with his name; none: the kit's blank). Decorative: the name is
 *  written beside it. */
export function RowShirt({ kit = "home", num }: { kit?: Kit; num?: string }) {
  const still = useContext(KitStillContext)(kit, num || undefined);
  if (still) return <img className="sc-shirt sc-shirt--xs" src={still.src} alt="" draggable={false} />;
  return (
    <svg className="sc-shirt sc-shirt--xs" viewBox="0 0 413 548" aria-hidden="true" focusable="false">
      <path d="M120 20 L60 50 L8 150 L70 190 L92 160 L92 530 L321 530 L321 160 L343 190 L405 150 L353 50 L293 20 Q206 70 120 20Z" fill={kit === "away" ? "#1b1d26" : "#9fd0f2"} stroke="rgba(255,255,255,.35)" strokeWidth="6" />
      {num && (
        <text x="206" y="360" textAnchor="middle" fontSize="190" fontWeight="800" fill={kit === "away" ? "#9fd0f2" : "#0c1733"}>
          {num}
        </text>
      )}
    </svg>
  );
}
