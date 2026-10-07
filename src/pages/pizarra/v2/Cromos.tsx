// The cromos: on the pitch (club cromo with the form rating, zone, dorsal, name plate, galones stickers,
// the out-of-position «!», the «NO VA» tag, the pack reel) and in the album (bench rail, tray, bajas).
import type { PointerEvent } from "react";
import { Icon, Shirt, CREST } from "./icons";
import { vars, type CardView } from "./view";
import type { Cromo } from "./model";

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
  onTap: (id: string, el: HTMLElement) => void;
}

export function PitchCromo({ c, showGal, mini, hov, focusable, onTap }: PitchCromoProps) {
  return (
    <div
      className={"cd " + c.cls + (hov ? " hov" : "")}
      style={vars({ "--x": c.x, "--y": c.y, "--fx": c.fx, "--fy": c.fy, "--mx": c.mx, "--my": c.my, "--sc": c.sc, "--i": c.i, "--z": c.z, "--rd": c.rd })}
      data-tok={c.id}
      data-zone="p"
      data-slot-i={c.i}
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

const CV_TXT = { voy: "Voy", duda: "Duda", no: "No va" } as const;

function albumAria(p: Cromo, me: boolean): string {
  return (
    p.name + ", dorsal " + p.num + ", " + (p.pos ?? "sin posición") + ", forma " + p.rt +
    (p.cv ? ", convocatoria: " + CV_TXT[p.cv].toLowerCase() : "") +
    ", " + p.stats.minutes + " minutos esta temporada" + (me ? ", eres tú" : "")
  );
}

export function AlbumCromo({ p, sel, me, onTap }: { p: Cromo; sel: boolean; me: boolean; onTap: (id: string, el: HTMLElement) => void }) {
  const cls = ["ac", p.pos === "POR" ? "gk" : "", p.cv === "no" ? "no-va" : "", me ? "me" : ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} data-tok={p.id} data-zone="b" onClick={(e) => onTap(p.id, e.currentTarget)} aria-label={albumAria(p, me)} aria-pressed={sel}>
      <span className="ac-f" aria-hidden="true">
        <span className="ac-top">
          <b>{p.rt}</b>
          <i>{p.pos ?? "—"}</i>
        </span>
        <span className="ac-art">
          <Shirt />
          <b>{p.num}</b>
        </span>
        <span className="ac-nm">{p.name}</span>
        <i className="foil" />
      </span>
      {p.cv && (
        <span className={"ac-cv " + p.cv} aria-hidden="true">
          {p.cv === "voy" ? <Icon n="check" w={11} /> : p.cv === "duda" ? <Icon n="doubt" w={11} /> : <Icon n="x" w={11} />}
          {CV_TXT[p.cv]}
        </span>
      )}
      {me && (
        <span className="ac-me" aria-hidden="true">
          Tú
        </span>
      )}
    </button>
  );
}

const BAJA_CLS = { Lesionado: "les", Sancionado: "san", Inactivo: "ina" } as const;

export function BajaCromo({ p }: { p: Cromo }) {
  const why = p.baja ?? "Inactivo";
  return (
    <div className={"ac baja" + (p.pos === "POR" ? " gk" : "")} data-tok={p.id} data-zone="x" role="img" aria-label={p.name + ", dorsal " + p.num + ": " + why.toLowerCase() + ", no disponible"}>
      <span className="ac-f" aria-hidden="true">
        <span className="ac-top">
          <b>{p.rt}</b>
          <i>{p.pos ?? "—"}</i>
        </span>
        <span className="ac-art">
          <Shirt />
          <b>{p.num}</b>
        </span>
        <span className="ac-nm">{p.name}</span>
      </span>
      <span className={"ac-bj " + BAJA_CLS[why]} aria-hidden="true">
        {why}
      </span>
    </div>
  );
}
