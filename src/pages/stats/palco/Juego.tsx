// «El palco» · El juego: the prototype's template (Numeros.dc.html) in JSX — de un vistazo in three families, the four
// doors (the charts, the mesa, the catalogue, the export), when the goals fall, the pass, the tramos, what is narrated;
// and the three windows that grow in place. The arithmetic is in juego.ts; the numbers come from view.ts.
import type { CSSProperties } from "react";
import { StatsChartsPanel } from "../../../components/celeste/StatsChartsPanel";
import { useProgressiveLoad } from "../../../hooks/useProgressiveLoad";
import { catalogo, juego, mesa } from "./juegoView";
import { Ic, PShirt, Wait, Win } from "./kit";
import { filterLabel } from "./scope";
import type { JuegoProps } from "./types";

const css = (o: Record<string, string | number>) => o as CSSProperties;

/** A one-of-several choice that keeps its radio semantics (the prototype's glass segment, its bead under the choice). */
function Radios({ label, opts, style }: { label: string; opts: { t: string; on: boolean; pick: () => void; off?: boolean }[]; style?: CSSProperties }) {
  const i = Math.max(0, opts.findIndex((o) => o.on));
  return (
    <div className="vd-glass vd-seg nx-seg" role="radiogroup" aria-label={label} style={{ ...css({ "--n": opts.length, "--i": i }), ...style }}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.t} type="button" role="radio" className="vd-seg__b" aria-checked={o.on} onClick={o.pick} disabled={o.off}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

/** Whose plays and which half: on the place and in each window (the charts, the mesa and the catalogue follow them). */
function Context({ g }: { g: ReturnType<typeof juego> }) {
  return (
    <div className="nx-ctl">
      <Radios label="De quién son las jugadas" opts={g.teams} style={{ minWidth: "min(100%,340px)" }} />
      <Radios label="Parte" opts={g.partes} style={{ minWidth: "min(100%,380px)" }} />
    </div>
  );
}

function Mesa({ p, g }: { p: JuegoProps; g: ReturnType<typeof juego> }) {
  const ms = mesa(p.v, p.act, filterLabel(p.v, p.st));
  return (
    <>
      <Context g={g} />
      <p className="nx-win__lead">{ms.lead}</p>
      <div className="nx-wsbar">
        <div className="nx-scrollx">
          <div className="vd-glass vd-seg nx-seg" role="group" aria-label="Vistas de la mesa" style={css({ "--n": ms.sets.length, "--i": Math.max(0, ms.sets.findIndex((o) => o.on)) })}>
            <span className="vd-shelf__bead" aria-hidden="true" />
            {ms.sets.map((o) => (
              <button key={o.key} type="button" className="vd-seg__b" aria-pressed={o.on} onClick={o.pick}>
                {o.t}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="vd-glass vd-press nx-btn" aria-haspopup="dialog" onClick={ms.dl} disabled={!ms.n}>
          <Ic name="download" />
          Descargar
        </button>
      </div>
      {ms.custom && (
        <div className="nx-colpick">
          <div>
            <label className="vd-glass nx-field" style={{ marginBottom: 10 }}>
              <Ic name="search" />
              <span className="nx-vh">Buscar columna</span>
              <input type="search" placeholder="Buscar columna" value={ms.q} onChange={(e) => ms.onQ(e.target.value)} />
            </label>
            <div className="nx-fams" role="group" aria-label="Familias">
              {ms.fams.map((f) => (
                <button key={f.key} type="button" className="nx-fambtn" aria-pressed={f.on} onClick={f.pick}>
                  <span>{f.t}</span>
                  <small>{f.n}</small>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="nx-sec__head nx-colpick__head">
              <p className="nx-sheet__p" role="status">
                {ms.colCount}
              </p>
              <span className="nx-links">
                <button type="button" className="nx-lnk" onClick={ms.reset}>
                  Volver al resumen
                </button>
                <button type="button" className="nx-lnk" onClick={ms.selectAll} disabled={!ms.availableCount}>
                  Todas las que tienen datos ({ms.availableCount})
                </button>
                <button type="button" className="nx-lnk" onClick={ms.clear} disabled={!ms.n}>
                  Quitar todas
                </button>
              </span>
            </div>
            <div className="nx-cbs" role="group" aria-label="Columnas">
              {ms.cols.map((c) => (
                <button key={c.key} type="button" className={`nx-cb ${c.cls}`.trim()} aria-pressed={c.on} onClick={c.pick} title={c.why}>
                  <span className="nx-cb__x" aria-hidden="true">
                    <Ic name="check" />
                  </span>
                  <span>
                    {c.t}
                    <small>{c.sub}</small>
                  </span>
                </button>
              ))}
            </div>
            {!ms.cols.length && <p className="nx-note">Ninguna columna con esas palabras en esta familia.</p>}
          </div>
        </div>
      )}
      <p className="nx-legend" style={{ marginBottom: 10 }}>
        <span>Subrayado de puntos: parcial, cuenta solo lo narrado</span>
        <span>«–»: sin dato registrado</span>
        <span>Pasa por una cifra para ver por qué</span>
      </p>
      {!ms.n ? (
        <p className="nx-note" role="status">
          No hay columnas elegidas: elige una vista rápida o márcalas en Personalizado.
        </p>
      ) : (
        <div className="nx-tscroll" tabIndex={0} role="region" aria-label="Tabla de la mesa, con desplazamiento lateral">
          <table className="nx-tbl">
            <caption className="nx-vh">Todos los números, a tu medida</caption>
            <thead>
              <tr>
                <th scope="col" className="nx-tbl__p">
                  Jugador
                </th>
                {ms.head.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.aria}>
                    <button type="button" className="nx-sort" aria-pressed={c.on} onClick={c.pick}>
                      {c.t}
                      <svg className="nx-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={c.ic} />
                      </svg>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ms.rows.map((r) => (
                <tr key={r.key} className={r.cls || undefined}>
                  <th scope="row" className="nx-tbl__p">
                    <span className="nx-tbl__who">
                      <PShirt n={r.n} />
                      {r.name}
                    </span>
                  </th>
                  {r.cells.map((c) => (
                    <td key={c.key} className={c.cls || undefined} title={c.why}>
                      {c.v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="nx-tbl__p">
                  {ms.totalLabel}
                </th>
                {ms.foot.map((c) => (
                  <td key={c.key} title={c.why}>
                    {c.v}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {ms.n > 0 && ms.noRows && <p className="nx-note">No hay jugadores identificados en esta selección; el total conserva las acciones del equipo.</p>}
      {ms.n > 0 && <p className="nx-note">El total se calcula sobre las jugadas de la selección: los porcentajes usan aciertos e intentos conjuntos. Las acciones sin autor cuentan en el equipo, sin asignarlas a un jugador.</p>}
    </>
  );
}

function Catalogo({ p, g }: { p: JuegoProps; g: ReturnType<typeof juego> }) {
  const ct = catalogo(p.v, p.st);
  const batchKey = [ct.q, ct.x, ct.fams.find((f) => f.on)?.key, ct.items.length].join(":");
  // (the next 24 load on their own near the end; «Ver 24 más» stays for whoever has no observer. Paused while a sheet
  // is open over it: a ficha opened from the cards must not load the next batch behind it)
  const sentinel = useProgressiveLoad(!ct.loading && !p.catalogLoad.error && ct.more && !p.st.sheet, batchKey, ct.showMore);
  if (ct.loading) return <Wait t="Cargando el catálogo…" fail={p.catalogLoad.error ? "No ha llegado el catálogo." : null} retry={p.catalogLoad.retry} />;
  return (
    <>
      <Context g={g} />
      <p className="nx-win__lead">Qué es cada estadística, en palabras sencillas, cuánto llevamos y qué tiene que narrar la mesa para contarla. Toca una para abrir su ficha.</p>
      <div className="nx-catbar">
        <label className="vd-glass nx-field">
          <Ic name="search" />
          <span className="nx-vh">Buscar estadística</span>
          <input type="search" placeholder="Busca: «pases», «remates», «presión»…" value={ct.q} onChange={(e) => ct.onQ(e.target.value)} />
        </label>
        <button type="button" className="nx-tog" aria-pressed={ct.x} onClick={ct.toggleX}>
          <span className="nx-tog__t" aria-hidden="true" />
          Incluir las que no se pueden narrar por audio
        </button>
      </div>
      <ul className="nx-chiprow nx-scrollx" aria-label="Familias del catálogo">
        {ct.fams.map((f) => (
          <li key={f.key}>
            <button type="button" className="vd-glass nx-pick" aria-pressed={f.on} onClick={f.pick}>
              {f.t} <small>{f.n}</small>
            </button>
          </li>
        ))}
      </ul>
      <p className="nx-legend" style={{ marginBottom: 12 }}>
        <span aria-live="polite">{ct.count}</span>
        <span>
          <i className="nx-st is-ok" />
          Completo
        </span>
        <span>
          <i className="nx-st is-part" />
          Parcial
        </span>
        <span>
          <i className="nx-st" />
          Sin dato
        </span>
      </p>
      <ul className="nx-catg" aria-label="Estadísticas del catálogo">
        {ct.items.map((c) => (
          <li key={c.key} style={{ display: "grid" }}>
            <button type="button" className="vd-glass vd-press nx-cc" aria-haspopup="dialog" onClick={c.open}>
              <span className="nx-cc__k">
                <span>{c.fam}</span>
                <span>{c.id}</span>
              </span>
              <span className="nx-cc__t">{c.t}</span>
              <span className="nx-cc__d">{c.def}</span>
              <span className="nx-cc__v">
                <i className={`nx-st ${c.cls}`.trim()} aria-hidden="true" />
                <b>{c.v}</b>
                {c.st}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div ref={sentinel}>
        {ct.more && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <button type="button" className="vd-glass vd-press nx-btn" onClick={ct.showMore}>
              {ct.moreT}
            </button>
          </div>
        )}
      </div>
      {ct.empty && <p className="nx-note">Ninguna estadística con esas palabras en esta familia.</p>}
    </>
  );
}

const WIN_T = { graficas: "Gráficas del juego", mesa: "Todos los números, a tu medida", catalogo: "Catálogo: una ficha para cada estadística" } as const;

export function Juego(p: JuegoProps) {
  const { v, st, act } = p;
  const g = juego(v, st, act);
  const win = st.grow === "graficas" || st.grow === "mesa" || st.grow === "catalogo" ? st.grow : null;
  if (win)
    return (
      <Win id="nx-win-h" title={WIN_T[win]} back="El juego" onClose={() => act.grow(null)}>
        {win === "graficas" ? (
          <>
            <Context g={g} />
            <StatsChartsPanel matches={v.analysis.matches} filters={v.analysis.filters} people={v.scope.people.map((x) => ({ id: x.key, name: x.t, number: x.n }))} onInspect={p.onInspect} loading={p.loading} />
          </>
        ) : win === "mesa" ? (
          <Mesa p={p} g={g} />
        ) : (
          <Catalogo p={p} g={g} />
        )}
      </Win>
    );
  return (
    <section aria-labelledby="nx-g-h">
      <header className="nx-head">
        <div className="nx-head__t">
          <p className="nx-kick">{g.kick}</p>
          <h2 className="nx-h2" id="nx-g-h">
            {g.title}
          </h2>
          <p className="nx-sub">{g.sub}</p>
        </div>
      </header>
      <Context g={g} />
      <div className="nx-jfil" role="group" aria-label="Jugadas de">
        <span className="nx-jfil__k" aria-hidden="true">
          Jugadas de
        </span>
        {g.who.map((o) => (
          <button key={o.key || "todos"} type="button" className="vd-glass nx-pick" aria-pressed={o.on} onClick={o.pick}>
            {o.hasN && <PShirt n={o.n} />}
            {o.t}
          </button>
        ))}
      </div>
      {g.locked && <p className="nx-note nx-note--top">{g.lockT}</p>}

      <section className="nx-sec nx-sec--first" aria-labelledby="nx-vist-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="nx-vist-h">
            De un vistazo
          </h3>
          <p className="nx-meta">Toca una cifra para ver su ficha</p>
        </div>
        <p className="nx-legend">
          <span>
            <i className="nx-st is-ok" />
            Completo: está narrado todo
          </span>
          <span>
            <i className="nx-st is-part" />
            Parcial: cuenta solo lo narrado
          </span>
          <span>
            <i className="nx-st" />
            Sin dato
          </span>
        </p>
        <div className="nx-fam3" role="list" aria-label="Indicadores de la selección">
          {g.fams.map((f) => (
            <div key={f.t} role="listitem">
              <p className="nx-fam__t">{f.t}</p>
              {f.tiles.map((x) => (
                <button key={x.id} type="button" className="nx-gt2" aria-haspopup="dialog" onClick={x.open} title={x.sub}>
                  <span className="nx-gt2__t">
                    <i className={`nx-st ${x.cls}`.trim()} role="img" aria-label={x.statusT} />
                    {x.t}
                  </span>
                  <span className="nx-gt2__v">{x.v}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="nx-sec" aria-labelledby="nx-more-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="nx-more-h">
            Más a fondo
          </h3>
          <p className="nx-meta">Cada una se abre aquí mismo, con los mismos filtros</p>
        </div>
        <div className="nx-ent">
          <button type="button" className="vd-glass vd-press nx-en" onClick={g.openGraf}>
            <span className="nx-en__i">
              <Ic name="net" />
            </span>
            <b>Gráficas del juego</b>
            <span className="nx-en__s">Red de pases, tramos y matriz, remates</span>
            <span className="nx-en__art" aria-hidden="true">
              <svg viewBox="0 0 120 56" preserveAspectRatio="none">
                <path className="nx-art" d="M14 40 Q40 10 62 28 T108 14 M14 40 Q60 52 96 44 M62 28 L96 44" />
                <circle className="nx-art--f" cx="14" cy="40" r="4" />
                <circle className="nx-art--f" cx="62" cy="28" r="5" />
                <circle className="nx-art--f" cx="108" cy="14" r="3.5" />
                <circle className="nx-art--f" cx="96" cy="44" r="4" />
              </svg>
            </span>
          </button>
          <button type="button" className="vd-glass vd-press nx-en" onClick={g.openMesa}>
            <span className="nx-en__i">
              <Ic name="table" />
            </span>
            <b>Todos los números, a tu medida</b>
            <span className="nx-en__s">{g.mesaT}</span>
            <span className="nx-en__art" aria-hidden="true">
              <svg viewBox="0 0 120 56" preserveAspectRatio="none">
                <rect className="nx-art--m" x="0" y="6" width="120" height="7" rx="3" />
                <rect className="nx-art--f" x="0" y="20" width="84" height="6" rx="3" />
                <rect className="nx-art--m" x="0" y="32" width="120" height="6" rx="3" />
                <rect className="nx-art--f" x="0" y="44" width="58" height="6" rx="3" />
              </svg>
            </span>
          </button>
          <button type="button" className="vd-glass vd-press nx-en" onClick={g.openCat}>
            <span className="nx-en__i">
              <Ic name="book" />
            </span>
            <b>{g.catT}</b>
            <span className="nx-en__s">{g.catS}</span>
            <span className="nx-en__art" aria-hidden="true">
              <svg viewBox="0 0 120 56" preserveAspectRatio="none">
                <rect className="nx-art" x="2" y="6" width="34" height="44" rx="6" />
                <rect className="nx-art" x="43" y="6" width="34" height="44" rx="6" />
                <rect className="nx-art" x="84" y="6" width="34" height="44" rx="6" />
                <rect className="nx-art--f" x="8" y="38" width="16" height="5" rx="2" />
                <rect className="nx-art--f" x="49" y="38" width="22" height="5" rx="2" />
                <rect className="nx-art--f" x="90" y="38" width="12" height="5" rx="2" />
              </svg>
            </span>
          </button>
          <button type="button" className="vd-glass vd-press nx-en" aria-haspopup="dialog" onClick={g.openExport}>
            <span className="nx-en__i">
              <Ic name="download" />
            </span>
            <b>Exportar la selección</b>
            <span className="nx-en__s">JSON o CSV, con los mismos filtros</span>
            <span className="nx-en__art" aria-hidden="true">
              <svg viewBox="0 0 120 56" preserveAspectRatio="none">
                <path className="nx-art" d="M60 4 V36 M46 24 L60 38 L74 24 M30 50 H90" />
              </svg>
            </span>
          </button>
        </div>
      </section>

      <div className="nx-cols">
        <section className="nx-sec" aria-labelledby="nx-clock-h">
          <div className="nx-sec__head">
            <h3 className="nx-h3" id="nx-clock-h">
              Cuándo caen los goles
            </h3>
          </div>
          <ul className="nx-clock" style={css({ "--n": g.slicesN })} aria-label="Goles por tramos de cinco minutos">
            {g.slices.map((c) => (
              <li key={c.key} className={`nx-clock__c ${c.cls}`.trim()} aria-label={c.label}>
                <i className="nx-clock__u" style={{ height: `${c.u}%` }} />
                <i className="nx-clock__t" style={{ height: `${c.t}%` }} />
              </li>
            ))}
          </ul>
          <div className="nx-axis" style={css({ "--n": g.slicesN })} aria-hidden="true">
            {g.slices.map((c) => (
              <span key={c.key}>{c.lab}</span>
            ))}
          </div>
          <p className="nx-key">
            <span>
              <i className="nx-sw nx-sw--us" />
              A favor, arriba
            </span>
            <span>
              <i className="nx-sw nx-sw--them" />
              Del rival, en contra, abajo
            </span>
          </p>
          <p className="nx-note">{g.clockCap}</p>
        </section>
        <section className="nx-sec" aria-labelledby="nx-pass-h">
          <div className="nx-sec__head">
            <h3 className="nx-h3" id="nx-pass-h">
              El pase
            </h3>
            <p className="nx-meta">{g.passMeta}</p>
          </div>
          <div className="nx-pass">
            <div className="nx-pass__bar" role="img" aria-label={g.passAria}>
              <i className="c" style={{ flex: g.pass.c }} />
              <i className="f" style={{ flex: g.pass.f }} />
              <i className="u" style={{ flex: g.pass.u }} />
            </div>
            <p className="nx-pass__k">
              <span>
                <b>{g.pass.c}</b> completados
              </span>
              <span>
                <b>{g.pass.f}</b> fallados
              </span>
              <span>
                <b>{g.pass.u}</b> sin resultado
              </span>
            </p>
          </div>
          <div className="nx-sec__head" style={{ marginTop: 26 }}>
            <h3 className="nx-h3" id="nx-conn-h">
              Quién conecta con quién
            </h3>
          </div>
          <ol className="nx-conn" aria-labelledby="nx-conn-h">
            {g.pairs.map((x) => (
              <li key={x.key} className="nx-conn__r">
                <span>{x.t}</span>
                <b>{x.n}</b>
                <span className="nx-conn__b" aria-hidden="true">
                  <i style={{ width: `${x.w}%` }} />
                </span>
              </li>
            ))}
          </ol>
          {g.noPairs && <p className="nx-note">Sin parejas con pases completados en esta selección.</p>}
        </section>
      </div>

      <section className="nx-sec" aria-labelledby="nx-tram-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="nx-tram-h">
            {g.tramT}
          </h3>
          <p className="nx-meta">{g.tramSub}</p>
        </div>
        <ul className="nx-tram" style={css({ "--n": g.tramN })} aria-label="Pases por tramo">
          {g.tramos.map((c) => (
            <li key={c.key} className="nx-tram__c" aria-label={c.label}>
              <i className="nx-tram__h" style={{ height: `${c.h}%` }}>
                <span className="nx-tram__v">{c.v}</span>
              </i>
              <i className="nx-tram__ok" style={{ height: `${c.ok}%` }} />
            </li>
          ))}
        </ul>
        <div className="nx-axis" style={css({ "--n": g.tramN })} aria-hidden="true">
          {g.tramos.map((c) => (
            <span key={c.key}>{c.lab}</span>
          ))}
        </div>
      </section>

      <section className="nx-sec" aria-labelledby="nx-cov-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="nx-cov-h">
            Qué está narrado
          </h3>
        </div>
        <dl className="nx-cov">
          <div>
            <dt>
              <i className="nx-st is-ok" />
              Completo
            </dt>
            <dd>{g.cov.ok}</dd>
          </div>
          <div>
            <dt>
              <i className="nx-st is-part" />
              Parcial
            </dt>
            <dd>{g.cov.part}</dd>
          </div>
          {g.cov.hasNone && (
            <div>
              <dt>
                <i className="nx-st" />
                Sin dato
              </dt>
              <dd>{g.cov.none}</dd>
            </div>
          )}
        </dl>
        {g.hasNote && (
          <details className="nx-det">
            <summary>Nota de la mesa</summary>
            <p>{g.note}</p>
          </details>
        )}
      </section>
    </section>
  );
}
