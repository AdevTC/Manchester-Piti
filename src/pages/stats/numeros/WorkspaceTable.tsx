import type { CSSProperties } from "react";
import type { NuView } from "./view";

/** A configurable view of the same results used by the metric cards and charts. */
export function WorkspaceTable({ w }: { w: NuView["ws"] }) {
  return (
    <>
      <p className="nu-grow__note">Usa una vista rápida o elige tus columnas en Personalizado. Pulsa una cabecera para ordenar de mayor a menor y otra vez para invertirlo. «-» significa que falta el dato.</p>
      <ul className="nu-chips nu-chips--row" aria-label="Vistas de la tabla">
        {w.sets.map((o) => (
          <li key={o.key}><button type="button" className="nu-chip nu-chip--stat" aria-pressed={o.on} onClick={o.pick}>{o.t}</button></li>
        ))}
      </ul>
      <details className="nu-custom">
        <summary className="nu-custom__toggle">Personalizado <span>{w.selectedCount} columnas</span></summary>
        <div className="nu-custom__body">
          <p className="nu-regsub">Cualquier estadística del catálogo con datos para esta selección. Las apagadas explican qué falta; un cero confirmado sí está disponible.</p>
          <div className="nu-tools nu-custom__filters">
            <label className="nu-field"><span>Buscar columna</span><input className="vd-input" type="search" value={w.query} onChange={(e) => w.setQuery(e.target.value)} placeholder="Precisión, pases, paradas…" /></label>
            <label className="nu-field"><span>Familia de columnas</span><select className="vd-input" value={w.family} onChange={(e) => w.setFamily(e.target.value)}><option value="">Todas las familias</option>{w.families.map((family) => <option key={family} value={family}>{family}</option>)}</select></label>
          </div>
          <div className="nu-tools">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={w.selectAll} disabled={!w.availableCount}>Seleccionar todas las disponibles ({w.availableCount})</button>
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={w.clearColumns} disabled={!w.selectedCount}>Quitar todas</button>
            <span className="nu-regsub" role="status">{w.selectedCount} seleccionadas · {w.availableCount} disponibles</span>
          </div>
          <ul className="nu-custom__options" aria-label="Columnas personalizadas">
            {w.columns.map((column) => (
              <li key={column.key}>
                <label className={`nu-column${column.available ? "" : " is-unavailable"}`}>
                  <input type="checkbox" checked={column.selected} disabled={!column.available && !column.selected} onChange={column.toggle} aria-describedby={`nu-col-${column.key}`} />
                  <span><b>{column.t}</b><small id={`nu-col-${column.key}`}>{column.available ? column.family : `Sin datos · ${column.reason}`}</small></span>
                </label>
              </li>
            ))}
          </ul>
          {!w.columns.length && <p className="nu-empty">No hay estadísticas que coincidan con la búsqueda.</p>}
        </div>
      </details>
      <div className="nu-tools nu-custom__actions">
        <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={w.csv} disabled={!w.n}>Descargar tabla CSV</button>
        <span className="nu-regsub">{w.rows.length} jugadores · {w.n} columnas</span>
      </div>
      {!w.n ? <p className="nu-empty" role="status">No hay columnas seleccionadas. Abre Personalizado o elige una vista rápida para añadirlas.</p> : <>
        <p className="nu-swipe" aria-hidden="true">Desliza para ver más columnas →</p>
        <div className="nu-scroll" tabIndex={0} role="region" aria-label="Tabla con desplazamiento lateral">
          <div className="nu-ws nu-ws--custom" role="table" aria-label="Todos los números por jugador" style={{ "--n": w.n } as CSSProperties}>
            <div className="nu-ws__r nu-ws__r--h" role="row">
              <span role="columnheader" className="t">Jugador</span>
              {w.cols.map((column) => <span key={column.key} role="columnheader" aria-sort={column.sort}><button type="button" className="nu-ws__sort" onClick={column.pick} aria-label={`Ordenar por ${column.t}`}><span>{column.t}</span><span aria-hidden="true">{column.sort === "ascending" ? "↑" : column.sort === "descending" ? "↓" : "↕"}</span></button></span>)}
            </div>
            {w.rows.map((row) => <div key={row.key} className={`nu-ws__r ${row.cls}`.trim()} role="row"><span role="cell" className="t"><i>{row.n}</i>{row.name}</span>{row.cells.map((cell) => <span key={cell.key} role="cell" data-status={cell.status} title={cell.reason}>{cell.v}</span>)}</div>)}
            <div className="nu-ws__r nu-ws__r--f" role="row"><span role="cell" className="t">{w.totalLabel}</span>{w.foot.map((cell) => <span key={cell.key} role="cell" data-status={cell.status} title={cell.reason}>{cell.v}</span>)}</div>
          </div>
        </div>
        {!w.rows.length && <p className="nu-regsub">No hay jugadores identificados para esta selección; el total conserva las acciones del equipo.</p>}
        <p className="nu-regsub nu-custom__total">El total se calcula sobre las jugadas de la selección: los porcentajes usan aciertos e intentos conjuntos. Las acciones sin autor cuentan en el equipo, sin asignarlas a un jugador.</p>
      </>}
    </>
  );
}
