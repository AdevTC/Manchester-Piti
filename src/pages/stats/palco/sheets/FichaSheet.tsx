// «El palco» · a statistic's ficha (the prototype's sheet, Numeros.dc.html 1211–1224): its family and id, the value
// with its status, what it is, for whom, what la mesa must narrate, «Por jugador», the plays behind it and the two
// ways on — the mesa with its column, its family in the catalogue.
import { Link } from "@tanstack/react-router";
import { ficha } from "../juegoView";
import { PShirt, SheetFrame, Wait } from "../kit";
import type { SheetProps } from "../types";

export function FichaSheet({ v, st, act, onClose, sheetRef, catalogLoad }: SheetProps) {
  const fi = ficha(v, st, act);
  if (!fi)
    return (
      <SheetFrame
        id="nx-s-ficha"
        head={
          <div>
            <p className="nx-sheet__k">{st.sheetId}</p>
            <h2 id="nx-s-ficha">{v.cat.loading ? "Cargando la ficha…" : "Estadística no encontrada"}</h2>
          </div>
        }
        onClose={onClose}
        sheetRef={sheetRef}
      >
        {v.cat.loading ? (
          <Wait t="Cargando la ficha…" fail={catalogLoad.error ? "No ha llegado la ficha." : null} retry={catalogLoad.retry} />
        ) : (
          <p className="nx-sheet__p">Esta estadística no está en el catálogo. Cierra la ficha y búscala por su nombre.</p>
        )}
      </SheetFrame>
    );
  return (
    <SheetFrame
      id="nx-s-ficha"
      head={
        <div>
          <p className="nx-sheet__k">
            {fi.fam} · {fi.id}
          </p>
          <h2 id="nx-s-ficha">{fi.t}</h2>
        </div>
      }
      onClose={onClose}
      sheetRef={sheetRef}
    >
      <div className="nx-ficha__v">
        <b>{fi.v}</b>
        <span className="nx-sheet__p">
          <i className={`nx-st ${fi.cls}`.trim()} aria-hidden="true" /> {fi.st}
        </span>
      </div>
      {fi.why && <p className="nx-sheet__p">{fi.why}</p>}
      <dl className="nx-dl">
        <div>
          <dt>Qué es</dt>
          <dd>{fi.def}</dd>
        </div>
        <div>
          <dt>Para quién</dt>
          <dd>{fi.scope}</dd>
        </div>
        <div>
          <dt>Qué tiene que narrar la mesa</dt>
          <dd>{fi.narr}</dd>
        </div>
      </dl>
      {fi.hasRows && (
        <div>
          <p className="nx-sheet__lab">Por jugador</p>
          <ol className="nx-gr" aria-label="Por jugador">
            {fi.rows.map((r) => (
              <li key={r.key} className="nx-rc nx-rc--ficha">
                <PShirt n={r.n} className="nx-shirt" />
                <span className="nx-rc__n">{r.name}</span>
                <span className="nx-rc__b" aria-hidden="true">
                  <i style={{ width: `${r.w}%` }} />
                </span>
                <span className="nx-rc__v">{r.v}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {fi.excluded && <p className="nx-sheet__p">Esta no se puede narrar por audio: queda fuera de las actas habladas.</p>}
      <div>
        <p className="nx-sheet__lab">Jugadas y registros</p>
        {fi.noEv ? (
          <p className="nx-sheet__p">Sin jugadas que mostrar en este período.</p>
        ) : (
          <ul className="nx-ev" aria-label="Jugadas y registros">
            {fi.evid.map((e) => (
              <li key={e.key}>
                <Link to={e.href}>
                  <b>{e.t}</b>
                  <span>{e.d}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {fi.evMore && <p className="nx-sheet__p">{fi.evMore} en el catálogo.</p>}
      </div>
      <div className="nx-sheet__btns">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={fi.toMesa}>
          Verla en la mesa, por jugador
        </button>
        <button type="button" className="nx-lnk" onClick={fi.toCat}>
          Ver su familia en el catálogo
        </button>
      </div>
    </SheetFrame>
  );
}
