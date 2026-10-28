// PLANTILLA · los cromos (/admin/plantilla/cromos), as the board's part-plantilla.html § Cromos: the whole squad big
// (printed shirt, dorsal and name, line, what needs something — Sin posición, Lesionado, Sancionado, Pide su ficha,
// Propone posiciones — and what it lacks), with the same search and chips as the rows; the last one is «Alta de
// jugador · Camiseta nueva». A cromo opens his ficha, which goes back to the cromos (?vista=cromos).
import { proposalState } from "../../../../lib/positionsEdit";
import { SalaLink } from "../../shell/SalaLink";
import { useSalaGo } from "../../shell/salaHref";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { vtName } from "../../ui/viewTransition";
import { ListTools } from "./ListTools";
import { useCsv, useListView } from "./listView";
import { gapWords, LINE_ONE } from "./model";
import { PlNav, Shirt } from "./parts";

export function CromosScreen() {
  const view = useListView();
  const { data, visible, chips, count, empty, still, blank, suspended } = view;
  const go = useSalaGo();
  const csv = useCsv();
  if (data.loading) return <ScreenLoading label="Cargando la plantilla" />;
  if (data.error && !view.squad.length) return <ScreenError what="la plantilla" onRetry={() => window.location.reload()} />;
  return (
    <SalaScreen title="Plantilla" lede={<span aria-live="polite">En cromos · {count}</span>} headTitle="Plantilla" headSub={`En cromos · ${count}`} actions={<PlNav at="jugadores" />} primary={{ label: "Alta de jugador", icon: "plus", onClick: () => go("/admin/plantilla/alta") }} fit className="sc-pl pl--cromos">
      <div className="pl-cromosw sc-scroll">
        <ListTools view="cromos" chips={chips} csv={csv} />
        {empty && <p className="pl-empty">{empty}</p>}
        <ul className="pl-cromos" aria-label="Todos en cromos">
          {visible.map((r) => {
            const tags = [!r.position ? "Sin posición" : "", r.injured ? "Lesionado" : "", r.sanctioned ? `Sancionado · ${(suspended.get(r.id)?.left ?? 1) === 1 ? "queda 1" : `quedan ${suspended.get(r.id)?.left}`}` : "", r.account === "pide" ? "Pide su ficha" : "", proposalState(r.doc) === "pendiente" ? "Propone posiciones" : ""].filter(Boolean);
            const line = r.position ? LINE_ONE[r.position] : "Sin posición";
            return (
              <li key={r.id}>
                <SalaLink className="pl-cromo" to={`/admin/plantilla/${encodeURIComponent(r.id)}?vista=cromos`} aria-label={`${r.name}, ${line.toLocaleLowerCase("es")}${tags.length ? `, ${tags.join(", ")}` : ""}, ${gapWords(r.gaps)}`}>
                  <Shirt src={still(r) ?? blank} size="l" vt={vtName("pl-shirt", r.id)} />
                  <span className="pl-cromo__n" aria-hidden="true">
                    <span className="sc-num">{r.number ?? "—"}</span> {r.name}
                  </span>
                  <span className="pl-cromo__l" aria-hidden="true">
                    {line}
                  </span>
                  {tags.length > 0 && (
                    <span className="pl-cromo__tags" aria-hidden="true">
                      {tags.map((t) => (
                        <span key={t} className="sc-tag sc-tag--quiet">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="pl-cromo__g" aria-hidden="true">
                    {gapWords(r.gaps)}
                  </span>
                </SalaLink>
              </li>
            );
          })}
          <li>
            <SalaLink className="pl-cromo pl-cromo--new" to="/admin/plantilla/alta">
              <Shirt src={blank} size="l" />
              <span className="pl-cromo__n">Alta de jugador</span>
              <span className="pl-cromo__l">Camiseta nueva</span>
            </SalaLink>
          </li>
        </ul>
      </div>
    </SalaScreen>
  );
}
