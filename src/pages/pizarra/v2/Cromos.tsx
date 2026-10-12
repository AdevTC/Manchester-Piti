// The cromos: on the pitch (club cromo with the form rating, zone, dorsal, name plate, galones stickers,
// the out-of-position «!», the «NO VA» tag, the pack reel) and on the bench (album cromos and FUT rows).
import type { PointerEvent } from "react";
import { Icon, Shirt, CREST } from "./icons";
import { vars, type CardView } from "./view";
import type { BenchRow } from "./bench";

// The cromo tilts toward the pointer and its foil follows (mouse and pen only).
function tiltMove(e: PointerEvent<HTMLSpanElement>) {
  if (e.pointerType === "touch" || e.buttons) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--rx", ((0.5 - y) * 22).toFixed(1) + "deg");
  el.style.setProperty("--ry", ((x - 0.5) * 26).toFixed(1) + "deg");
  el.style.setProperty("--mx", (x * 100).toFixed(0) + "%");
  el.style.setProperty("--my", (y * 100).toFixed(0) + "%");
  el.style.setProperty("--hy", Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2).toFixed(2));
}
function tiltLeave(e: PointerEvent<HTMLSpanElement>) {
  ["--rx", "--ry", "--mx", "--my", "--hy"].forEach((k) => e.currentTarget.style.removeProperty(k));
}

export interface PitchCromoProps {
  c: CardView;
  showGal: boolean;
  mini: boolean;
  hov: boolean;
  focusable: boolean;
  /** A jugada's paso: the cromo is a piece that can be moved in it («p:<id>»). */
  piece?: string;
  onTap: (id: string, el: HTMLElement) => void;
}

export function PitchCromo({ c, showGal, mini, hov, focusable, piece, onTap }: PitchCromoProps) {
  return (
    <div
      className={"cd " + c.cls + (hov ? " hov" : "")}
      style={vars({ "--x": c.x, "--y": c.y, "--fx": c.fx, "--fy": c.fy, "--mx": c.mx, "--my": c.my, "--sc": c.sc, "--i": c.i, "--z": c.z, "--rd": c.rd })}
      data-tok={c.id}
      data-zone="p"
      data-slot-i={c.i}
      data-piece={piece}
    >
      <span className="cd-sh" aria-hidden="true" />
      <span className="cd-ring" aria-hidden="true" />
      {c.me && <span className="cd-me" aria-hidden="true" />}
      <button type="button" className="cc" onClick={(e) => onTap(c.id, e.currentTarget)} aria-label={c.aria} aria-pressed={c.sel} tabIndex={focusable ? 0 : -1}>
        <span className="cc-in" onPointerMove={tiltMove} onPointerLeave={tiltLeave}>
          <span className="cc-f" aria-hidden="true">
            <span className="cc-top">
              <b>{c.rt}</b>
              <i>{c.zoneTxt}</i>
            </span>
            <span className="cc-art">
              <Shirt />
              <b>{c.num}</b>
            </span>
            <span className="cc-q">
              <i className={c.q[0] ? "on" : ""} />
              <i className={c.q[1] ? "on" : ""} />
              <i className={c.q[2] ? "on" : ""} />
            </span>
            <span className="cc-nm">{c.name}</span>
            <i className="foil" />
            <i className="glare" />
          </span>
          <span className="cb" aria-hidden="true">
            <img src={CREST} alt="" />
            <i className="foil" />
          </span>
          {showGal && c.gal.length > 0 && !mini && (
            <span className="cc-gal" aria-hidden="true">
              {c.gal.map((g) => (
                <i key={g}>{g}</i>
              ))}
            </span>
          )}
          {c.oop && (
            <span className="cc-oop" aria-hidden="true">
              !
            </span>
          )}
          {c.spin && (
            <span className="reel" aria-hidden="true">
              <span>
                {c.reel.map((n, k) => (
                  <b key={k}>{n}</b>
                ))}
              </span>
            </span>
          )}
        </span>
      </button>
      {c.tag && !mini && (
        <span className="cc-no" aria-hidden="true">
          {c.tag}
        </span>
      )}
      {c.me && !mini && (
        <span className="cc-me" aria-hidden="true">
          Tú
        </span>
      )}
    </div>
  );
}

// ── the bench: the album cromo (the same parts as the pitch cromo) and the FUT list row ──
function CvChip({ r }: { r: BenchRow }) {
  return (
    <span className={"ac-cv " + r.cvCls} aria-hidden="true">
      {r.icon && <Icon n={r.icon} w={11} />}
      {r.cv}
    </span>
  );
}

export interface BenchItemProps {
  r: BenchRow;
  onTap: (id: string, el: HTMLElement) => void;
}

/** A bench cromo (Cromos view, and the strip on phones). */
export function AlbumCromo({ r, onTap }: BenchItemProps) {
  return (
    <button type="button" className={"ac" + (r.cls ? " " + r.cls : "")} data-tok={r.id} data-zone={r.zone} onClick={(e) => onTap(r.id, e.currentTarget)} aria-label={r.aria} aria-pressed={r.sel}>
      <span className="ac-c">
        <span className="cc-f" aria-hidden="true">
          <span className="cc-top">
            <b>{r.rt}</b>
            <i>{r.pos}</i>
          </span>
          <span className="cc-art">
            <Shirt />
            <b>{r.num}</b>
          </span>
          <span className="cc-nm">{r.name}</span>
          <i className="foil" />
        </span>
        {r.me && (
          <span className="ac-me" aria-hidden="true">
            TÚ
          </span>
        )}
        {r.tg && (
          <span className="ac-tg" aria-hidden="true">
            {r.tg}
          </span>
        )}
      </span>
      <CvChip r={r} />
    </button>
  );
}

/** A bench player as a FUT list row (Lista view): rating shield, shirt, name and season line, status. */
export function BenchRowItem({ r, onTap }: BenchItemProps) {
  return (
    <button type="button" className={"ar" + (r.cls ? " " + r.cls : "")} data-tok={r.id} data-zone={r.zone} onClick={(e) => onTap(r.id, e.currentTarget)} aria-label={r.aria} aria-pressed={r.sel}>
      <span className="ar-r" aria-hidden="true">
        <b>{r.rt}</b>
        <i>{r.pos}</i>
      </span>
      <span className="ar-s" aria-hidden="true">
        <Shirt />
        <b>{r.num}</b>
      </span>
      <span className="ar-n">
        <b>{r.name}</b>
        <small>{r.line}</small>
      </span>
      <CvChip r={r} />
      {r.tg && (
        <span className="ar-tg" aria-hidden="true">
          <Icon n="swap" w={12} />
          {r.tg}
        </span>
      )}
    </button>
  );
}
