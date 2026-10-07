// The board's overlays: the long-press radial fan, the ficha (the cromo flies to the centre and flips to
// its stats), and the stage FX (the «¡Siete listo!» flash, the replay's crest wipe and the rewind).
import { useEffect, useRef } from "react";
import { CREST, Icon, Shirt } from "./icons";
import { SPARKS } from "./geometry";
import type { FanItem } from "./fan";
import { vars } from "./view";

/** Focus the first control, keep Tab inside, close on Escape, give focus back on close. */
function useDialog(ref: React.RefObject<HTMLElement | null>, first: string, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    node.querySelector<HTMLElement>(first)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = Array.from(node.querySelectorAll<HTMLElement>("button:not([disabled]):not([tabindex='-1'])"));
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus({ preventScroll: true });
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      if (prev?.isConnected) prev.focus({ preventScroll: true });
    };
  }, [ref, first]);
}

export interface FanProps {
  cx: number;
  cy: number;
  num: number;
  title: string;
  items: FanItem[];
  onItem: (it: FanItem) => void;
  onClose: () => void;
}

export function Fan({ cx, cy, num, title, items, onItem, onClose }: FanProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, ".fi", onClose);
  return (
    <div ref={ref} className="fan" role="dialog" aria-label={"Menú rápido de " + title} style={vars({ "--cx": cx + "px", "--cy": cy + "px" })}>
      <button type="button" className="fan-bk" onClick={onClose} aria-label="Cerrar el menú" />
      <div className="fan-c">
        <b aria-hidden="true">{num}</b>
        <span aria-hidden="true">{title}</span>
        {items.map((it) => (
          <button key={it.key} type="button" className="fi" style={vars({ "--dx": it.dx, "--dy": it.dy, "--d": it.d + "s" })} onClick={() => onItem(it)} aria-pressed={it.on} aria-label={it.aria}>
            <i aria-hidden="true">
              {it.kind === "role" || it.kind === "zone" ? it.glyph : it.kind === "banquillo" ? <Icon n="bench" w={19} /> : it.kind === "ficha" ? <Icon n="info" w={19} /> : it.kind === "jugar" ? <Icon n="swap" w={19} /> : <Icon n="chevL" w={19} />}
            </i>
            <small>{it.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface FichaView {
  name: string;
  num: number;
  rt: number;
  pos: string;
  gk: boolean;
  sub: string;
  st: { k: string; v: number }[];
  ln: { k: string; v: string }[];
  ox: string;
  oy: string;
  side: "auto" | "front" | "back";
}

export function Ficha({ f, rm, onFlip, onClose }: { f: FichaView; rm: boolean; onFlip: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, ".fic-a .b3", onClose);
  const cls = f.side === "auto" ? (rm ? "back" : "auto") : f.side;
  return (
    <div ref={ref} className={"fic " + cls} role="dialog" aria-modal="true" aria-label={"Ficha de " + f.name}>
      <button type="button" className="fic-bk" onClick={onClose} aria-label="Cerrar la ficha" tabIndex={-1} />
      <div className="fic-w">
        <div className={"fcard" + (f.gk ? " gk" : "")} style={vars({ "--ox": f.ox, "--oy": f.oy })}>
          <div className="fc-in">
            <div className="fc-f" aria-hidden="true">
              <div className="fc-top">
                <b>{f.rt}</b>
                <span>
                  <span>{f.pos}</span>
                  <span>FORMA</span>
                </span>
              </div>
              <div className="fc-art">
                <Shirt />
                <b>{f.num}</b>
              </div>
              <div className="fc-nm">{f.name}</div>
              <i className="foil" />
            </div>
            <div className="fc-b">
              <header>
                <b>{f.num}</b>
                <span>
                  <strong>{f.name}</strong>
                  <small>{f.sub}</small>
                </span>
              </header>
              <div className="fc-st">
                {f.st.map((s) => (
                  <div key={s.k}>
                    <b>{s.v}</b>
                    <small>{s.k}</small>
                  </div>
                ))}
              </div>
              <span className="fc-k">EN ESTE SIETE</span>
              <ul className="fc-ln">
                {f.ln.map((l) => (
                  <li key={l.k}>
                    <span>{l.k}</span>
                    <b>{l.v}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="fic-a">
          <button type="button" className="b3" onClick={onFlip}>
            <Icon n="rot" />
            {f.side === "front" ? "Ver el dorso" : "Ver el frente"}
          </button>
          <button type="button" className="b3 gold" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function FxLayer({ cele, celeSub, rw, rwKey, wipe = null }: { cele: boolean; celeSub: string; rw: string; rwKey: number; wipe?: number | null }) {
  return (
    <div className="fx" aria-hidden="true">
      {cele && (
        <div className="cele">
          <span className="fl" />
          <div className="sparks">
            {SPARKS.map((s, k) => (
              <i key={k} style={vars({ "--x": s.x, "--c": s.c, "--d": s.d, "--w": s.w, "--r": s.r })} />
            ))}
          </div>
          <b>¡SIETE LISTO!</b>
          <span>{celeSub}</span>
        </div>
      )}
      {wipe != null && (
        <div key={wipe} className={"wipe " + (wipe % 2 ? "wa" : "wb")}>
          <img src={CREST} alt="" />
          <b>REPETICIÓN</b>
        </div>
      )}
      {rw && (
        <div key={rwKey}>
          <div className="rwd" />
          <span className="rwc">
            <Icon n="rewind" w={14} />
            {rw}
          </span>
        </div>
      )}
    </div>
  );
}
