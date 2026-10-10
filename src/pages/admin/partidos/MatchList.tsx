// The match list (`.ml`), as on the canvas (stats-gen/ad-v2-full.mjs `master`, `mrow`): the search (rival or
// «J8»), the filter Todo / Por hacer / Por jugar / Publicados, sticky groups and the rows — J + date, the
// rival's full name, the exception under it in amber (or where it is played), the score with its V/E/D
// mark or the kick-off time. Scrolls inside its panel (phones: inside the page's scroller).
import { useId } from "react";
import { ResultMark } from "../kit";
import { AdIcon } from "../ui/icons";
import { FILTERS, type ListFilter, type MatchListModel } from "./listModel";

export function MatchList({
  model,
  filter,
  query,
  selectedId,
  loading,
  error,
  onFilter,
  onQuery,
  onOpen,
}: {
  model: MatchListModel;
  filter: ListFilter;
  query: string;
  selectedId: string | null;
  loading: boolean;
  error: boolean;
  onFilter: (f: ListFilter) => void;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
}) {
  const id = useId();
  const q = query.trim();
  return (
    <div className="ml">
      <label className="srch">
        <AdIcon name="search" />
        <input id={`${id}-q`} type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Rival o jornada (J8)" aria-label="Buscar partido" />
      </label>
      <div className="seg2 sm" role="group" aria-label="Filtrar partidos">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => onFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="scr">
        {loading ? (
          <div className="skel" role="status" aria-label="Cargando partidos">
            <i />
            <i />
            <i />
          </div>
        ) : error ? (
          <p className="bad" role="alert" style={{ padding: "20px 8px" }}>
            <AdIcon name="alert" size={16} />
            No se han podido cargar los partidos: la lista se actualiza sola en cuanto vuelva la conexión.
          </p>
        ) : (
          <>
            {model.groups.map((g) => (
              <div key={g.key} className="mg" role="group" aria-labelledby={`${id}-${g.key}`}>
                <p className="mgh" id={`${id}-${g.key}`}>
                  {g.title} <em>{g.rows.length}</em>
                </p>
                {g.rows.map((r) => (
                  <button key={r.id} type="button" className="mr" aria-current={selectedId === r.id ? "true" : undefined} onClick={() => onOpen(r.id)} aria-label={r.aria}>
                    <span className="j">
                      <b>{r.j}</b>
                      <small>{r.day}</small>
                    </span>
                    <span className="w">
                      <b>{r.rival}</b>
                      <small className={r.warn ? "am" : undefined}>{r.sub}</small>
                    </span>
                    {r.score ? (
                      <span className="s">
                        <ResultMark r={r.score.r} />
                        {r.score.gf}–{r.score.ga}
                      </span>
                    ) : (
                      <span className="s t">{r.time}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
            {!model.groups.length && (
              <p className="hint" style={{ padding: "20px 8px" }}>
                {q ? `Ningún partido con «${q}».` : model.counts.todo ? "Ningún partido con ese filtro." : "Todavía no hay partidos: crea el primero con «Nuevo partido»."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
