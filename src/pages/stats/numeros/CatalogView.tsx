import type { NuView } from "./view";
import { useProgressiveLoad } from "../../../hooks/useProgressiveLoad";
import { CatalogLoadState, type CatalogLoadStatus } from "./CatalogLoadState";

export function CatalogView({ c, load, paused }: { c: NuView["cat"]; load: CatalogLoadStatus; paused: boolean }) {
  const batchKey = [c.q, c.xOn, c.fams.find((f) => f.on)?.key, c.items.length].join(":");
  const sentinel = useProgressiveLoad(!c.loading && !load.error && c.more && !paused, batchKey, c.showMore);
  if (c.loading) return <CatalogLoadState {...load} />;
  return <>
        <p className="nu-grow__note">412 definiciones para el fútbol 7. Las que necesitan vídeo, seguimiento u otra fuente se ven aparte.</p>
        <div className="nu-tools">
          <label className="nu-field">
            <span>Buscar estadística</span>
            <input className="vd-input" type="search" value={c.q} onChange={(e) => c.setQ(e.target.value)} placeholder="Pases, recuperaciones, minutos…" />
          </label>
          <button type="button" className="nu-switchbtn" role="switch" aria-checked={c.xOn} onClick={c.toggleX}>
            <span className="nu-switchbtn__t" aria-hidden="true">
              <i />
            </span>
            {c.xT}
          </button>
        </div>
        <p className="nu-regsub">Familia</p>
        <ul className="nu-chips nu-chips--fams" aria-label="Familias del catálogo">
          {c.fams.map((f) => (
            <li key={f.key}>
              <button type="button" className="nu-chip nu-chip--stat" aria-pressed={f.on} onClick={f.pick}>
                {f.t}
              </button>
            </li>
          ))}
        </ul>
        <p className="nu-legend2">
          <span>
            <i className="nu-dot nu-dot--ok" />
            Completo
          </span>
          <span>
            <i className="nu-dot nu-dot--part" />
            Parcial
          </span>
          <span>
            <i className="nu-dot" />
            Sin información para la selección
          </span>
        </p>
        <p className="nu-regsub" aria-live="polite">
          {c.count}
        </p>
        <ul className="nu-cat" aria-label="Estadísticas del catálogo">
          {c.items.map((x) => (
            <li key={x.key}>
              <button type="button" className={`nu-cat__b ${x.cls}`} onClick={x.pick} aria-haspopup="dialog">
                <i>{x.id}</i>
                <b>{x.t}</b>
                <span>{x.fam}</span>
                <em>{x.st}</em>
              </button>
            </li>
          ))}
        </ul>
        {c.empty && <p className="nu-empty">Ninguna estadística coincide. Prueba con otra palabra o quita la familia.</p>}
        <div ref={sentinel}>
        {c.more && (
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={c.showMore}>
            {c.moreT}
          </button>
        )}
        </div>
  </>;
}
