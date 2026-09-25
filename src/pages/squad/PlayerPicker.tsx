import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../components/celeste/icons";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { useFocusTrap } from "../pizarra/useFocusTrap";
import { matchesQuery, type SquadRow } from "../../lib/squad";

interface Props {
  side: "a" | "b";
  rows: SquadRow[];
  chosenId: string;
  otherId: string;
  kit: "home" | "away";
  still: (row: SquadRow) => string | undefined;
  onPick: (id: string) => void;
  onClose: () => void;
}

/** Choose who goes into a corner of the duel: every shirt, searchable, with the rival marked. */
export function PlayerPicker({ side, rows, chosenId, otherId, kit, still, onPick, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  useFocusTrap(panel, onClose);
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);
  const list = rows.filter((r) => matchesQuery(r, query));
  const label = side === "a" ? "Jugador 1" : "Jugador 2";
  return createPortal(
    <div className="vx sq-layer" data-kit={kit}>
      <div className="sq-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`sq-picker ${side}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby="sq-picker-t">
        <div className="head">
          <span className="corner">{label}</span>
          <h2 id="sq-picker-t">Elige jugador</h2>
          <button type="button" className="sq-round" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={18} stroke={2.2} />
          </button>
        </div>
        <label className="sq-search">
          <Icon name="search" size={18} stroke={2} />
          <input type="search" aria-label="Buscar jugador para comparar" placeholder="Nombre o dorsal" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <ul className="grid">
          {list.map((r, i) => {
            const src = still(r);
            const chosen = r.id === chosenId;
            const other = r.id === otherId;
            return (
              <li key={r.id} style={{ "--i": i } as CSSProperties}>
                <button
                  type="button"
                  className={chosen ? "on" : other ? "rival" : undefined}
                  aria-pressed={chosen}
                  aria-label={`${r.name}, dorsal ${r.num}${chosen ? ", elegido" : other ? `, ahora en ${side === "a" ? "el jugador 2" : "el jugador 1"}: se intercambian` : ""}`}
                  onClick={() => onPick(r.id)}
                >
                  <span className="pic">{src ? <img src={src} alt="" draggable={false} /> : <ShirtBack name={r.name} num={r.num} />}</span>
                  <b>{r.name}</b>
                  <small>{chosen ? "En esta esquina" : other ? "Intercambiar" : r.full || `Dorsal ${r.num}`}</small>
                </button>
              </li>
            );
          })}
        </ul>
        {!list.length && <p className="sq-note">Nadie lleva ese nombre ni ese dorsal.</p>}
      </div>
    </div>,
    document.body,
  );
}
