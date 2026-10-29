// Tabla (/partidos/tabla), the PA- boards: the screen's head (with «Con el marcador de ahora» while we play and
// the captain's «Publicar la clasificación»), el camino (every jornada as a tall sky; G·E·P on the ones still to
// play: «¿Y si…?»), and either the published table (in focus or entera, «Los de al lado», our place, the form,
// home and away, our position) or «La tabla, mientras llega» (our calendar's teams in the table's shape, what
// is coming and when, our points jornada by jornada).
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { Letter, PMatch } from "./season";
import type { Preset, tablaView } from "./views";
import { Ic } from "./Icon";
import { PointsPath, PositionLine } from "./Drawings";
import { RivalMark } from "../../../components/vidrio/RivalMark";

type TV = ReturnType<typeof tablaView>;

export interface TablaProps {
  tb: TV;
  ms: readonly PMatch[];
  asi: boolean;
  all: boolean;
  preset: Preset;
  captain: boolean;
  publishHref: string;
  onPublish: (e: MouseEvent<HTMLAnchorElement>) => void;
  onAsi: () => void;
  onAll: () => void;
  onPickSim: (id: string, l: Letter) => void;
  onPreset: (id: Exclude<Preset, null>) => void;
  /** «Avísame cuando se publique» (everyone but the captain, before the league publishes). */
  notify: ReactNode;
}

const crest = "/crest-128.webp";

const HEAD = (
  <>
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
    <span role="columnheader" className="x">
      <abbr title="Goles a favor">GF</abbr>
    </span>
    <span role="columnheader" className="x">
      <abbr title="Goles en contra">GC</abbr>
    </span>
    <span role="columnheader">
      <abbr title="Diferencia de goles">DG</abbr>
    </span>
    <span role="columnheader" className="pts">
      <abbr title="Puntos">Pts</abbr>
    </span>
  </>
);

export function Tabla(p: TablaProps) {
  const { tb } = p;
  return (
    <div className="pa-tb">
      <header className="pa-sh">
        <div>
          <p className="pa-sh__kick">
            {tb.kick}
            {tb.prov && (
              <>
                {" "}
                <span className="vd-provtag">Si acaba así</span>
              </>
            )}
          </p>
          <h2 className="pa-sh__t" id="pa-screen-title">
            {tb.title}
          </h2>
          <p className="pa-sh__s">{tb.sub}</p>
        </div>
        <div className="pa-sh__end">
          {tb.liveToggle && (
            <button type="button" className="vd-switch pa-asi" role="switch" aria-checked={p.asi} onClick={p.onAsi}>
              <span className="vd-switch__track" aria-hidden="true">
                <span className="vd-switch__knob" />
              </span>
              Con el marcador de ahora
            </button>
          )}
          {p.captain && (
            <a className="vd-glass vd-btn vd-btn--sm vd-btn--pri vd-press pa-publish" href={p.publishHref} onClick={p.onPublish}>
              <Ic name="mesa" />
              {tb.publishT}
            </a>
          )}
        </div>
      </header>

      <div className="pa-camwrap" data-noswipe="1" data-scroll-x="1">
        <p className="pa-camhead">
          <b>{tb.camT}</b>
          <span>{tb.camS}</span>
        </p>
        <ol className="pa-cam" aria-label={tb.camT}>
          {tb.cam.map((t) => (
            <li key={t.j} className={`pa-cam__t ${t.cls}`} style={{ viewTransitionName: `pa-t${t.j}` }}>
              <span className="pa-paint" style={{ "--a": t.ga, "--b": t.gb, "--m0": `${t.m0}%`, "--m1": `${t.m1}%` } as CSSProperties} aria-hidden="true">
                <i className="pa-phz" />
                <i className="pa-pturf" />
                <i className="pa-pscr" />
              </span>
              <span className="pa-cam__j" aria-hidden="true">
                J{t.j}
              </span>
              {t.res && (
                <span className="pa-cam__res" aria-label={t.aria}>
                  <em className={`pa-let pa-let--${t.lc}`}>{t.letter}</em>
                </span>
              )}
              {t.sim && (
                <span className="pa-cam__sim" role="group" aria-label={t.aria}>
                  {t.opts.map((o) => (
                    <button key={o.l} type="button" aria-pressed={o.on} aria-label={o.aria} onClick={() => p.onPickSim(t.id, o.l)}>
                      {o.l}
                    </button>
                  ))}
                </span>
              )}
              <span className="pa-cam__cap" aria-hidden="true">
                {t.res && <b className="pa-cam__sc">{t.scoreT}</b>}
                <span className="pa-cam__rv">{t.ini}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="pa-tb__grid">
        <section className="pa-tb__main" aria-labelledby="pa-tb-h">
          {tb.has ? (
            <>
              <div className="pa-tblhead">
                <h3 className="pa-h3" id="pa-tb-h">
                  {tb.tableT}
                </h3>
                <p className="pa-regsub">{tb.tableS}</p>
              </div>
              <div className={`pa-tbl ${tb.tblCls}`} role="table" aria-label={tb.tableT}>
                <div className="pa-tbl__r pa-tbl__r--h" role="row">
                  {HEAD}
                  <span role="columnheader" className="nx">
                    Contra nosotros
                  </span>
                </div>
                {tb.rows.map((r) =>
                  r.gap ? (
                    <div key={r.key} className="pa-tbl__gap" role="row">
                      <span role="cell">{r.gapT}</span>
                    </div>
                  ) : (
                    <div key={r.key} className={`pa-tbl__r ${r.cls}`} role="row" aria-current={r.us ? "true" : undefined} style={{ viewTransitionName: r.vt }}>
                      <span role="cell" className="p">
                        {r.pos}
                        {r.mv && (
                          <i className={`pa-mv ${r.mvCls}`} aria-label={r.mvAria}>
                            {r.mv}
                          </i>
                        )}
                      </span>
                      <span role="cell" className="t">
                        <span className={`pa-tbl__crest ${r.us ? "is-us" : "is-rival"}`} aria-hidden="true">
                          <RivalMark logo={r.logo}>{r.ini}</RivalMark>
                        </span>
                        <span className="pa-tbl__name">{r.team}</span>
                        {r.prov && <span className="vd-vh">, provisional</span>}
                        {r.provTag && (
                          <>
                            {" "}
                            <span className="vd-provtag">{r.provT}</span>
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
                      <span role="cell" className="x">
                        {r.gf}
                      </span>
                      <span role="cell" className="x">
                        {r.gc}
                      </span>
                      <span role="cell">{r.dg}</span>
                      <span role="cell" className="pts">
                        {r.pts}
                      </span>
                      <span role="cell" className="nx">
                        {r.vs}
                      </span>
                    </div>
                  ),
                )}
              </div>
              {tb.canGrow && (
                <div className="pa-seeall">
                  <p>{tb.summary}</p>
                  <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={p.onAll} aria-expanded={p.all}>
                    <Ic name={tb.allIcon} />
                    {tb.allT}
                  </button>
                </div>
              )}
              {tb.near.length > 0 && (
                <div className="pa-blk pa-nearblk">
                  <p className="pa-k">Los de al lado</p>
                  <ul className="pa-near">
                    {tb.near.map((n) => (
                      <li key={n.team}>
                        <span className="pa-tbl__crest is-rival" aria-hidden="true">
                          <RivalMark logo={n.logo}>{n.ini}</RivalMark>
                        </span>
                        <span>
                          <b>{n.team}</b>
                          <small>{n.s}</small>
                        </span>
                        <em>{n.d}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="pa-wait">
                <Ic name="cal" className="pa-wait__i" />
                <div>
                  <h3 className="pa-h3" id="pa-tb-h">
                    La liga aún no ha publicado la clasificación
                  </h3>
                  <p className="pa-regsub">{tb.waitS}</p>
                </div>
              </div>
              <div className="pa-tbl pa-tbl--ghost" role="table" aria-label="Los equipos de nuestro calendario">
                <div className="pa-tbl__r pa-tbl__r--h" role="row">
                  {HEAD}
                </div>
                {tb.ghost.map((r) =>
                  r.us ? (
                    <div key="us" className="pa-tbl__r is-us is-ours" role="row" aria-current="true" style={{ viewTransitionName: "pa-row-manchester-piti" }}>
                      <span role="cell" className="p">
                        –
                      </span>
                      <span role="cell" className="t">
                        <img className="pa-tbl__img" src={crest} alt="" width={28} height={28} />
                        <span className="pa-tbl__name">Manchester Piti</span>
                        <span className="pa-tag">{r.tag}</span>
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
                      <span role="cell" className="x">
                        {r.gf}
                      </span>
                      <span role="cell" className="x">
                        {r.gc}
                      </span>
                      <span role="cell">{r.dg}</span>
                      <span role="cell" className="pts">
                        {r.pts}
                      </span>
                    </div>
                  ) : (
                    <div key={r.vt} className={`pa-tbl__r is-ghost ${r.cls}`} role="row" style={{ viewTransitionName: r.vt }}>
                      <span role="cell" className="p">
                        –
                      </span>
                      <span role="cell" className="t">
                        <span className="pa-tbl__crest is-rival" aria-hidden="true">
                          <RivalMark logo={r.logo}>{r.ini}</RivalMark>
                        </span>
                        <span className="pa-tbl__name">{r.team}</span>
                      </span>
                      <span role="cell" className="pa-tbl__vs">
                        <em className={`pa-let pa-let--${r.lc}`}>{r.l}</em>
                        <span>{r.vs}</span>
                      </span>
                    </div>
                  ),
                )}
              </div>
              <p className="pa-tbl__foot">{tb.ghostFoot}</p>
              <div className="pa-blk pa-will">
                <p className="pa-k">Qué verás aquí, y cuándo</p>
                <ul className="pa-will__l">
                  {tb.will.map((w) => (
                    <li key={w.t}>
                      <Ic name={w.icon} />
                      <span>
                        <b>{w.t}</b>
                        <small>{w.s}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <aside className="pa-tb__side">
          {tb.has ? (
            <>
              <div className="pa-us">
                <p className="pa-big pa-big--pos">
                  <span>{tb.pos}</span>
                </p>
                <div className="pa-us__t">
                  <b>{tb.posT}</b>
                  <span>{tb.posS}</span>
                </div>
              </div>
              {tb.form.length > 0 && (
                <div className="pa-blk">
                  <p className="pa-k">La forma</p>
                  <ol className="vd-form pa-form" aria-label="La forma">
                    {tb.form.map((f) => (
                      <li key={f.j} className={`vd-form__l ${f.cls}`} aria-label={f.aria}>
                        <span aria-hidden="true">{f.t}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="pa-blk">
                <p className="pa-k">En casa y fuera</p>
                <dl className="pa-split">
                  {tb.split.map((s) => (
                    <div key={s.t}>
                      <dt>{s.t}</dt>
                      <dd>
                        <b>{s.pts}</b> pts · {s.rec} · {s.goals}
                      </dd>
                      <span className="pa-split__bar" aria-hidden="true">
                        <i style={{ width: `${s.w}%` }} />
                      </span>
                    </div>
                  ))}
                </dl>
              </div>
              {tb.posSeries.length > 0 && (
                <div className="pa-blk">
                  <p className="pa-k">Nuestra posición, jornada a jornada</p>
                  <div className="pa-chart" role="img" aria-label={tb.posAria}>
                    <PositionLine series={tb.posSeries} teams={tb.teams} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="pa-blk">
              <p className="pa-k">Nuestros puntos, jornada a jornada</p>
              <div className="pa-chart pa-chart--pts" role="img" aria-label={tb.ptsAria}>
                <PointsPath ms={p.ms} picks={tb.picks} />
              </div>
            </div>
          )}
          <div className="pa-blk pa-ysi">
            <p className="pa-k">¿Y si…?</p>
            <p className="pa-ysi__p">{tb.ysiP}</p>
            <div className="pa-ysi__out">
              <p className="pa-big pa-big--ysi">
                <span>{tb.ysiBig}</span>
              </p>
              <p>
                <b>{tb.ysiT}</b>
                <span>{tb.ysiS}</span>
              </p>
            </div>
            {p.ms.some((m) => m.state === "hoy" || m.state === "proximo" || m.state === "aplazado") && (
              <div className="pa-chips" role="group" aria-label="Rellenar lo que queda">
                {tb.presets.map(([id, t]) => (
                  <button key={id} type="button" className="vd-glass vd-press pa-chip" aria-pressed={p.preset === id} onClick={() => p.onPreset(id)}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {p.captain && !tb.has && (
            <div className="pa-blk pa-cap">
              <Ic name="mesa" />
              <div>
                <b>{tb.capT}</b>
                <p>{tb.capS}</p>
                <a className="vd-glass vd-btn vd-btn--sm vd-btn--pri vd-press" href={p.publishHref} onClick={p.onPublish}>
                  {tb.publishT}
                </a>
              </div>
            </div>
          )}
          {!p.captain && !tb.has && p.notify}
        </aside>
      </div>
    </div>
  );
}
