// «Números»: the six screens and what grows in place on them, the NU- boards' shell.html markup in JSX (same
// classes, same words); every value comes from view.ts.
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { NuView } from "./view";
import { I, Q, Shirt } from "./bits";
import { WorkspaceTable } from "./WorkspaceTable";
import { StatsChartsPanel } from "../../../components/celeste/StatsChartsPanel";

type V = NuView;
type NumOf = (id: string) => number | "";
const css = (o: Record<string, string | number>) => o as CSSProperties;

/** A segmented control (the boards' vd-seg with its sliding bead). */
function Seg({ label, opts, i, className, n }: { label: string; opts: { t: string; on: boolean; pick: () => void; lock?: boolean }[]; i: number; className?: string; n?: number }) {
  return (
    <div className={`vd-glass vd-seg${className ? ` ${className}` : ""}`} role="radiogroup" aria-label={label} style={css({ "--n": n ?? opts.length, "--i": i })}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.t} type="button" role="radio" className="vd-seg__b" aria-checked={o.on} onClick={o.pick}>
          {o.t}
          {o.lock && (
            <>
              <I name="lock" className="nu-i--sm" />
              <span className="vd-vh">, solo el equipo</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

const Tu = () => <i className="nu-tu">Tú</i>;

/** A link to another page or screen of the app through the router. */
export function A({ href, className, children, ariaLabel }: { href: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <Link to={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

function GrowWin({ id, title, onClose, table, children }: { id: string; title: string; onClose: () => void; table?: boolean; children: ReactNode }) {
  return (
    <section className={`vd-glass vd-glass--deep vd-grow nu-grow${table ? " nu-grow--table" : ""}`} aria-labelledby={id}>
      <header className="vd-grow__head">
        <h2 id={id} tabIndex={-1}>
          {title}
        </h2>
        <button type="button" className="vd-glass vd-grow__close vd-press" onClick={onClose}>
          <I name="close" />
          Cerrar
        </button>
      </header>
      <div className="vd-grow__body" tabIndex={0}>
        {children}
      </div>
    </section>
  );
}

// ===================== Temporada =====================
function TablaHead({ wide }: { wide?: boolean }) {
  return (
    <div className="nu-tbl__r nu-tbl__r--h" role="row">
      <span role="columnheader" className="p">
        <abbr title="Posición">#</abbr>
      </span>
      <span role="columnheader" className="t">
        Equipo
      </span>
      <span role="columnheader">
        <abbr title="Partidos jugados">PJ</abbr>
      </span>
      <span role="columnheader" className="w">
        <abbr title="Ganados">G</abbr>
      </span>
      <span role="columnheader" className="w">
        <abbr title="Empatados">E</abbr>
      </span>
      <span role="columnheader" className="w">
        <abbr title="Perdidos">P</abbr>
      </span>
      {wide && (
        <>
          <span role="columnheader" className="w">
            <abbr title="Goles a favor">GF</abbr>
          </span>
          <span role="columnheader" className="w">
            <abbr title="Goles en contra">GC</abbr>
          </span>
        </>
      )}
      <span role="columnheader">
        <abbr title="Diferencia de goles">DG</abbr>
      </span>
      <span role="columnheader">
        <abbr title="Puntos">Pts</abbr>
      </span>
    </div>
  );
}
type TR = V["tem"]["all"][number];
function TablaRow({ r, wide, plain }: { r: TR; wide?: boolean; plain?: boolean }) {
  return (
    <div className={`nu-tbl__r ${r.cls}`.trim()} role="row" aria-current={r.us || undefined}>
      <span role="cell" className="p">
        {r.pos}
      </span>
      <span role="cell" className="t">
        {r.team}
        {!plain && r.prov && (
          <>
            {" "}
            <span className="vd-provtag">Si acaba así</span>
          </>
        )}
      </span>
      <span role="cell">{r.pj}</span>
      <span role="cell" className="w">
        {r.g}
      </span>
      <span role="cell" className="w">
        {r.e}
      </span>
      <span role="cell" className="w">
        {r.p}
      </span>
      {wide && (
        <>
          <span role="cell" className="w">
            {r.gf}
          </span>
          <span role="cell" className="w">
            {r.gc}
          </span>
        </>
      )}
      <span role="cell">{r.dg}</span>
      <span role="cell" className="pts">
        {r.pts}
      </span>
    </div>
  );
}

function JourneyRow({ j, link }: { j: V["tem"]["journey"][number]; link?: boolean }) {
  const inner = (
    <>
      <span className="nu-journey__j">{j.j}</span>
      <span className={`vd-form__l ${j.cls} nu-journey__l`} aria-hidden="true">
        {j.l}
      </span>
      <span className="nu-journey__t">
        <b>{j.rival}</b>
        <small>
          {j.where}
          {j.res ? ` · ${j.res}` : ""}
        </small>
      </span>
      {!link && (
        <span className="nu-journey__bar" aria-hidden="true">
          <i style={{ width: `${j.w}%` }} />
        </span>
      )}
      <b className="nu-journey__p">
        {j.pts}
        <small>{j.unit}</small>
      </b>
    </>
  );
  return (
    <li className={(!link && j.at) || undefined}>
      {link ? (
        <A className="nu-journey__a" href={j.href}>
          {inner}
        </A>
      ) : (
        inner
      )}
    </li>
  );
}

export function Temporada({ v, grow, onClose }: { v: V; grow: boolean; onClose: () => void }) {
  const t = v.tem;
  if (grow)
    return (
      <GrowWin id="nu-g-tabla" title="La clasificación entera" onClose={onClose}>
        <p className="nu-grow__note">{t.n} equipos. La fila del Piti va con borde discontinuo mientras sea «si acaba así».</p>
        <div className="nu-tbl nu-tbl--grown" role="table" aria-label="La clasificación entera">
          <TablaHead />
          {t.all.map((r) => (
            <TablaRow key={r.key} r={r} plain />
          ))}
        </div>
      </GrowWin>
    );
  return (
    <div className="nu-tem">
      <div className="nu-reg nu-reg--table">
        {t.showTable && (
          <>
            <h3 className="nu-h3">
              {t.tableT} <Q label="Qué es la clasificación" onClick={t.i.tabla} />
            </h3>
            <p className="nu-regsub">{t.tableSub}</p>
            <div className="nu-tbl nu-tbl--focus" role="table" aria-label={t.tableT}>
              <TablaHead />
              {t.rows.map((r) =>
                r.gap ? (
                  <div key={r.key} className="nu-tbl__gap" role="row">
                    <span role="cell">{r.gapT}</span>
                  </div>
                ) : (
                  <TablaRow key={r.key} r={r} />
                ),
              )}
            </div>
            <div className="nu-tbl nu-tbl--all" role="table" aria-label={`${t.tableT}, entera`}>
              <TablaHead wide />
              {t.all.map((r) => (
                <TablaRow key={r.key} r={r} wide />
              ))}
            </div>
            {t.more && (
              <div className="nu-seeall">
                <p>{t.summary}</p>
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={t.openAll}>
                  <I name="expand" />
                  {t.seeAll}
                </button>
              </div>
            )}
            {t.champ && (
              <p className="nu-champ">
                <I name="trophy" />
                {t.champT}
              </p>
            )}
          </>
        )}
        {t.showJourney && (
          <>
            <h3 className="nu-h3">{t.journeyT}</h3>
            <p className="nu-regsub">{t.journeySub}</p>
            <ol className="nu-journey">
              {t.journey.map((j) => (
                <JourneyRow key={j.key} j={j} />
              ))}
            </ol>
          </>
        )}
        {t.noTable && (
          <>
            <h3 className="nu-h3">
              {t.calT} <Q label="Qué es la clasificación" onClick={t.i.tabla} />
            </h3>
            <p className="nu-regsub">{t.calSub}</p>
            <ol className="nu-journey nu-journey--cal">
              {t.calendar.map((j) => (
                <JourneyRow key={j.key} j={j} link />
              ))}
            </ol>
          </>
        )}
      </div>
      <div className="nu-tem__side">
        <div className="nu-reg nu-reg--form">
          {t.hasForm && (
            <>
              <h3 className="nu-h3">
                La forma <Q label="Qué es la forma" onClick={t.i.forma} />
              </h3>
              <ol className="vd-form nu-form" aria-label="La forma, de la más antigua a la de hoy">
                {t.form.map((f) => (
                  <li key={f.key} className={`vd-form__l ${f.cls}`} aria-label={f.label}>
                    <span aria-hidden="true">{f.l}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <h3 className="nu-h3">
            Los números del equipo <Q label="Qué son los números del equipo" onClick={t.i.kpis} />
          </h3>
          <ul className="nu-kpis">
            {t.kpis.map((k) => (
              <li key={k.t}>
                <b>{k.v}</b>
                <span>{k.t}</span>
                {k.s ? <small>{k.s}</small> : null}
              </li>
            ))}
          </ul>
          <p className="nu-mvpline">
            <I name="star" />
            {t.mvpLine}
          </p>
          {t.ysi && (
            <div className="nu-ysi-call">
              <h3 className="nu-h3">
                ¿Y si…? <Q label="Qué es ¿Y si…?" onClick={t.i.ysi} />
              </h3>
              <p>Pon resultados de mentira a lo que queda y mira la tabla moverse.</p>
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={t.openYsi} aria-haspopup="dialog">
                Probar resultados
              </button>
            </div>
          )}
          {t.ysiWait && (
            <div className="nu-ysi-call">
              <h3 className="nu-h3">¿Y si…?</h3>
              <p>Llega con la clasificación: con la tabla publicada podrás poner resultados de mentira a lo que queda y ver dónde acabaríamos.</p>
            </div>
          )}
        </div>
        <div className="nu-reg nu-reg--race">
          <div className="nu-race__head">
            <h3 className="nu-h3">
              La carrera del Pichichi <Q label="Qué es la carrera del Pichichi" onClick={t.i.carrera} />
            </h3>
            <Seg label="Qué carrera ver" opts={t.raceOpts} i={t.raceI} className="nu-race__seg" n={3} />
          </div>
          <p className="vd-vh" aria-live="polite">
            {t.raceSR}
          </p>
          <ol className="nu-race__rows" aria-hidden="true" style={css({ "--rows": t.raceRows })}>
            {t.race.map((r) => (
              <li key={r.key} className={`nu-race__row ${r.cls}`.trim()} style={css({ "--i": r.i })}>
                <span className="nu-race__rk">{r.rank}</span>
                <span className="nu-race__n">{r.n}</span>
                <button type="button" className="nu-race__name" onClick={r.pick} tabIndex={-1}>
                  {r.name}
                  {r.you && <Tu />}
                </button>
                <span className="nu-race__bar">
                  <i style={{ width: `${r.w}%` }} />
                </span>
                <b className="nu-race__v">{r.val}</b>
              </li>
            ))}
          </ol>
          <p className="nu-race__cap">
            <b>{t.raceCap}</b>
            <span>{t.raceSub}</span>
          </p>
          {t.hasSaid && (
            <div className="nu-said">
              <h3 className="nu-h3">
                Lo que dicen los números <Q label="Qué es esto" onClick={t.i.dicen} />
              </h3>
              <ul>
                {t.said.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {t.hasRecent && (
            <div className="nu-recent">
              <h3 className="nu-h3">Las últimas jornadas</h3>
              <ol className="nu-journey">
                {t.recent.map((j) => (
                  <JourneyRow key={j.key} j={j} />
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== Jugadores =====================
function Stints({ st }: { st: { l: string; w: string }[] }) {
  return (
    <span className="nu-stints__bar" aria-hidden="true">
      {st.map((s, k) => (
        <i key={k} style={{ left: `${s.l}%`, width: `${s.w}%` }} />
      ))}
    </span>
  );
}

type Card = NonNullable<V["pl"]>;
/** The card's numbers: the five tiles, his stints in the last acta, the rates. */
export function CardNumbers({ c }: { c: Card }) {
  return (
    <>
      <ul className="nu-card__tiles">
        {c.tiles.map((t) => (
          <li key={t.t} className={t.gold || undefined}>
            <b>{t.v}</b>
            <span>{t.t}</span>
          </li>
        ))}
      </ul>
      {c.hasStints && (
        <div className="nu-card__stints">
          <p>{c.stintT}</p>
          <Stints st={c.stints} />
        </div>
      )}
      <dl className="nu-dl">
        {c.rates.map((r) => (
          <div key={r.t}>
            <dt>{r.t}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export function PlayerCard({ c, numOf }: { c: Card; numOf: NumOf }) {
  return (
    <aside className="nu-reg nu-reg--card nu-card" aria-label={`${c.name}, sus números`}>
      <Shirt className="nu-card__shirt" num={numOf(c.id)} alt={c.alt} />
      <div className="nu-card__who">
        <h3 className="nu-card__name">
          {c.name}
          {c.you && <Tu />}
        </h3>
        {c.full && <p>{c.full}</p>}
        <p>{[c.pos, c.scopeT].filter(Boolean).join(" · ")}</p>
      </div>
      <CardNumbers c={c} />
      <p className="nu-card__heatT">Sus últimas jornadas</p>
      <ol className="nu-heat nu-heat--card" aria-label="Sus últimas jornadas">
        {c.heat.map((h) => (
          <li key={h.key} className={h.cls || undefined} aria-label={h.label}>
            <i>{h.g}</i>
            <small>{h.j}</small>
          </li>
        ))}
      </ol>
      <div className="nu-card__btns">
        <A className="vd-glass vd-press vd-btn vd-btn--sm vd-btn--pri" href={c.href}>
          Su ficha
        </A>
        <A className="vd-glass vd-press vd-btn vd-btn--sm" href={c.duel}>
          Cara a cara con…
        </A>
      </div>
    </aside>
  );
}

export function Jugadores({ v, grow, onClose, numOf }: { v: V; grow: boolean; onClose: () => void; numOf: NumOf }) {
  const j = v.jug;
  const g = v.gj;
  if (grow)
    return (
      <GrowWin id="nu-g-jug" title="Todos los jugadores" onClose={onClose} table>
        <p className="nu-grow__note">{g.count}. «Últimas»: más intenso, de titular; el número, sus goles.</p>
        <div className="nu-tools">
          <label className="nu-field">
            <span className="vd-vh">Buscar jugador</span>
            <input className="vd-input" type="search" value={g.q} onChange={(e) => g.setQ(e.target.value)} placeholder="Buscar jugador o dorsal" />
          </label>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={g.csv}>
            <I name="arrow" />
            Exportar CSV
          </button>
        </div>
        <Seg label="Qué columnas ver" opts={g.sets} i={g.setI} className="nu-colseg" n={5} />
        <p className="nu-swipe" aria-hidden="true">
          Desliza para ver más columnas →
        </p>
        <div className="nu-scroll" tabIndex={0} role="region" aria-label="Tabla con desplazamiento lateral">
          <div className="nu-pt" role="table" aria-label="Todos los jugadores" style={css({ "--n": g.n })}>
            <div className="nu-pt__r nu-pt__r--h" role="row">
              <span role="columnheader" className="t">
                Jugador
              </span>
              {g.cols.map((c) => (
                <span key={c.key} role="columnheader" aria-sort={c.sort}>
                  <button type="button" className="nu-sort" onClick={c.pick} aria-pressed={c.on} title={`Ordenar por ${c.t}`}>
                    {c.t}
                  </button>
                </span>
              ))}
              <span role="columnheader" className="h">
                Últimas
              </span>
            </div>
            {g.rows.map((r) => (
              <div key={r.key} className={`nu-pt__r ${r.cls}`.trim()} role="row">
                <span role="cell" className="t">
                  <button type="button" className="nu-pt__name" onClick={r.pick}>
                    <i>{r.n}</i>
                    {r.name}
                    {r.you && <em className="nu-tu">Tú</em>}
                  </button>
                </span>
                {r.cells.map((x) => (
                  <span key={x.key} role="cell">
                    {x.v}
                  </span>
                ))}
                <span role="cell" className="h">
                  <span className="nu-heat">
                    {r.heat.map((h) => (
                      <i key={h.key} className={h.cls || undefined} title={h.label}>
                        {h.g}
                      </i>
                    ))}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {g.empty && <p className="nu-empty">Ningún jugador coincide con la búsqueda.</p>}
      </GrowWin>
    );
  return (
    <>
      <div className="nu-pickrow">
        <Seg label="Ranking por" opts={j.metrics} i={j.metricI} className={`nu-seg5 ${j.otherCls}`.trim()} n={5} />
        <button type="button" className="vd-glass vd-press nu-allbtn" onClick={j.toggleAll} aria-expanded={j.allOpen}>
          <I name="chart" />
          <span>{j.otherT}</span>
          <I name="chev-r" className="nu-allbtn__chev" />
        </button>
        <Q label="Qué cuenta esta estadística" onClick={j.info} />
      </div>
      {j.allOpen && (
        <div className="nu-allstats" role="group" aria-label="Todas las estadísticas de jugadores">
          {j.groups.map((gr) => (
            <div key={gr.t} className="nu-allstats__g">
              <p>{gr.t}</p>
              <ul>
                {gr.items.map((m) => (
                  <li key={m.key}>
                    <button type="button" className={`nu-chip nu-chip--stat ${m.dim}`.trim()} aria-pressed={m.on} onClick={m.pick}>
                      {m.t}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="nu-jug">
        <div className="nu-reg nu-reg--rank">
          {j.porraEmpty && <p className="nu-empty">{j.porraEmpty}</p>}
          {j.locked && (
            <div className="nu-door">
              <I name="lock" />
              <div>
                <b>La porra es del vestuario</b>
                <p>La clasificación de la porra solo la ve el equipo. Si eres del Piti, entra y sale aquí. Mientras, el resto de rankings es para todos.</p>
                <A className="vd-glass vd-press vd-btn vd-btn--sm" href="/vestuario">
                  Entrar al vestuario
                </A>
              </div>
            </div>
          )}
          {j.podium.length > 0 && (
            <ol className="nu-podium" aria-label="Los primeros">
              {j.podium.map((r) => (
                <li key={r.key}>
                  <button type="button" className={`nu-podium__b ${r.cls}`.trim()} onClick={r.pick}>
                    {r.hasImg && <Shirt className="nu-podium__shirt" num={numOf(r.id)} alt={r.alt} />}
                    <span className="nu-podium__rk">{r.rank}º</span>
                    <b className="nu-podium__v">{r.val}</b>
                    <span className="nu-podium__name">
                      {r.name}
                      {r.you && <Tu />}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {j.onlyOne && <p className="nu-regsub">{j.onlyOne}</p>}
          <ol className="nu-rank">
            {j.rest.map((r) => (
              <li key={r.key}>
                <button type="button" className={`nu-rank__b ${r.cls}`.trim()} onClick={r.pick}>
                  <span className="nu-rank__rk">{r.rank}</span>
                  <span className={`nu-rank__n ${r.nCls}`.trim()}>{r.n}</span>
                  <span className="nu-rank__name">
                    {r.name}
                    {r.you && <Tu />}
                  </span>
                  <span className="nu-rank__bar">
                    <i style={{ width: `${r.w}%` }} />
                  </span>
                  <b>{r.val}</b>
                </button>
              </li>
            ))}
          </ol>
          {j.meLine && <p className="nu-me">{j.meLine}</p>}
          {j.voteOpen && (
            <p className="nu-mvpline">
              <I name="star" />
              {j.voteOpen}
            </p>
          )}
          {j.hasMvp && (
            <p className="nu-mvps">
              <b>Los MVP, jornada a jornada:</b>{" "}
              {j.mvpList.map((m) => (
                <span key={m.key} className="nu-mvpchip">
                  {m.j} <b>{m.name}</b>
                </span>
              ))}
            </p>
          )}
          <div className="nu-acts">
            {j.more > 0 && (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={j.openAll}>
                <I name="expand" />
                {j.moreT}
              </button>
            )}
            <A className="vd-link nu-acts__l" href="/plantilla/cara-a-cara">
              Comparar dos jugadores, en Plantilla
            </A>
          </div>
          {j.showStints && (
            <div className="nu-stints">
              <h3 className="nu-h3">
                {j.stintT} <Q label="Cómo leer los tramos" onClick={j.infoTramos} />
              </h3>
              <div className="nu-stints__scale" aria-hidden="true">
                <span>0′</span>
                <span>Descanso</span>
                <span>50′</span>
              </div>
              <ul>
                {j.stintRows.map((r) => (
                  <li key={r.key} className={r.cls || undefined} aria-label={r.label}>
                    <span className="nu-stints__n">
                      {r.name}
                      {r.you && <Tu />}
                    </span>
                    <Stints st={r.st} />
                    <b>{r.min}′</b>
                  </li>
                ))}
              </ul>
              {j.stintNote && <p className="nu-regsub">{j.stintNote}</p>}
            </div>
          )}
          {j.noStints && <p className="nu-regsub nu-stints__none">{j.noStints}</p>}
        </div>
        {j.showCard && <PlayerCard c={j.card} numOf={numOf} />}
      </div>
    </>
  );
}

// ===================== El campo =====================
export function Campo({ v, numOf }: { v: V; numOf: NumOf }) {
  const c = v.campo;
  return (
    <>
      <div className="nu-pickrow">
        <Seg label="Qué ver en el campo" opts={c.views} i={c.viewI} className="nu-seg3" n={3} />
      </div>
      {c.isPases && (
        <div className="nu-campo">
          <div className="nu-reg nu-reg--pitch">
            <h3 className="nu-h3">
              El cielo de la temporada <Q label="Cómo leer el cielo" onClick={c.i.pases} />
            </h3>
            <div className="nu-sky" role="group" aria-label="El campo: los jugadores como estrellas, unidos por sus pases de gol">
              <svg className="nu-sky__lines" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect className="nu-sky__pitch" x="1" y="1" width="298" height="138" rx="8" />
                <line className="nu-sky__mid" x1="150" y1="1" x2="150" y2="139" />
                <circle className="nu-sky__mid" cx="150" cy="70" r="18" />
                <rect className="nu-sky__mid" x="1" y="40" width="26" height="60" />
                <rect className="nu-sky__mid" x="273" y="40" width="26" height="60" />
                {c.arcs.d1 && <path className="nu-sky__arc nu-sky__arc--1" d={c.arcs.d1} />}
                {c.arcs.d2 && <path className="nu-sky__arc nu-sky__arc--2" d={c.arcs.d2} />}
                {c.arcs.d3 && <path className="nu-sky__arc nu-sky__arc--3" d={c.arcs.d3} />}
                {c.arcs.dSel && <path className="nu-sky__arc nu-sky__arc--sel" d={c.arcs.dSel} />}
              </svg>
              {c.stars.map((s) => (
                <button key={s.key} type="button" className={`nu-star ${s.cls}`.trim()} style={css({ left: `${s.left}%`, top: `${s.top}%`, "--s": `${s.size}px` })} onClick={s.pick} aria-label={s.label} aria-pressed={s.cls.includes("is-sel")}>
                  <i aria-hidden="true" />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
            <p className="nu-regsub nu-sky__note">Atacamos hacia la derecha. Toca una estrella para seguir sus pases.</p>
          </div>
          <aside className="nu-reg nu-reg--side nu-starcard" aria-live="polite">
            <div className="nu-starcard__top">
              <Shirt className="nu-starcard__shirt" num={numOf(c.star.id)} alt={c.star.alt} />
              <div>
                <h3 className="nu-h3">{c.star.name}</h3>
                <p className="nu-regsub">{c.star.line}</p>
              </div>
            </div>
            <h4 className="nu-h4">Le asisten</h4>
            <ul className="nu-links">
              {c.star.gives.map((l) => (
                <li key={l.key}>
                  <span>{l.t}</span>
                  <b>{l.n}</b>
                </li>
              ))}
            </ul>
            {c.star.noGives && <p className="nu-empty">Nadie le ha asistido aún.</p>}
            <h4 className="nu-h4">Asiste a</h4>
            <ul className="nu-links">
              {c.star.takes.map((l) => (
                <li key={l.key}>
                  <span>{l.t}</span>
                  <b>{l.n}</b>
                </li>
              ))}
            </ul>
            {c.star.noTakes && <p className="nu-empty">Aún no ha dado un pase de gol.</p>}
            <div className="nu-acts">
              <button type="button" className="vd-link" onClick={c.star.open}>
                Sus números
              </button>
              {c.star.selected && (
                <button type="button" className="vd-link" onClick={c.star.clear}>
                  Ver todas las líneas
                </button>
              )}
            </div>
            {c.hasTop && (
              <>
                <h4 className="nu-h4">Las conexiones de la temporada</h4>
                <ol className="nu-conn">
                  {c.top.map((l) => (
                    <li key={l.key}>
                      <span>{l.t}</span>
                      <span className="nu-conn__bar" aria-hidden="true">
                        <i style={{ width: `${l.w}%` }} />
                      </span>
                      <b>{l.n}</b>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>
      )}
      {c.isPuestos && (
        <div className="nu-campo">
          <div className="nu-reg nu-reg--pitch">
            <h3 className="nu-h3">
              De quién es cada puesto <Q label="Cómo leer los puestos" onClick={c.i.puestos} />
            </h3>
            <div className="vd-pitch nu-pitch" role="group" aria-label="El campo: los puestos con sus minutos y su dueño">
              <svg className="vd-pitch__lines" viewBox="0 0 100 112" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="1" y="1" width="98" height="110" rx="3" />
                <line x1="1" y1="56" x2="99" y2="56" />
                <circle cx="50" cy="56" r="11" />
                <rect x="28" y="1" width="44" height="16" />
                <rect x="28" y="95" width="44" height="16" />
              </svg>
              {c.spots.map((s) => (
                <button key={s.key} type="button" className={`nu-spot ${s.cls}`.trim()} style={{ left: `${s.x}%`, top: `${s.y}%` }} aria-pressed={s.on} onClick={s.pick} aria-label={s.label}>
                  <b>{s.code}</b>
                  <span>{s.owner}</span>
                </button>
              ))}
            </div>
            {c.unused && <p className="nu-regsub nu-sky__note">{c.unused}</p>}
          </div>
          <aside className="nu-reg nu-reg--side">
            {c.spot && !c.spot.empty ? (
              <>
                <div className="nu-starcard__top">
                  {c.spotImg && <Shirt className="nu-starcard__shirt" num={numOf(c.spotImg)} alt={c.spotAlt} />}
                  <div>
                    <h3 className="nu-h3">
                      {c.spot.name} ({c.spot.code})
                    </h3>
                    <p className="nu-regsub">
                      {c.spotLine} · dueño {c.spot.owner}
                    </p>
                  </div>
                </div>
                <h4 className="nu-h4">Quién ha jugado ahí</h4>
                <ul className="nu-links">
                  {c.spotWho.map((w) => (
                    <li key={w.key}>
                      <span>{w.t}</span>
                      <b>{w.v}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="nu-empty">{c.sub}</p>
            )}
            {c.spotRows.length > 0 && (
              <div className="nu-ptab" role="table" aria-label="Minutos por posición">
                <div className="nu-ptab__r nu-ptab__r--h" role="row">
                  <span role="columnheader">Puesto</span>
                  <span role="columnheader">Dueño</span>
                  <span role="columnheader">Min</span>
                </div>
                {c.spotRows.map((r) => (
                  <div key={r.key} className={`nu-ptab__r ${r.cls}`.trim()} role="row">
                    <span role="cell">
                      <button type="button" className="nu-ptab__b" onClick={r.pick}>
                        <b>{r.code}</b> {r.name}
                      </button>
                    </span>
                    <span role="cell">{r.owner}</span>
                    <span role="cell">{r.min}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
      {c.isSistemas && (
        <div className="nu-reg nu-sys">
          <h3 className="nu-h3">El récord de cada sistema</h3>
          {c.sysRows.map((s) => (
            <p key={s.key} className="nu-sys__row">
              <b>{s.label}</b>
              <span>
                {s.pj} PJ · {s.rec} · {s.gfga}
              </span>
              <em>{s.ppg} pts/partido</em>
            </p>
          ))}
          <p className="nu-regsub">
            El sistema sale de la pizarra que el capitán publica antes de cada partido. Victoria 3 puntos, empate 1.
            {c.sysOff > 0 && ` ${c.sysOff} ${c.sysOff === 1 ? "partido sin pizarra oficial no cuenta" : "partidos sin pizarra oficial no cuentan"} aquí.`}
          </p>
        </div>
      )}
    </>
  );
}

// ===================== El juego =====================
export function Juego({ v, grow, onClose, onInspect }: { v: V; grow: "mesa" | "catalogo" | "graficas" | null; onClose: () => void; onInspect?: (metricId: string, playerId?: string) => void }) {
  const g = v.juego;
  const context = <div className="nu-ctx" role="group" aria-label="Contexto de las jugadas"><Seg label="Equipo" opts={g.teamOpts} i={g.teamI} n={2} /><Seg label="Parte" opts={g.parteOpts} i={g.parteI} n={3} /></div>;
  if (grow === "mesa") return <GrowWin id="nu-g-mesa" title="Todos los números, a tu medida" onClose={onClose} table>{context}<WorkspaceTable w={v.ws} /></GrowWin>;
  if (grow === "graficas") return <GrowWin id="nu-g-graficas" title="Gráficas del juego" onClose={onClose}>{context}<StatsChartsPanel matches={v.analysis.matches} filters={v.analysis.filters} people={v.scope.people.map(p => ({id:p.key, name:p.t, number:p.n}))} onInspect={onInspect} /></GrowWin>;
  if (grow === "catalogo") {
    const c = v.cat;
    return (
      <GrowWin id="nu-g-cat" title="Una ficha para cada estadística" onClose={onClose}>
          {context}
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
        <ul className="nu-cat">
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
        {c.more && (
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={c.showMore}>
            {c.moreT}
          </button>
        )}
      </GrowWin>
    );
  }
  return (
    <>
      <div className="nu-ctx" role="group" aria-label="Contexto de las jugadas">
        <Seg label="Equipo" opts={g.teamOpts} i={g.teamI} n={2} />
        <Seg label="Parte" opts={g.parteOpts} i={g.parteI} n={3} />
      </div>
      <div className="nu-juego">
        <div className="nu-reg nu-reg--vistazo">
          <h3 className="nu-h3">
            De un vistazo <Q label="Qué es De un vistazo" onClick={g.i.vistazo} />
          </h3>
          <ul className="nu-figs" aria-label="Indicadores de la selección">
            {g.tiles.map((t) => (
              <li key={t.key}>
                <button type="button" className={`nu-fig ${t.cls}`} onClick={t.pick} aria-haspopup="dialog">
                  <b className="nu-fig__v">{t.v}</b>
                  <span className="nu-fig__t">{t.t}</span>
                  <span className="nu-fig__st">{t.statusT}</span>
                  <small>{t.sub}</small>
                </button>
              </li>
            ))}
          </ul>
          <p className="nu-regsub nu-legend">
            <button type="button" className="nu-q nu-q--txt" onClick={g.i.estados}>
              Cómo leer «Completo», «Parcial» y «–»
            </button>
          </p>
          {g.hasTech && (
            <div className="nu-cov">
              <h3 className="nu-h3">
                Qué está narrado <Q label="Qué es la cobertura" onClick={g.i.cobertura} />
              </h3>
              <dl className="nu-dl">
                <div>
                  <dt>
                    <span className="nu-dot nu-dot--ok" />
                    Completo
                  </dt>
                  <dd>{g.cov.ok}</dd>
                </div>
                <div>
                  <dt>
                    <span className="nu-dot nu-dot--part" />
                    Parcial
                  </dt>
                  <dd>{g.cov.part}</dd>
                </div>
                {g.cov.hasNone && (
                  <div>
                    <dt>
                      <span className="nu-dot" />
                      Sin información
                    </dt>
                    <dd>{g.cov.none}</dd>
                  </div>
                )}
              </dl>
              {g.note && <p className="nu-regsub nu-cov__note">Nota de la mesa: {g.note}</p>}
            </div>
          )}
        </div>
        <div className="nu-reg nu-reg--clock">
          <div className="nu-race__head">
            <h3 className="nu-h3">
              Cuándo caen los goles <Q label="Cómo leer el reloj de goles" onClick={g.i.reloj} />
            </h3>
            <Seg label="Qué goles ver" opts={g.clockOpts} i={g.clockI} className="nu-race__seg" n={3} />
          </div>
          <div className="nu-clock" role="group" aria-label="Goles por tramo de 5 minutos: arriba los nuestros, abajo los del rival">
            {g.slices.map((s) => (
              <span key={s.key} className={`nu-clock__s ${s.cls}`.trim()} role="img" aria-label={s.label}>
                <i className="nu-clock__u" style={{ height: `${s.u}%` }} />
                <i className="nu-clock__t" style={{ height: `${s.t}%` }} />
                <em>{s.lab}</em>
              </span>
            ))}
          </div>
          <p className="nu-keys">
            <span className="nu-key nu-key--us">a favor</span>
            <span className="nu-key nu-key--them">del rival, en contra</span>
            <span>descanso al 25′</span>
          </p>
          <p className="nu-regsub">{g.clockCap}</p>
          {g.hasTech && (
            <>
              <h3 className="nu-h3 nu-h3--gap">{g.tramT}</h3>
              <p className="nu-regsub">{g.tramSub}</p>
              <div className="nu-tram" role="group" aria-label={g.tramT}>
                {g.tramos.map((t) => (
                  <span key={t.key} className="nu-tram__s" role="img" aria-label={t.label}>
                    <i className="nu-tram__a" style={{ height: `${t.h}%` }} />
                    <i className="nu-tram__b" style={{ height: `${t.ok}%` }} />
                    <b>{t.v}</b>
                    <em>{t.lab}</em>
                  </span>
                ))}
              </div>
              {g.hasPairs && (
                <>
                  <h3 className="nu-h3 nu-h3--gap">
                    Quién conecta con quién <Q label="Qué es quién conecta con quién" onClick={g.i.tramos} />
                  </h3>
                  <ol className="nu-conn">
                    {g.pairs.map((l) => (
                      <li key={l.key}>
                        <span>{l.t}</span>
                        <span className="nu-conn__bar" aria-hidden="true">
                          <i style={{ width: `${l.w}%` }} />
                        </span>
                        <b>{l.n}</b>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
          <div className="nu-grows">
            <button type="button" className="vd-glass vd-press nu-growbtn" onClick={g.openCharts}><b>Gráficas del juego</b><span>Red de pases, matriz entre jugadores, tramos y remates</span><I name="expand" /></button>
            <button type="button" className="vd-glass vd-press nu-growbtn" onClick={g.openMesa}>
              <b>Todos los números, a tu medida</b>
              <span>Vistas rápidas y Personalizado: elegir columnas, ordenar y descargar</span>
              <I name="expand" />
            </button>
            <button type="button" className="vd-glass vd-press nu-growbtn" onClick={g.openCat}>
              <b>Catálogo de estadísticas · 412</b>
              <span>Una ficha para cada estadística en palabras sencillas, en 26 familias</span>
              <I name="expand" />
            </button>
            <button type="button" className="vd-link nu-acts__l" onClick={g.exportJson}>
              Exportar la selección en JSON
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ===================== Rivales =====================
type RivRow = V["rivales"]["rows"][number];
function RivalButton({ r, sheet }: { r: RivRow; sheet?: boolean }) {
  return (
    <button type="button" className={`nu-rivb ${sheet ? "" : r.cls}`.trim()} onClick={r.pick} aria-pressed={sheet ? undefined : r.on} aria-haspopup={sheet ? "dialog" : undefined}>
      <span className="vd-team__crest vd-team__crest--rival nu-rivb__crest" aria-hidden="true">
        {r.ini}
      </span>
      <span className="nu-rivb__t">
        <b>{r.rival}</b>
        <small>{r.rec}</small>
      </span>
      <ol className="vd-form nu-rivb__form" aria-hidden="true">
        {r.letters.map((f) => (
          <li key={f.key} className={`vd-form__l ${f.cls}`}>
            <span>{f.l}</span>
          </li>
        ))}
      </ol>
      {r.live && <span className="vd-live nu-rivb__n">Esta noche, en directo</span>}
      {r.next && <span className="nu-rivb__n">{r.next}</span>}
    </button>
  );
}
export function RivalGames({ d }: { d: NonNullable<V["rv"]> }) {
  return (
    <ul className="nu-rvg">
      {d.games.map((m) => (
        <li key={m.key}>
          <A className="nu-rvg__a" href={m.href}>
            <span className="nu-rvg__j">{m.j}</span>
            <b className={`nu-rvg__res ${m.cls}`}>{m.res}</b>
            <span className="nu-rvg__t">
              <em>
                {m.day} · {m.where}
                {m.live && (
                  <>
                    {" · "}
                    <span className="vd-live">En directo, si acaba así</span>
                  </>
                )}
              </em>
              <small>{m.who}</small>
            </span>
            <I name="chev-r" />
          </A>
        </li>
      ))}
    </ul>
  );
}
export function RivalFacts({ d }: { d: NonNullable<V["rv"]> }) {
  return (
    <dl className="nu-dl">
      <div>
        <dt>Nuestros goleadores</dt>
        <dd>{d.scorers}</dd>
      </div>
      <div>
        <dt>Mayor victoria</dt>
        <dd>{d.big}</dd>
      </div>
      <div>
        <dt>La primera vez</dt>
        <dd>{d.first}</dd>
      </div>
      <div>
        <dt>Lo siguiente</dt>
        <dd>{d.next}</dd>
      </div>
    </dl>
  );
}

export function Rivales({ v, grow, onClose }: { v: V; grow: boolean; onClose: () => void }) {
  const r = v.rivales;
  if (grow)
    return (
      <GrowWin id="nu-g-riv" title="Todos los rivales" onClose={onClose}>
        <p className="nu-grow__note">{r.n} rivales en la liga. Primero, el de esta noche.</p>
        <ul className="nu-rivs">
          {r.rows.map((x) => (
            <li key={x.key}>
              <RivalButton r={{ ...x, live: false }} sheet />
            </li>
          ))}
        </ul>
      </GrowWin>
    );
  return (
    <div className="nu-riv">
      <div className="nu-reg nu-reg--list">
        <label className="nu-field nu-field--search">
          <span className="vd-vh">Buscar rival</span>
          <input className="vd-input" type="search" value={r.q} onChange={(e) => r.setQ(e.target.value)} placeholder="Buscar rival" />
        </label>
        <ul className="nu-rivs nu-rivs--wide">
          {r.rows.map((x) => (
            <li key={x.key}>
              <RivalButton r={x} />
            </li>
          ))}
        </ul>
        <ul className="nu-rivs nu-rivs--phone">
          {r.phoneRows.map((x) => (
            <li key={x.key}>
              <RivalButton r={x} sheet />
            </li>
          ))}
        </ul>
        {r.empty && <p className="nu-empty">Ningún rival coincide con la búsqueda.</p>}
        {r.more > 0 && (
          <div className="nu-acts nu-acts--phone">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={r.openAll}>
              <I name="expand" />
              {r.moreT}
            </button>
          </div>
        )}
      </div>
      <aside className="nu-reg nu-reg--side nu-dossier" aria-label={`${r.d.rival}, el cara a cara`}>
        <div className="nu-dossier__top">
          <span className="vd-team__crest vd-team__crest--rival nu-dossier__crest" aria-hidden="true">
            {r.d.ini}
          </span>
          <div>
            <h3 className="nu-h3">{r.d.rival}</h3>
            <p className="nu-regsub">{r.d.rec}</p>
          </div>
        </div>
        <RivalGames d={r.d} />
        {r.d.noGames && <p className="nu-empty">Aún no hemos jugado contra ellos en este período.</p>}
        <RivalFacts d={r.d} />
      </aside>
    </div>
  );
}

// ===================== Récords =====================
export function Records({ v, numOf }: { v: V; numOf: NumOf }) {
  const r = v.records;
  return (
    <>
      <div className="nu-pickrow">
        <Seg label="Qué récords ver" opts={r.views} i={r.viewI} className="nu-seg4" n={4} />
      </div>
      {r.isRachas && (
        <div className="nu-two">
          <div className="nu-reg">
            <h3 className="nu-h3">
              El equipo <Q label="Qué son las rachas" onClick={r.i.rachas} />
            </h3>
            <ul className="nu-streaks">
              {r.team.map((s) => (
                <li key={s.key}>
                  <b>{s.best}</b>
                  <span>
                    <em>{s.t}</em>
                    <small>{s.line}</small>
                  </span>
                  {s.live && <span className="vd-provtag">Viva</span>}
                </li>
              ))}
            </ul>
            <h3 className="nu-h3 nu-h3--gap">Próximos hitos de gol</h3>
            <ul className="nu-hitos">
              {r.hitos.map((h) => (
                <li key={h.key}>
                  <span>{h.name}</span>
                  <span className="nu-hitos__bar">
                    <i style={{ width: `${h.w}%` }} />
                  </span>
                  <b>
                    {h.g} / {h.step}
                  </b>
                  <small>{h.t}</small>
                </li>
              ))}
            </ul>
          </div>
          <div className="nu-reg">
            <h3 className="nu-h3">Los jugadores</h3>
            <Seg label="Tipo de racha" opts={r.streakOpts} i={r.streakI} className="nu-seg5s" n={5} />
            <p className="nu-regsub">{r.streakSub}</p>
            <ol className="nu-plist">
              {r.players.map((p) => (
                <li key={p.key}>
                  <span>
                    {p.name}
                    {p.live && (
                      <>
                        {" "}
                        <span className="vd-provtag">Viva</span>
                      </>
                    )}
                  </span>
                  <small>
                    {p.range} · ahora {p.cur}
                  </small>
                  <b>{p.best}</b>
                </li>
              ))}
            </ol>
            {r.noPlayers && <p className="nu-empty">Nadie lleva todavía esta racha: la primera aparecerá aquí.</p>}
          </div>
        </div>
      )}
      {r.isMarcas && (
        <div className="nu-two">
          <div className="nu-reg">
            <h3 className="nu-h3">
              El equipo <Q label="Qué son las marcas" onClick={r.i.marcas} />
            </h3>
            <ul className="nu-marks">
              {r.teamRec.map((x) => {
                const inner = (
                  <>
                    <span className="nu-mark__t">{x.t}</span>
                    <b className="nu-mark__v">{x.v}</b>
                    <small>{x.line}</small>
                  </>
                );
                return (
                  <li key={x.key}>
                    {x.href ? (
                      <A className="nu-mark" href={x.href}>
                        {inner}
                      </A>
                    ) : (
                      <span className="nu-mark">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="nu-reg">
            <h3 className="nu-h3">Los jugadores</h3>
            <ul className="nu-marks">
              {r.indRec.map((x) => (
                <li key={x.key}>
                  <button type="button" className="nu-mark nu-mark--p" onClick={x.pick} disabled={!x.has && x.v === "–"}>
                    {x.has && <Shirt className="nu-mark__shirt" num={numOf(x.img)} alt={x.alt} />}
                    <span className="nu-mark__t">{x.t}</span>
                    <b className="nu-mark__v">{x.v}</b>
                    <small>{x.line}</small>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="nu-h3 nu-h3--gap">Dobletes, hat-tricks y asistencias múltiples</h3>
            {r.hasMulti && (
              <ul className="nu-links">
                {r.multi.map((m) => (
                  <li key={m.key}>
                    <span>{m.name}</span>
                    <b>{m.t}</b>
                  </li>
                ))}
              </ul>
            )}
            {r.multiNone && <p className="nu-empty">{r.multiNone}</p>}
          </div>
        </div>
      )}
      {r.isCromos && (
        <>
          <div className="nu-pickrow">
            <Seg label="Qué cromos ver" opts={r.cromoOpts} i={r.cromoI} className="nu-seg3s" n={3} />
            <Q label="Qué es la colección" onClick={r.i.cromos} />
          </div>
          <ul className="nu-cromos">
            {r.cromos.map((c) => (
              <li key={c.key}>
                {c.got ? (
                  <A className="nu-cromo" href={`/partidos/${c.id}`}>
                    <b>{c.value}</b>
                    <span className="nu-cromo__u">{c.unit}</span>
                    <em>{c.title}</em>
                    <span className="nu-cromo__w">{c.who}</span>
                    <small>
                      {c.j} · {c.vs}
                    </small>
                  </A>
                ) : (
                  <div className="nu-cromo nu-cromo--slot">
                    <em>{c.title}</em>
                    <small>{c.left}</small>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {r.isEvo && (
        <>
          <div className="nu-pickrow">
            <Seg label="Qué estadística" opts={r.evoOpts} i={r.evoI} className="nu-seg5s" n={5} />
            <Q label="Qué es la evolución" onClick={r.i.evolucion} />
          </div>
          <div className="nu-evo">
            <div className="nu-evo__plot">
              <svg className="nu-evo__svg" viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label={r.evo.cap}>
                <line className="nu-evo__grid" x1="0" y1="156" x2="600" y2="156" />
                <line className="nu-evo__grid" x1="0" y1="83" x2="600" y2="83" />
                <line className="nu-evo__grid" x1="0" y1="10" x2="600" y2="10" />
                {r.evo.d.map((d, i) => (d ? <path key={i} className={`nu-evo__l nu-evo__l--${i}`} d={d} /> : null))}
              </svg>
              {r.evo.one && <p className="nu-regsub">Con una jornada, cada línea es un solo paso: la evolución se dibuja jornada a jornada.</p>}
            </div>
            <ul className="nu-evo__keys">
              {r.evo.keys.map((k) => (
                <li key={k.key} className={k.cls}>
                  <Shirt className="" num={numOf(k.id)} alt={k.alt} />
                  <i aria-hidden="true" />
                  <span>{k.name}</span>
                  <b>{k.v}</b>
                </li>
              ))}
            </ul>
          </div>
          <p className="nu-regsub">{r.evo.cap}. Elige hasta seis jugadores:</p>
          <ul className="nu-chips" aria-label="Jugadores en la gráfica (máximo 6)">
            {r.evoPeople.map((p) => (
              <li key={p.key}>
                <button type="button" className="nu-chip nu-chip--stat" aria-pressed={p.on} onClick={p.pick}>
                  {p.t}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
