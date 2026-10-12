// Bloque 5 · mover varias fichas a la vez on screen: a ring under each ficha picked (inside the pitch's
// frame, so it rides along with a drag of the group) and the little bar on the pitch — «Seleccionar» for
// touch screens (a tap picks instead of acting), how many are picked, «Soltar» — with the way to move
// them (drag one, or the arrows). The board says every change through its one announcer.
import { Icon } from "./icons";
import { vars } from "./view";
import { fichasTxt } from "./multiSel";
import "../../../styles/pizarra-presenta.css";

export interface MultiRing {
  key: string;
  x: number;
  y: number;
}

export function MultiSelLayer({ rings }: { rings: MultiRing[] }) {
  if (!rings.length) return null;
  return (
    <>
      {rings.map((r) => (
        <span key={r.key} className="b5p-ring" data-msel={r.key} style={vars({ "--x": r.x.toFixed(2), "--y": r.y.toFixed(2) })} aria-hidden="true" />
      ))}
    </>
  );
}

export interface MultiSelBarProps {
  n: number;
  selecting: boolean;
  onSelecting: () => void;
  onClear: () => void;
}

export function MultiSelBar({ n, selecting, onSelecting, onClear }: MultiSelBarProps) {
  return (
    <div className="b5p-msb" role="group" aria-label="Mover varias fichas a la vez">
      <button type="button" className={"b5p-msb-b" + (selecting ? " on" : "")} onClick={onSelecting} aria-pressed={selecting}>
        <Icon n="layers" w={15} />
        Seleccionar
      </button>
      {n > 0 && (
        <>
          <span className="b5p-msb-n">
            <b>{n}</b> {n === 1 ? "elegida" : "elegidas"}
          </span>
          <button type="button" className="b5p-msb-b" onClick={onClear} aria-label={"Soltar las " + fichasTxt(n) + " elegidas"}>
            <Icon n="x" w={14} />
            Soltar
          </button>
        </>
      )}
      <small className="b5p-msb-h">
        {n > 1
          ? "Arrastra una y se mueven todas · flechas con el teclado"
          : selecting
            ? "Toca las fichas que quieras mover juntas"
            : "Mayús o Ctrl + clic para elegir varias"}
      </small>
    </div>
  );
}
