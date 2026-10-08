// The match list (`.cd.ml`): search (rival or «J8»), the filter Todo / Por hacer / Publicados / Por jugar
// with counts, sticky groups and the rows (J·fecha, rival, state chip, score or time). Scrolls inside.
import { EmptyState, Segmented, SkeletonRows } from "../ui/controls";
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
  onNew,
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
  onNew: () => void;
}) {
  const empty = !model.groups.length;
  return (
    <div className="cd ml">
      <div className="tools">
        <label className="srch">
          <AdIcon name="search" />
          <span className="sr">Buscar partido</span>
          <input className="inp" type="search" placeholder="Buscar rival o jornada" value={query} onChange={(e) => onQuery(e.target.value)} />
        </label>
        <Segmented
          className="g4"
          label="Filtrar partidos"
          value={filter}
          options={FILTERS.map((f) => ({ value: f.key, label: f.label, count: model.counts[f.key] }))}
          onChange={onFilter}
        />
      </div>
      <div className="scr">
        {loading ? (
          <SkeletonRows rows={5} label="Cargando partidos…" />
        ) : error ? (
          <EmptyState icon="alert" title="No se han podido cargar los partidos" className="ad-err">
            Revisa la conexión: la lista se actualiza sola en cuanto vuelva.
          </EmptyState>
        ) : (
          <>
            {model.groups.map((g) => (
              <div className="mg" key={g.key} role="group" aria-label={g.title}>
                <p className="lbl">
                  <span>{g.title}</span>
                  <span>{g.rows.length}</span>
                </p>
                {g.rows.map((r) => (
                  <button key={r.id} type="button" className="mr" aria-current={selectedId === r.id ? "true" : undefined} onClick={() => onOpen(r.id)} aria-label={r.aria}>
                    <span className="j">
                      <b>{r.j}</b>
                      {r.day}
                    </span>
                    <span className="m">
                      <b>{r.rival}</b>
                      <span className={`chip ${r.chip.tone}`.trim()}>
                        {r.chip.icon && <AdIcon name={r.chip.icon} size={12} />}
                        {r.chip.text}
                      </span>
                    </span>
                    <span className="r">
                      <span className={`sc${r.dim ? " dim" : ""}`}>{r.score}</span>
                      <small>{r.where}</small>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {empty && (
              <EmptyState icon="search" title="Ningún partido" className="ad-ml-empty">
                {query.trim() ? `Nada con «${query.trim()}». Busca por rival o por jornada (J8).` : model.counts.todo ? "No hay partidos con ese filtro." : "Todavía no hay partidos: crea el primero."}
              </EmptyState>
            )}
            {empty && !model.counts.todo && (
              <div className="row ad-ml-new">
                <button type="button" className="btn sm gold" onClick={onNew}>
                  <AdIcon name="plus" size={16} />
                  Nuevo partido
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
