// PLANTILLA · the small pieces every screen of the area uses: the printed shirt (the still the app renders, or its
// place while it renders), the own navigation «Jugadores · Socios · Capitanes» (the board's vd-seg with the bead and
// «Socios N»), and three glyphs of the board's sprite the shared VIcon does not draw (download, trash, door).
import type { CSSProperties } from "react";
import { VIcon, type VIconName } from "../../../../components/vidrio/VIcon";
import { SalaLink } from "../../shell/SalaLink";
import { useAdmin } from "../../shell/context";
import { plural } from "../../../../lib/derived/words";
import "../../../../styles/vidrio/components.css";

/** A printed shirt still (law 8): `size` s · l · xl; without the still yet, its place (same size, never a CSS print). */
export function Shirt({ src, size, alt = "", vt, className = "" }: { src: string | undefined; size: "s" | "l" | "xl"; alt?: string; vt?: string; className?: string }) {
  const style: CSSProperties | undefined = vt ? { viewTransitionName: vt } : undefined;
  const cls = `${vt ? "sc-morph " : ""}${className}`.trim();
  if (!src) return <span className={`spl-shirt0 sc-shirt--${size} ${cls}`.trim()} style={style} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />;
  return <img className={`sc-shirt sc-shirt--${size} ${cls}`.trim()} style={style} src={src} alt={alt} decoding="async" />;
}

const EXTRA = {
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13M10.5 10.5v6M13.5 10.5v6",
  door: "M6 20.5V4h10v16.5M4 20.5h16M13 12.5v.01M16 4l3 1.5v15",
} as const;
export type PlIconName = VIconName | keyof typeof EXTRA;
/** VIcon, plus the board's download · trash · door. */
export function Icon({ name, size = 18, flip }: { name: PlIconName; size?: number; flip?: boolean }) {
  if (name in EXTRA) {
    const d = EXTRA[name as keyof typeof EXTRA];
    return (
      <svg className={flip ? "sc-i spl-flip" : "sc-i"} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <VIcon name={name as VIconName} size={size} className={flip ? "sc-i spl-flip" : "sc-i"} />;
}

export type PlArea = "jugadores" | "socios" | "capitanes";
/** «Jugadores · Socios · Capitanes»: the area's own navigation (Socios counts who knocks and who asks for a ficha). */
export function PlNav({ at }: { at: PlArea }) {
  const data = useAdmin();
  const door = data.doorRequests + data.claims.length;
  const items: { key: PlArea; t: string; to: string; n: number }[] = [
    { key: "jugadores", t: "Jugadores", to: "/admin/plantilla", n: 0 },
    { key: "socios", t: "Socios", to: "/admin/plantilla/socios", n: door },
    { key: "capitanes", t: "Capitanes", to: "/admin/plantilla/capitanes", n: 0 },
  ];
  const i = items.findIndex((x) => x.key === at);
  return (
    <nav className="spl-nav" aria-label="Plantilla">
      <div className="vd-seg vd-glass spl-seg" style={{ "--n": 3, "--i": i } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        {items.map((x) => (
          <SalaLink key={x.key} to={x.to} className="vd-seg__b" aria-current={x.key === at ? "page" : undefined} aria-label={x.n ? `${x.t} · ${plural(x.n, "cosa por hacer", "cosas por hacer")}` : undefined}>
            {x.t}
            {x.n > 0 && (
              <i className="sc-count" aria-hidden="true">
                {x.n}
              </i>
            )}
          </SalaLink>
        ))}
      </div>
    </nav>
  );
}
