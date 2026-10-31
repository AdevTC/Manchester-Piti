// «El palco» · Temporada: the prototype's template (Numeros.dc.html, «TEMPORADA») in JSX — la cinta with «Repasar la
// temporada», the team's numbers, la carrera, the table with «¿Y si…?», los cromos and the side column. The
// arithmetic is in temporada.ts.
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Ic, PShirt, Seg } from "./kit";
import { temporadaView } from "./temporadaView";
import type { PlaceProps } from "./types";

export function Temporada({ v, st, act }: PlaceProps) {
  const t = temporadaView(v, st, act);
  const jd = t.jd;
  return (
    <section aria-labelledby="nx-t-h">
      <header className="nx-head">
        <div className="nx-head__t">
          <p className="nx-kick">{t.kick}</p>
          <h2 className="nx-h2" id="nx-t-h" aria-live={t.live}>
            {t.title}
            {t.prov && <span className="vd-provtag">Si acaba así</span>}
          </h2>
          <p className="nx-sub">{t.sub}</p>
        </div>
      </header>

      <section className="nx-sec nx-sec--first" aria-labelledby="nx-cinta-h">
        <div className="nx-sec__head">
          <div>
            <h3 className="nx-h3" id="nx-cinta-h">
              La cinta de la temporada
            </h3>
            <p className="nx-meta">{t.cintaMeta}</p>
          </div>
          <div className="nx-cinta__bar">
            <button type="button" className="vd-glass vd-press nx-ib" aria-label="Jornada anterior" onClick={t.prev} disabled={t.noPrev}>
              <Ic name="left" />
            </button>
            <button type="button" className={`vd-glass vd-press nx-rep ${t.repCls}`.trim()} aria-pressed={t.playing} onClick={t.play} disabled={t.playOff}>
              <Ic name={t.playIc} />
              {t.playT}
              {t.repJ && <span className="nx-rep__j">{t.repJ}</span>}
            </button>
            <button type="button" className="vd-glass vd-press nx-ib" aria-label="Jornada siguiente" onClick={t.next} disabled={t.noNext}>
              <Ic name="arrow" />
            </button>
            {t.hasBack && (
              <button type="button" className="nx-lnk" onClick={t.back}>
                Volver a hoy
              </button>
            )}
          </div>
        </div>
        <div className="nx-cinta__scroll">
          <div className="nx-cinta__in" style={{ "--n": t.n } as CSSProperties}>
            <div className="nx-pts" aria-hidden="true">
              <span className="nx-pts__cap">Puntos</span>
              <svg viewBox={`0 0 ${t.n} 100`} preserveAspectRatio="none" focusable="false">
                <defs>
                  <linearGradient id="nx-ptsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" className="nx-pts__g0" />
                    <stop offset="1" className="nx-pts__g1" />
                  </linearGradient>
                </defs>
                <path className="nx-pts__pace" d={t.pace} />
                {t.ptsArea && <path className="nx-pts__area" d={t.ptsArea} />}
                {t.ptsLine && <path className="nx-pts__line" d={t.ptsLine} />}
              </svg>
              {t.ptsDots.map((d) => (
                <span key={d.key} className={`nx-pts__dot ${d.cls}`.trim()} style={{ left: `${d.left}%`, top: `${d.top}px` }} />
              ))}
              {t.ptsLab && (
                <span className="nx-pts__lab" style={{ left: `${t.ptsLab.left}%`, top: `${t.ptsLab.top}px` }}>
                  {t.ptsLab.v}
                </span>
              )}
            </div>
            <div className="nx-cols-j" role="group" aria-label="Jornadas: toca una para ver el partido">
              {t.cinta.map((c) => (
                <button key={c.key} type="button" className={`nx-cj ${c.cls}`} aria-pressed={c.on} aria-label={c.aria} onClick={c.pick}>
                  <span className="nx-cj__up" style={{ height: `${c.up}%` }} />
                  <span className={`vd-form__l ${c.lcls}`.trim()} aria-hidden="true">
                    {c.l}
                  </span>
                  <span className="nx-cj__dn" style={{ height: `${c.dn}%` }} />
                  <span className="nx-cj__j" aria-hidden="true">
                    {c.j}
                  </span>
                  <span className="nx-cj__r" aria-hidden="true">
                    {c.ini}
                  </span>
                  {c.now && <span className="nx-cj__now">{c.nowT}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="nx-key">
          <span>
            <i className="nx-sw nx-sw--us" />
            Nuestros goles, arriba
          </span>
          <span>
            <i className="nx-sw nx-sw--them" />
            Los del rival, abajo
          </span>
          <span>
            <i className="nx-sw nx-sw--pts" />
            Puntos acumulados
          </span>
          <span>
            <i className="nx-sw nx-sw--pace" />
            {t.paceT}
          </span>
          <span>G ganado · E empatado · P perdido</span>
        </p>
        {jd && (
          <div className="vd-glass nx-jd" aria-live={t.live}>
            <div className="nx-jd__score">
              <span className={`vd-form__l ${jd.lcls}`.trim()} aria-hidden="true">
                {jd.l}
              </span>
              <span className="nx-score">{jd.big}</span>
            </div>
            <div className="nx-jd__t">
              <b>{jd.head}</b>
              <span>{jd.line}</span>
              {jd.hasWho && (
                <p className="nx-jd__who">
                  <Ic name="ball" />
                  {jd.who}
                </p>
              )}
            </div>
            <div className="nx-jd__go">
              {jd.canUpto && (
                <button type="button" className="vd-glass vd-press nx-btn" onClick={jd.upto}>
                  Ver la temporada hasta aquí
                </button>
              )}
              <Link to={jd.href} className="vd-glass vd-press nx-btn">
                {jd.go}
                <Ic name="arrow" />
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="nx-cols">
        <div>
          <section className="nx-sec" aria-labelledby="nx-team-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-team-h">
                Los números del equipo
              </h3>
              <p className="nx-meta">{t.teamMeta}</p>
            </div>
            <div className="nx-team">
              <div>
                <p className="nx-blk__k">Resultados</p>
                <div className="nx-wdl" role="img" aria-label={t.wdlAria}>
                  {t.wdl.map((w) => (
                    <span key={w.k} className={`is-${w.k}`} style={{ flex: w.n }}>
                      {w.L} {w.n}
                    </span>
                  ))}
                </div>
                <div className="nx-figs">
                  {[t.pct, t.pts, t.pj].map((f, i) => (
                    <div key={i} className="nx-fig">
                      <b>{f.v}</b>
                      <span>{f.t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="nx-blk__k">Goles</p>
                <div className="nx-gg">
                  <div className="nx-gg__r nx-gg__r--us">
                    <span>A favor</span>
                    <span className="nx-gg__b">
                      <i style={{ width: `${t.gfW}%` }} />
                    </span>
                    <b>{t.gf}</b>
                  </div>
                  <div className="nx-gg__r nx-gg__r--them">
                    <span>En contra</span>
                    <span className="nx-gg__b">
                      <i style={{ width: `${t.gcW}%` }} />
                    </span>
                    <b>{t.gc}</b>
                  </div>
                </div>
                <div className="nx-figs">
                  {[t.gpp, t.cs].map((f, i) => (
                    <div key={i} className="nx-fig">
                      <b>{f.v}</b>
                      <span>{f.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="nx-chipsrow">
              {t.chips.map((c) => (
                <span key={c.t} className="nx-chip">
                  <b>{c.v}</b>
                  {c.t}
                </span>
              ))}
            </div>
          </section>

          <section className="nx-sec" aria-labelledby="nx-race-h">
            <div className="nx-sec__head">
              <div>
                <h3 className="nx-h3" id="nx-race-h">
                  La carrera
                </h3>
                <p className="nx-meta">{t.raceMeta}</p>
              </div>
              <Seg label="Qué carrera" opts={t.raceOpts} style={{ width: 300 }} />
            </div>
            <ol className="nx-race" aria-label={t.raceAria}>
              {t.race.map((r) => (
                <li key={r.key} className={`nx-rc ${r.cls}`.trim()}>
                  <span className="nx-rc__p">{r.rk}</span>
                  <PShirt n={r.n} className="nx-shirt" />
                  <span className="nx-rc__n">
                    {r.name}
                    {r.you && <span className="nx-you">Tú</span>}
                  </span>
                  <span className="nx-rc__b" aria-hidden="true">
                    <i style={{ width: `${r.w}%` }} />
                  </span>
                  <span className="nx-rc__v">{r.val}</span>
                </li>
              ))}
            </ol>
            <div className="nx-racecap">
              {t.raceCap.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </section>

          <section className="nx-sec" aria-labelledby="nx-tab-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-tab-h">
                {t.tableT}
              </h3>
              <p className="nx-meta">{t.tableSub}</p>
            </div>
            {t.showTable ? (
              <>
                <table className="vd-table">
                  <caption className="nx-vh">La clasificación</caption>
                  <thead>
                    <tr>
                      <th className="t" colSpan={2} scope="col">
                        Equipo
                      </th>
                      <th scope="col">
                        <abbr title="Partidos jugados">PJ</abbr>
                      </th>
                      <th scope="col" className="h-sm">
                        <abbr title="Ganados">G</abbr>
                      </th>
                      <th scope="col" className="h-sm">
                        <abbr title="Empatados">E</abbr>
                      </th>
                      <th scope="col" className="h-sm">
                        <abbr title="Perdidos">P</abbr>
                      </th>
                      <th scope="col">
                        <abbr title="Diferencia de goles">DG</abbr>
                      </th>
                      <th scope="col">
                        <abbr title="Puntos">Pts</abbr>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r) =>
                      r.gap ? (
                        <tr key={r.key} className="vd-gap">
                          <td colSpan={8}>
                            <span aria-hidden="true">…</span>
                            <span className="nx-vh">{r.gapT}</span>
                          </td>
                        </tr>
                      ) : (
                        <tr key={r.key} className={r.cls || undefined} aria-current={r.us ? "true" : undefined}>
                          <td className="p">{r.pos}</td>
                          <td className="t">
                            {r.team}
                            {r.prov && (
                              <>
                                {" "}
                                <span className="vd-provtag">Si acaba así</span>
                              </>
                            )}
                            {r.mv && <span className="nx-mv">{r.mv}</span>}
                          </td>
                          <td>{r.pj}</td>
                          <td className="h-sm">{r.g}</td>
                          <td className="h-sm">{r.e}</td>
                          <td className="h-sm">{r.p}</td>
                          <td>{r.dg}</td>
                          <td className="pts">{r.pts}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
                {t.champ && (
                  <p className="nx-champ">
                    <Ic name="shield" />
                    {t.champT}
                  </p>
                )}
                {t.canAll && (
                  <button type="button" className="nx-lnk" onClick={t.toggleAll}>
                    {t.allT}
                  </button>
                )}
              </>
            ) : (
              <p className="nx-tbl-empty">{t.calSub}</p>
            )}
            {t.hasYsi && (
              <button type="button" className={`vd-glass vd-press nx-ysi ${t.ysiCls}`.trim()} aria-haspopup="dialog" onClick={t.openYsi}>
                <span>
                  <b>{t.ysiT}</b>
                  <span>{t.ysiLine}</span>
                </span>
                <Ic name="arrow" />
              </button>
            )}
          </section>

          <section className="nx-sec" aria-labelledby="nx-cromos-h">
            <div className="nx-sec__head">
              <div>
                <h3 className="nx-h3" id="nx-cromos-h">
                  Los cromos de la temporada
                </h3>
                <p className="nx-meta">{t.cromoMeta}</p>
              </div>
              <Seg label="Qué cromos ver" opts={t.cromoOpts} style={{ width: 340 }} />
            </div>
            <ul className="nx-album">
              {t.cromos.map((c) =>
                c.got ? (
                  <li key={c.key} className="vd-glass nx-cromo">
                    <span className="nx-cromo__k">{c.kind}</span>
                    {c.href ? (
                      <Link to={c.href} className="nx-cromo__t nx-cromo__lk">
                        {c.title}
                      </Link>
                    ) : (
                      <span className="nx-cromo__t">{c.title}</span>
                    )}
                    <span className="nx-cromo__v">
                      {c.value}
                      <small>{c.unit}</small>
                    </span>
                    <span className="nx-cromo__w">{c.who}</span>
                    <span className="nx-cromo__w">{c.sub}</span>
                  </li>
                ) : (
                  <li key={c.key} className="nx-cromo is-off">
                    <Ic name="lock" />
                    <span className="nx-cromo__t">
                      {c.title}
                      <span className="nx-vh">: sin conseguir</span>
                    </span>
                    <span className="nx-cromo__w">{c.left}</span>
                  </li>
                ),
              )}
            </ul>
          </section>
        </div>

        <div className="nx-side">
          <section className="nx-sec" aria-labelledby="nx-forma-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-forma-h">
                La forma
              </h3>
              <p className="nx-meta">De la más antigua a la última</p>
            </div>
            <ol className="vd-form" aria-label="La forma, de la más antigua a la última">
              {t.form.map((f) => (
                <li key={f.key} className={`vd-form__l ${f.cls}`} role="img" aria-label={f.label}>
                  {f.l}
                </li>
              ))}
            </ol>
            {t.mvpLine && (
              <p className="nx-mvp">
                <Ic name="star" />
                {t.mvpLine}
              </p>
            )}
          </section>
          <section className="nx-sec" aria-labelledby="nx-rach-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-rach-h">
                Rachas del equipo
              </h3>
              <p className="nx-meta">La barra es la racha; la raya, el récord</p>
            </div>
            <div>
              {t.streaks.map((r) => (
                <div key={r.key} className="nx-streak">
                  <span className="nx-streak__n">{r.cur}</span>
                  <span className="nx-streak__t">
                    {r.t}
                    {r.live && (
                      <span className="nx-viva">
                        <span className="nx-dot" />
                        Viva
                      </span>
                    )}
                  </span>
                  <span className="nx-streak__m" aria-hidden="true">
                    <i style={{ width: `${r.curW}%` }} />
                    <em style={{ left: `${r.bestW}%` }} />
                  </span>
                  <span className="nx-streak__l">{r.line}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="nx-sec" aria-labelledby="nx-marcas-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-marcas-h">
                Marcas del equipo
              </h3>
            </div>
            <div>
              {t.teamRec.map((r) => {
                const inner = (
                  <>
                    <span className="nx-rec__t">{r.t}</span>
                    <span className="nx-rec__v">{r.v}</span>
                    <span className="nx-rec__l">{r.line}</span>
                  </>
                );
                return r.href ? (
                  <Link key={r.key} to={r.href} className="nx-rec">
                    {inner}
                  </Link>
                ) : (
                  <div key={r.key} className="nx-rec">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
          <section className="nx-sec" aria-labelledby="nx-sys-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-sys-h">
                Con cada sistema
              </h3>
              <p className="nx-meta">{t.sysMeta}</p>
            </div>
            <div>
              {t.sys.map((y) => (
                <div key={y.key} className="nx-sysc">
                  <span className="nx-sysg" aria-hidden="true">
                    {y.rows.map((n, i) => (
                      <span key={i}>
                        {Array.from({ length: n }, (_, k) => (
                          <i key={k} />
                        ))}
                      </span>
                    ))}
                  </span>
                  <span>
                    <b>{y.label}</b>
                    <small>{y.line}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
          {t.said.length > 0 && (
            <section className="nx-sec" aria-labelledby="nx-said-h">
              <div className="nx-sec__head">
                <h3 className="nx-h3" id="nx-said-h">
                  Lo que dicen los números
                </h3>
              </div>
              <ul className="nx-said">
                {t.said.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
