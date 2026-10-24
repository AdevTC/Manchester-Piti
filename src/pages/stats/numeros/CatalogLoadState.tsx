export type CatalogLoadStatus = { error: boolean; retry: () => void };

export function CatalogLoadState({ error, retry }: CatalogLoadStatus) {
  return error ? (
    <div className="nu-empty" role="alert">
      <p>No se ha podido cargar el catálogo. Tus filtros se conservan.</p>
      <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={retry}>Reintentar carga</button>
    </div>
  ) : <p className="nu-regsub" role="status">Cargando catálogo de estadísticas…</p>;
}
