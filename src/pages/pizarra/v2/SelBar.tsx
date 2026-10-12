// The player in the hand: his action bar (it replaces the hint line). On the pitch's apron on a tablet
// and on a touch desktop (`sb-p`), at the top of the sheet on a phone (`sb-s`); the CSS shows one. His
// mini cromo, who he is and where, what a tap does now (handView.ts), and Capitán · Galones (pitch
// players) · Ficha · ✕.
import { Icon, Shirt } from "./icons";
import type { SelBarView } from "./handView";

export interface SelBarProps {
  k: "sb-p" | "sb-s";
  v: SelBarView;
  onCap: () => void;
  onGal: () => void;
  onFicha: () => void;
  onClear: () => void;
}

export function SelBar({ k, v, onCap, onGal, onFicha, onClear }: SelBarProps) {
  return (
    <div className={"selbar " + k} role="toolbar" aria-label={"En la mano: " + v.name}>
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
          <button type="button" className="sbb" onClick={onCap} aria-pressed={v.captain} aria-label={v.captain ? "Quitar el brazalete a " + v.name : "Hacer capitán a " + v.name}>
            <i className="coin" aria-hidden="true">
              C
            </i>
            <span>Capitán</span>
          </button>
          <button type="button" className="sbb" onClick={onGal} aria-label={"Galones y posición de " + v.name}>
            <Icon n="dots" w={16} />
            <span>Galones</span>
          </button>
        </>
      )}
      <button type="button" className="sbb" onClick={onFicha} aria-label={"Ficha de " + v.name}>
        <Icon n="info" w={16} />
        <span>Ficha</span>
      </button>
      <button type="button" className="sbb x" onClick={onClear} aria-label={"Soltar a " + v.name}>
        <Icon n="x" w={15} />
      </button>
    </div>
  );
}
