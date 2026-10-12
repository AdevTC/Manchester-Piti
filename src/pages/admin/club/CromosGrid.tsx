// «Todos en cromos»: the whole squad big — his kit (the photo of the real 3D shirt), name, line (amber when he
// has none), injured / asking for his ficha, and the ficha's slots. A cromo opens his ficha; the last one is
// «Alta de jugador» (the empty shirt).
import type { CSSProperties } from "react";
import { ShirtBack } from "../kit";
import { AdIcon } from "../ui/icons";
import { vtName } from "../ui/viewTransition";
import { GAPS, gapsText, type BoardRow } from "./plantillaBoard";
import { POS_LABEL } from "./plantillaLogic";

export interface CromosGridProps {
  rows: readonly BoardRow[];
  still: (row: BoardRow) => string | undefined;
  onOpen: (id: string) => void;
  onAlta: () => void;
  flying: ReadonlySet<string>;
  empty: string | null;
  phone: boolean;
}

export function CromosGrid({ rows, still, onOpen, onAlta, flying, empty, phone }: CromosGridProps) {
  const size = phone ? 84 : 104;
  return (
    <div className="pl3g" role="list" aria-label="Todos en cromos">
      {rows.map((r) => {
        const src = still(r);
        const style: CSSProperties | undefined = flying.has(`kit:${r.id}`) ? { viewTransitionName: vtName("pl-kit", r.id) } : undefined;
        return (
          <div key={r.id} role="listitem">
            <button type="button" className={["pc3", r.position ? "" : "nopos", r.injured ? "inj" : ""].filter(Boolean).join(" ")} onClick={() => onOpen(r.id)} aria-label={`Abrir la ficha de ${r.name}`}>
              <span className="kit" style={style} aria-hidden="true">
                {src ? <img src={src} alt="" width={size} height={Math.round(size * 1.11)} decoding="async" /> : <ShirtBack num={r.number ?? ""} name={r.name} size={size - 6} big />}
              </span>
              <span className="nm">
                <b>{r.name}</b>
                <small>{r.position ? POS_LABEL[r.position] : "Sin posición"}</small>
              </span>
              <span className="tg">
                {r.injured ? (
                  <em className="inj">
                    <AdIcon name="alert" size={13} />
                    Lesionado
                  </em>
                ) : null}
                {r.account === "pide" ? (
                  <em className="pide">
                    <AdIcon name="inbox" size={13} />
                    Pide su ficha
                  </em>
                ) : null}
              </span>
              <span className="sl2" role="img" aria-label={gapsText(r.gaps)}>
                {GAPS.map((g) => (
                  <i key={g.key} className={r.gaps.includes(g.key) ? "no" : ""}>
                    {g.short}
                  </i>
                ))}
              </span>
            </button>
          </div>
        );
      })}
      <div role="listitem">
        <button type="button" className="pc3 new" onClick={onAlta}>
          <span className="kit" aria-hidden="true">
            <ShirtBack num="+" size={size - 6} big state="empty" />
          </span>
          <span className="nm">
            <b>Alta de jugador</b>
            <small>Camiseta nueva</small>
          </span>
        </button>
      </div>
      {empty ? <p className="nores">{empty}</p> : null}
    </div>
  );
}
