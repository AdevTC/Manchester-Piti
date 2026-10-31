// «El palco» · «Busca o pregunta» (Ctrl K, the hero's button): the field, then what the words find — jugadores,
// rivales, estadísticas, rankings — and the questions grouped by the place that answers them. Every result goes there
// with act.ask (which closes the sheet). The results are numeros/view.ts's `v.search`; rivalesView.ts groups them.
import { Ic, PShirt, SheetFrame, Wait } from "../kit";
import { searchView } from "../rivalesView";
import type { SheetProps } from "../types";

export function SearchSheet({ v, st, act, onClose, sheetRef, catalogLoad }: SheetProps) {
  const s = searchView(v.search, st.sq);
  const typed = !!st.sq.trim();
  return (
    <SheetFrame id="nx-s-find" title="Busca o pregunta" onClose={onClose} sheetRef={sheetRef}>
      <label className="vd-glass nx-field nx-field--find">
        <Ic name="search" />
        <span className="nx-vh">Busca o pregunta</span>
        <input type="search" placeholder="Un jugador, un rival, una estadística…" value={st.sq} onChange={(e) => act.set({ sq: e.target.value })} />
      </label>
      {typed && v.cat.loading && <Wait t="Cargando las estadísticas…" fail={catalogLoad.error ? "No se ha podido cargar el catálogo de estadísticas. Lo demás ya está." : null} retry={catalogLoad.retry} />}
      <div className="nx-qs" aria-live="polite">
        {s.groups.map((gp) => (
          <div key={gp.key}>
            <h3>{gp.t}</h3>
            <ul>
              {gp.items.map((q) => (
                <li key={q.key}>
                  <button type="button" className="nx-qa" onClick={q.go}>
                    {q.shirt ? (
                      <PShirt n={q.n} />
                    ) : (
                      q.ic && (
                        <span className="nx-qa__i" aria-hidden="true">
                          <Ic name={q.ic} />
                        </span>
                      )
                    )}
                    <span className="nx-qa__t">
                      {q.t}
                      {q.s && <small>{q.s}</small>}
                    </span>
                    <Ic name="arrow" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {s.none && <p className="nx-sheet__p">Nada con esas palabras. Prueba con un nombre, un rival o una estadística.</p>}
    </SheetFrame>
  );
}
