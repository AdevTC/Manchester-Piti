// «El palco» · the «Todas las estadísticas» sheet: a ranking for each of the app's statistics (and la porra, the
// team's only); picking one opens it in Jugadores.
import { Ic, SheetFrame } from "../kit";
import { statsSheet } from "../jugadoresView";
import type { SheetProps } from "../types";

export function StatsSheet({ v, st, act, onClose, sheetRef }: SheetProps) {
  const ss = statsSheet(v, st, act);
  return (
    <SheetFrame id="nx-s-stats" title="Todas las estadísticas" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__p">Un ranking para cada una. Elige y vuelve a la tabla.</p>
      <div className="nx-gr nx-gr--wide">
        {ss.groups.map((gp) => (
          <div key={gp.t}>
            <p className="nx-sheet__lab">{gp.t}</p>
            <div className="nx-picks">
              {gp.items.map((o) => (
                <button key={o.key} type="button" className="vd-glass nx-pick" aria-pressed={o.on} onClick={o.pick}>
                  {o.lock && <Ic name="lock" />}
                  {o.t}
                  {o.lock && <small>solo el equipo</small>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SheetFrame>
  );
}
