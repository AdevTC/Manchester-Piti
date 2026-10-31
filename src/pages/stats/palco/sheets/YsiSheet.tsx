// «El palco» · the «¿Y si…?» sheet: a made-up result for each game still to play; the points add up at once and,
// with the league's table, we and the rival of each game move (temporada.ts re-sorts the whole table).
import { SheetFrame } from "../kit";
import { ysiView } from "../temporadaView";
import type { SheetProps } from "../types";

export function YsiSheet({ v, st, act, onClose, sheetRef }: SheetProps) {
  const ys = ysiView(v, st, act);
  return (
    <SheetFrame id="nx-s-ysi" title="¿Y si…?" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__p">{ys.lead}</p>
      <p className="nx-proj" aria-live="polite">
        <b>{ys.proj}</b>
        {ys.projT}
        {ys.hasPos && <span className="nx-viva">{ys.pos}</span>}
      </p>
      <div>
        {ys.rows.map((y) => (
          <div key={y.key} className="nx-ysi__r">
            <span>
              <b>
                {y.j} · {y.rival}
              </b>
              <span>{y.where}</span>
            </span>
            <span className="nx-gep" role="group" aria-label={y.lab}>
              <button type="button" aria-pressed={y.g} aria-label="Ganamos" onClick={y.pg}>
                G
              </button>
              <button type="button" aria-pressed={y.e} aria-label="Empatamos" onClick={y.pe}>
                E
              </button>
              <button type="button" aria-pressed={y.p} aria-label="Perdemos" onClick={y.pp}>
                P
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="nx-sheet__btns">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={onClose}>
          {ys.goT}
        </button>
        <button type="button" className="nx-lnk" onClick={ys.all}>
          {ys.allT}
        </button>
        <button type="button" className="nx-lnk" onClick={ys.clear}>
          Borrar mis resultados
        </button>
      </div>
    </SheetFrame>
  );
}
