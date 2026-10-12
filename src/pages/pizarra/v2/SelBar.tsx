// The player in the hand: his action bar (it replaces the hint line). On the pitch's apron on a tablet
// and on a touch desktop (`sb-p`), at the top of the sheet on a phone (`sb-s`); the board renders one.
// His mini cromo, who he is and where, what a tap does now (handView.ts), and Capitán · Galones (pitch
// players) · Ficha · ✕. A toolbar: one Tab stop, the arrows (Home / End) move between its buttons.
import { useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Icon, Shirt } from "./icons";
import { rove, type SelBarView } from "./handView";

export interface SelBarProps {
  k: "sb-p" | "sb-s";
  v: SelBarView;
  onCap: () => void;
  onGal: () => void;
  onFicha: () => void;
  onClear: () => void;
}

export function SelBar({ k, v, onCap, onGal, onFicha, onClear }: SelBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  // (Capitán 0 · Galones 1 for a pitch player, then Ficha · Soltar)
  const off = v.onPitch ? 2 : 0;
  const n = off + 2;
  const [at, setAt] = useState(0);
  const cur = Math.min(at, n - 1);
  const tab = (i: number) => (i === cur ? 0 : -1);
  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button.sbb") ?? []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = rove(e.key, cur, n);
    if (next == null) return;
    // (the board's arrows move the hand between slots: not from here)
    e.preventDefault();
    e.stopPropagation();
    setAt(next);
    buttons()[next]?.focus({ preventScroll: true });
  };
  // a click (or a tap) on a button makes it the toolbar's Tab stop too
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const t = e.target;
    const b = t instanceof HTMLButtonElement ? buttons().indexOf(t) : -1;
    if (b >= 0 && b !== cur) setAt(b);
  };
  return (
    <div ref={ref} className={"selbar " + k} role="toolbar" aria-label={"En la mano: " + v.name} onKeyDown={onKey} onFocus={onFocus}>
      <span className={"sb-mini" + (v.gk ? " gk" : "")} aria-hidden="true">
        <span className="cc-f">
          <span className="cc-top">
            <b>{v.rt}</b>
            <i>{v.pos}</i>
          </span>
          <span className="cc-art">
            <Shirt />
            <b>{v.num}</b>
          </span>
          <span className="cc-nm">{v.name}</span>
        </span>
      </span>
      <div className="sb-t">
        <small>{v.kick}</small>
        <b>{v.txt}</b>
      </div>
      {v.onPitch && (
        <>
          <button type="button" className="sbb" tabIndex={tab(0)} onClick={onCap} aria-pressed={v.captain} aria-label={v.captain ? "Quitar el brazalete a " + v.name : "Hacer capitán a " + v.name}>
            <i className="coin" aria-hidden="true">
              C
            </i>
            <span>Capitán</span>
          </button>
          <button type="button" className="sbb" tabIndex={tab(1)} onClick={onGal} aria-label={"Galones y posición de " + v.name}>
            <Icon n="dots" w={16} />
            <span>Galones</span>
          </button>
        </>
      )}
      <button type="button" className="sbb" tabIndex={tab(off)} onClick={onFicha} aria-label={"Ficha de " + v.name}>
        <Icon n="info" w={16} />
        <span>Ficha</span>
      </button>
      <button type="button" className="sbb x" tabIndex={tab(off + 1)} onClick={onClear} aria-label={"Soltar a " + v.name}>
        <Icon n="x" w={15} />
      </button>
    </div>
  );
}
