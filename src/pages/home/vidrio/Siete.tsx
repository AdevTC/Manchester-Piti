// El siete on a glass pitch: each player in his spot with his real shirt (the night's kit: the page's blank still
// from KitStillContext with his number set on it, as the boards' .v-shirt), his name under it and the marks of the
// night beside it (goals, passes, cards, the change he came in with). The spots exist for two pitches: our goal
// on the left (phone, tablet, the 1920 centre) and at the bottom (the 1440 triptych's narrow ornament); CSS picks one.
import { useContext, useEffect, useRef, type CSSProperties } from "react";
import { KitStillContext, type Kit } from "../../../components/jersey3d/kitStill";
import type { SieteSpot, SieteTag } from "../hoyModel";
import { Ico, type IconId } from "./icons";
import { placePitch, type PitchPlayer } from "./pitchLayout";

/** Measures the pitch as laid out (offsets: no transforms, so the 1440 ornament's tilt doesn't skew it) and
 *  places every plate and tags column clear of the others (pitchLayout); again whenever the pitch resizes
 *  (another breakpoint swaps the pitch's orientation) or the fonts arrive. */
function usePitchLayout(key: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const pitch = ref.current;
    if (!pitch) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const W = pitch.clientWidth;
      const H = pitch.clientHeight;
      const items = [...pitch.querySelectorAll<HTMLElement>(".vi-player")];
      // (measured as first laid out — one line, tags in one column on the right — so the pass gives the same
      // answer every time it runs)
      for (const li of items) {
        li.classList.remove("vi-player--tags2", "vi-player--tagsicon", "vi-player--two");
        delete li.dataset.tags;
      }
      const boxes = items.map((li) => {
        const x0 = li.offsetLeft - li.offsetWidth / 2;
        const y0 = li.offsetTop - li.offsetHeight / 2;
        return { x0, y0 };
      });
      const players: PitchPlayer[] = items.map((li, i) => {
        const { x0, y0 } = boxes[i];
        const shirt = li.querySelector<HTMLElement>(".vi-shirt");
        const plate = li.querySelector<HTMLElement>(".vi-player__name");
        const tags = li.querySelector<HTMLElement>(".vi-player__tags");
        // (a name with a space can go on two lines: measured with the class on, then off again)
        let plate2: { w: number; h: number } | null = null;
        if (plate && /\s/.test(plate.firstChild?.textContent?.trim() ?? "")) {
          li.classList.add("vi-player--two");
          // (its box keeps one line's height, so the shirt doesn't move: the second line hangs below)
          plate2 = { w: plate.offsetWidth, h: plate.scrollHeight };
          li.classList.remove("vi-player--two");
        }
        return {
          shirt: { x: x0 + (shirt?.offsetLeft ?? 0), y: y0 + (shirt?.offsetTop ?? 0), w: shirt?.offsetWidth ?? 0, h: shirt?.offsetHeight ?? 0 },
          plate: { x: x0 + (plate?.offsetLeft ?? 0), y: y0 + (plate?.offsetTop ?? 0), w: plate?.offsetWidth ?? 0, h: plate?.offsetHeight ?? 0 },
          plate2,
          tags: tags ? { w: tags.offsetWidth, h: tags.offsetHeight, n: tags.childElementCount } : null,
          first: li.classList.contains("vi-player--me"),
        };
      });
      placePitch(players, W, H).forEach((p, i) => {
        const li = items[i];
        const { x0, y0 } = boxes[i];
        li.classList.toggle("vi-player--two", p.plate === "two");
        li.classList.toggle("vi-player--tags2", p.cols === 2);
        li.classList.toggle("vi-player--tagsicon", p.chips === "icon");
        li.style.setProperty("--nx", `${p.nx}px`);
        li.style.setProperty("--ny", `${p.ny}px`);
        li.style.setProperty("--pdx", `${p.plateDx}px`);
        li.style.setProperty("--pdy", `${p.plateDy}px`);
        if (p.tagsAt) {
          li.dataset.tags = p.tags;
          li.style.setProperty("--tx", `${Math.round(p.tagsAt.x - (x0 + p.nx))}px`);
          li.style.setProperty("--ty", `${Math.round(p.tagsAt.y - (y0 + p.ny))}px`);
        }
      });
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(queue) : null;
    ro?.observe(pitch);
    void document.fonts?.ready.then(queue);
    return () => {
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);
  return ref;
}

const TAG_ICON: Partial<Record<SieteTag["kind"], IconId>> = { gol: "ball", asis: "pass", cambio: "swap", parada: "glove" };

/** A shirt with its number: the page's real kit still (KitStillContext) under a set number, as the boards' .v-shirt;
 *  the drawn shape stands in before the still is ready and on the server. */
export function Shirt({ num, size, captain, kit = "home" }: { num: string; size?: number; captain?: boolean; kit?: Kit }) {
  const still = useContext(KitStillContext)(kit);
  const style = { ...(size ? { "--s": `${size}px` } : {}), ...(still ? { "--vi-kit": `url("${still}")` } : {}) } as CSSProperties;
  return (
    <span className={`vi-shirt${still ? " vi-shirt--kit" : ""}`} style={style} aria-hidden="true">
      <b>{num}</b>
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
  className?: string;
}

export function SieteOrn({ title, system, spots, bench, kit, className }: SieteOrnProps) {
  const still = useContext(KitStillContext)(kit);
  // (laid out again when the kit's still arrives: the still stands taller than the drawn shirt)
  const pitch = usePitchLayout(spots.map((s) => `${s.id}:${s.name}:${s.tags.map((t) => t.kind + t.text).join(",")}`).join("|") + (still ? "|kit" : ""));
  return (
    <section className={`vd-glass vd-glass--clear vd-orn vi-orn vi-siete${className ? ` ${className}` : ""}`} aria-label={title}>
      <div className="vd-orn__head">
        <h2>{title}</h2>
        <span>{system}</span>
      </div>
      <div ref={pitch} className="vi-pitch">
        {LINES_H}
        {LINES_V}
        <ul className="vi-players" aria-label="Los siete">
          {spots.map((s) => (
            <li
              key={s.id}
              className={`vi-player${s.h.tagsLeft ? " vi-player--htl" : ""}${s.v.tagsLeft ? " vi-player--vtl" : ""}${s.me ? " vi-player--me" : ""}`}
              style={{ "--hx": `${s.h.left}%`, "--hy": `${s.h.top}%`, "--vx": `${s.v.left}%`, "--vy": `${s.v.top}%` } as CSSProperties}
            >
              <Shirt num={s.num} kit={kit} captain={s.captain} />
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
