// El siete on a glass pitch: each player in his spot with his real shirt (a still of the kit with his number,
// rendered once on the device: useShirtStills), his name under it and the marks of the night beside it (goals,
// passes, cards, the change he came in with). The spots exist for two pitches: our goal on the left (phone,
// tablet, the 1920 centre) and at the bottom (the 1440 triptych's narrow ornament); CSS picks one.
import type { CSSProperties } from "react";
import { useShirtStills } from "../../../components/jersey3d/useShirtStills";
import type { SieteSpot, SieteTag } from "../hoyModel";
import { Ico, type IconId } from "./icons";

const TAG_ICON: Partial<Record<SieteTag["kind"], IconId>> = { gol: "ball", asis: "pass", cambio: "swap", parada: "glove" };

export function Shirt({ num, still, size, captain }: { num: string; still?: string; size?: number; captain?: boolean }) {
  return (
    <span className={`vi-shirt${still ? " vi-shirt--still" : ""}`} style={size ? ({ "--s": `${size}px` } as CSSProperties) : undefined} aria-hidden="true">
      {still ? <img src={still} alt="" /> : <b>{num}</b>}
      {captain && <i className="vi-arm" />}
    </span>
  );
}

function Tag({ t }: { t: SieteTag }) {
  const icon = TAG_ICON[t.kind];
  return (
    <span className={`vi-tag vi-tag--${t.kind}${t.gold ? " vi-tag--gold" : ""}`} aria-label={t.label} role="img">
      {icon && <Ico id={icon} />}
      {t.text}
    </span>
  );
}

const LINES_H = (
  <svg className="vi-pitch__lines vi-pitch__lines--h" viewBox="0 0 140 100" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="4" width="134" height="92" rx="1" />
    <line x1="70" y1="4" x2="70" y2="96" />
    <circle cx="70" cy="50" r="11" />
    <rect x="3" y="26" width="17" height="48" />
    <rect x="120" y="26" width="17" height="48" />
  </svg>
);
const LINES_V = (
  <svg className="vi-pitch__lines vi-pitch__lines--v" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
    <rect x="4" y="3" width="92" height="134" rx="1" />
    <line x1="4" y1="70" x2="96" y2="70" />
    <circle cx="50" cy="70" r="11" />
    <rect x="26" y="3" width="48" height="17" />
    <rect x="26" y="120" width="48" height="17" />
  </svg>
);

export interface SieteOrnProps {
  title: string;
  system: string;
  spots: readonly SieteSpot[];
  bench: string;
  kit: "home" | "away";
  theme: "dark" | "light";
  className?: string;
}

export function SieteOrn({ title, system, spots, bench, kit, theme, className }: SieteOrnProps) {
  const reqs = spots.map((s) => ({ kit, theme, name: "", num: s.num || " ", yaw: 0 }));
  const still = useShirtStills(reqs, { offMainThread: true });
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-siete${className ? ` ${className}` : ""}`} aria-label={title}>
      <div className="vd-orn__head">
        <h2>{title}</h2>
        <span>{system}</span>
      </div>
      <div className="vi-pitch">
        {LINES_H}
        {LINES_V}
        <ul className="vi-players" aria-label="Los siete">
          {spots.map((s, i) => (
            <li
              key={s.id}
              className={`vi-player${s.h.tagsLeft ? " vi-player--htl" : ""}${s.v.tagsLeft ? " vi-player--vtl" : ""}${s.me ? " vi-player--me" : ""}`}
              style={{ "--hx": `${s.h.left}%`, "--hy": `${s.h.top}%`, "--vx": `${s.v.left}%`, "--vy": `${s.v.top}%` } as CSSProperties}
            >
              <Shirt num={s.num} still={still(reqs[i])} captain={s.captain} />
              <span className="vi-player__name">
                {s.name}
                {s.captain && <span className="vd-vh">, capitán</span>}
                {s.me && <span className="vd-vh">, tú</span>}
              </span>
              {s.tags.length > 0 && (
                <span className="vi-player__tags">
                  {s.tags.map((t, k) => (
                    <Tag key={k} t={t} />
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="vi-bench">{bench}</p>
    </section>
  );
}
