// PLANTILLA · the head of the list and of the cromos: the search («/»), «Filas · Cromos», «Exportar CSV» (cromos) and
// the chips of «Qué falta» (only what something matches; «Todo en orden…» when nothing does).
import type { CSSProperties } from "react";
import type { BoardFilter } from "../../club/plantillaBoard";
import { SalaLink } from "../../shell/SalaLink";
import { Icon } from "./parts";
import { usePlantilla } from "./storeContext";

/** The search, «Filas · Cromos» and the chips (the list's and the cromos' head). */
export function ListTools({ view, chips, csv }: { view: "rows" | "cromos"; chips: { key: Exclude<BoardFilter, "todos">; label: string; n: number }[]; csv?: () => void }) {
  const { q, setQ, filter, setFilter } = usePlantilla();
  return (
    <div className="pl-tools">
      <div className="pl-tools__row">
        <label className="pl-search">
          <span className="vd-vh">Buscar jugador</span>
          <Icon name="search" />
          <input className="vd-input vd-glass" type="search" value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="Nombre o dorsal" aria-label="Buscar jugador por nombre o dorsal" aria-keyshortcuts="/" autoComplete="off" />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <div className="vd-seg vd-glass pl-view" role="group" aria-label="Vista" style={{ "--n": 2, "--i": view === "cromos" ? 1 : 0 } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          <SalaLink className="vd-seg__b" to="/admin/plantilla" aria-current={view === "rows" ? "page" : undefined}>
            Filas
          </SalaLink>
          <SalaLink className="vd-seg__b" to="/admin/plantilla/cromos" aria-current={view === "cromos" ? "page" : undefined}>
            Cromos
          </SalaLink>
        </div>
        {csv && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={csv} aria-label="Exportar la plantilla (CSV)">
            <Icon name="download" />
            Exportar CSV
          </button>
        )}
      </div>
      <div className="sc-chips pl-chips" role="group" aria-label="Qué falta">
        {chips.map((c) => (
          <button key={c.key} type="button" className="sc-chip vd-glass vd-press" aria-pressed={filter === c.key} aria-label={`${c.label}: ${c.n}`} onClick={() => setFilter(filter === c.key ? "todos" : c.key)}>
            {c.label}
            <b className="sc-num">{c.n}</b>
          </button>
        ))}
        {!chips.length && <p className="pl-ok">Todo en orden: fichas completas, sin repetidos.</p>}
      </div>
    </div>
  );
}

