// «El palco» · «Qué números ver»: one filter for all of Estadísticas — the season, up to which jornada, where, the
// matches and the players. Unlike the prototype (one filter at a time), the groups add up: each shows its own
// choice and the four places follow all of them (numeros/view.ts cuts `v` with every one).
import { PShirt, Seg, SheetFrame } from "../kit";
import { scopeView } from "../rivalesView";
import type { SheetProps } from "../types";

export function ScopeSheet({ v, st, act, onClose, sheetRef }: SheetProps) {
  const s = scopeView(v, st, act);
  return (
    <SheetFrame id="nx-s-scope" title="Qué números ver" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__p">Un solo filtro para todo Estadísticas: la temporada, hasta qué jornada, dónde, los partidos y los jugadores. Se suman entre sí y se notan en los cuatro lugares.</p>
      <div>
        <p className="nx-sheet__lab">Temporada</p>
        <Seg label="Temporada" opts={s.season.map((o) => ({ t: o.t, on: o.on, pick: o.pick, key: o.t }))} />
      </div>
      <div>
        <p className="nx-sheet__lab">
          Hasta qué jornada <span>· la moviola, ahora en la cinta</span>
        </p>
        {s.jOff ? (
          <p className="nx-sheet__p">{s.jOffNote}</p>
        ) : (
          <div className="nx-jgrid" role="group" aria-label="Hasta qué jornada">
            {s.js.map((o) => (
              <button key={o.key} type="button" className={`vd-glass nx-pick${o.cls ? ` ${o.cls}` : ""}`} aria-pressed={o.on} aria-label={o.aria} onClick={o.pick}>
                {o.t} {o.letter ? <small className="nx-jl" aria-hidden="true">{o.letter}</small> : null}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="nx-sheet__lab">Dónde</p>
        <Seg label="Dónde" opts={s.where.map((o) => ({ t: o.t, on: o.on, pick: o.pick, key: o.t }))} />
      </div>
      {s.matches.length > 0 && (
        <div>
          <p className="nx-sheet__lab">
            Partidos <span>· uno o varios; sin ninguno, todos</span>
          </p>
          <div className="nx-picks" role="group" aria-label="Partidos">
            {s.matches.map((o) => (
              <button key={o.key} type="button" className="vd-glass nx-pick" aria-pressed={o.on} onClick={o.pick}>
                {o.t}
                {o.s && <small>{o.s}</small>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="nx-sheet__lab">
          Jugadores <span>· sus jugadas en El juego, su ficha en Jugadores</span>
        </p>
        <div className="nx-picks" role="group" aria-label="Jugadores">
          {s.people.map((o) => (
            <button key={o.key} type="button" className="vd-glass nx-pick" aria-pressed={o.on} onClick={o.pick}>
              <PShirt n={o.n} />
              {o.t}
            </button>
          ))}
        </div>
        {s.players && <p className="nx-sheet__p nx-sheet__p--after">Las tablas y los rankings muestran los jugadores elegidos; los resultados del equipo conservan a todos.</p>}
      </div>
      <p className="nx-sheet__p" role="status">
        {s.count}
      </p>
      <div className="nx-sheet__btns">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={onClose}>
          Ver los números
        </button>
        <button type="button" className="nx-lnk" onClick={s.clear}>
          Quitar filtros
        </button>
      </div>
    </SheetFrame>
  );
}
