// Balance (/partidos/balance), the PA- boards: one screen. The readout (the season, or the jornada being read)
// beside the season's sky columns (our goals in gold above, theirs below, in the light of each kick-off): pass over
// a column or tap it and the whole screen reads that jornada. Under it, seven facets that replace one area.
import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from "react";
import type { Facet, balanceView } from "./views";
import { Ic, ShirtImg } from "./Icon";
import { RivalMark } from "../../../components/vidrio/RivalMark";

type BV = ReturnType<typeof balanceView>;

export interface BalanceProps {
  bv: BV;
  h: number;
  grown: boolean;
  balBox: Ref<HTMLDivElement>;
  kit: "home" | "away";
  onClear: () => void;
  onToJor: (j: number) => void;
  onCol: (j: number) => void;
  onHover: (j: number) => void;
  onLeave: () => void;
  onColKey: (e: KeyboardEvent<HTMLButtonElement>, j: number) => void;
  onFacet: (f: Facet) => void;
  onFacetKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onGrow: () => void;
  goHref: (path: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
}

const rep = (n: number) => Array.from({ length: n }, (_x, i) => i);

export function Balance({ balBox, ...p }: BalanceProps) {
  const { bv } = p;
  const { rd, fc } = bv;
  return (
    <div className={`pa-bal${bv.desk ? " is-fit" : ""}${p.grown ? " is-grown" : ""}`} style={{ "--pa-h": `${p.h}px`, "--n": bv.cols.length } as CSSProperties} ref={balBox}>
      <section className="pa-hero" aria-labelledby="pa-bal-h">
        <div className="pa-read" aria-live="polite">
          <div className="pa-read__top">
            <p className="pa-read__k">
              {rd.kick}
              {rd.tag && (
                <>
                  {" "}
                  <span className="vd-provtag">{rd.tag}</span>
                </>
              )}
            </p>
            {rd.isJ && (
              <button type="button" className="vd-link pa-read__all" onClick={p.onClear}>
                <Ic name="chev-l" />
                Toda la temporada
              </button>
            )}
          </div>
          <h2 className="pa-read__h" id="pa-bal-h">
            {rd.title}
          </h2>
          <div className="pa-read__big">
            <p className={`pa-big pa-big--read ${rd.bigCls}`}>
              <span>{rd.big}</span>
            </p>
            <p className="pa-read__w">
              <b>{rd.word}</b>
              <span>{rd.sub}</span>
            </p>
          </div>
          {rd.isJ && (
            <p className="pa-read__light">
              <i className="pa-swatch" style={{ background: rd.sky }} aria-hidden="true" />
              {rd.light}
            </p>
          )}
          <dl className="pa-read__dl">
            {rd.facts.map((f) => (
              <div key={f.t} className={f.cls}>
                <dt>{f.t}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
          <div className="pa-read__acts">
            {rd.isJ && bv.picked ? (
              <>
                <a className="vd-glass vd-btn vd-btn--sm vd-btn--pri vd-press" href={rd.href} onClick={p.goHref(rd.href)}>
                  Abrir el partido
                </a>
                <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={() => bv.picked && p.onToJor(bv.picked.j)}>
                  En Jornadas
                </button>
              </>
            ) : (
              <p className="pa-read__hint">{rd.hint}</p>
            )}
          </div>
        </div>
        <div className="pa-chart2">
          <p className="pa-legend">
            <span className="pa-legend__us">Arriba, nuestros goles</span>
            <span className="pa-legend__them">Abajo, los del rival</span>
          </p>
          <div className="pa-colswrap" data-noswipe="1" data-scroll-x="1" onPointerLeave={p.onLeave}>
            <ol className="pa-cols" style={{ "--bs": `${bv.bs}px` } as CSSProperties} aria-label="Las jornadas: elige una y la pantalla la cuenta">
              {bv.cols.map((c) => (
                <li key={c.j} className={`pa-colli${c.sel ? " is-sel" : ""}`}>
                  <button type="button" className={`pa-colb ${c.cls}`} style={{ viewTransitionName: `pa-t${c.j}` }} aria-pressed={c.sel} aria-label={c.aria} onClick={() => p.onCol(c.j)} onPointerEnter={(e) => e.pointerType === "mouse" && p.onHover(c.j)} onFocus={() => p.onHover(c.j)} onKeyDown={(e) => p.onColKey(e, c.j)}>
                    <span className="pa-paint" style={{ "--a": c.ga, "--b": c.gb, "--m0": `${c.m0}%`, "--m1": `${c.m1}%` } as CSSProperties} aria-hidden="true">
                      <i className="pa-phz" />
                      <i className="pa-pturf" />
                      <i className="pa-pscr" />
                      {c.sun && <i className="pa-csun" style={{ top: `${c.sunY}%` }} />}
                    </span>
                    <span className="pa-colb__up" aria-hidden="true">
                      {rep(c.us).map((i) => (
                        <i key={i} className="pa-ball" />
                      ))}
                    </span>
                    <span className="pa-colb__dn" aria-hidden="true">
                      {rep(c.them).map((i) => (
                        <i key={i} className="pa-ring" />
                      ))}
                    </span>
                    {c.live && (
                      <span className="pa-colb__live" aria-hidden="true">
                        <span className="vd-livedot" />
                      </span>
                    )}
                    {c.letter && (
                      <em className={`pa-let pa-let--${c.lc} pa-colb__let`} aria-hidden="true">
                        {c.letter}
                      </em>
                    )}
                    <span className="pa-colb__pp" aria-hidden="true">
                      {c.ppT}
                    </span>
                  </button>
                  <span className="pa-colli__j" aria-hidden="true">
                    J{c.j}
                  </span>
                  <span className="pa-colli__s" aria-hidden="true">
                    {c.sc}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="pa-facets" aria-label="El detalle de la temporada">
        <div className="pa-fsw" data-noswipe="1" data-scroll-x="1">
          <div className="vd-glass pa-fsw__in" role="tablist" aria-label="El detalle">
            {bv.facets.map((f) => (
              <button key={f.id} type="button" role="tab" id={`pa-ft-${f.id}`} aria-controls="pa-fpanel" aria-selected={f.on} tabIndex={f.on ? 0 : -1} className="pa-ftab" onClick={() => p.onFacet(f.id)} onKeyDown={p.onFacetKey}>
                {f.on && <span className="pa-ftab__bead" aria-hidden="true" />}
                <span className="pa-ftab__t">
                  <b>{f.label}</b>
                  <small>{f.head}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="pa-fpanel" id="pa-fpanel" role="tabpanel" aria-labelledby={`pa-ft-${fc.id}`}>
          <header className="pa-fpanel__h">
            <p className="pa-fpanel__s">
              <b>{fc.scope}</b> {fc.line}
            </p>
            {fc.door && (
              <a className="pa-door-l pa-fdoor" href={fc.doorPath} onClick={p.goHref(fc.doorPath)}>
                {fc.door}
                <Ic name="chev-r" />
              </a>
            )}
            {fc.canGrow && (
              <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pa-fgrow" onClick={p.onGrow} aria-expanded={p.grown}>
                <Ic name={fc.growIcon} />
                {fc.growT}
              </button>
            )}
          </header>
          <div className="pa-fbody">
            {fc.tiles.length > 0 && (
              <ul className="pa-ftiles">
                {fc.tiles.map((t) => (
                  <li key={t.s}>
                    <Ic name={t.icon} />
                    <b>{t.v}</b>
                    <span>
                      <em>{t.t}</em>
                      <small>{t.s}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {fc.form.length > 0 && (
              <div className="pa-fform">
                <p>{fc.formT}</p>
                <ol className="vd-form pa-form" aria-label={fc.formT}>
                  {fc.form.map((f) => (
                    <li key={f.j} className={`vd-form__l ${f.cls}`} aria-label={f.aria}>
                      <span aria-hidden="true">{f.t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {fc.cards.length > 0 && (
              <ol className="pa-fcards">
                {fc.cards.map((r) => (
                  <li key={r.id} className={`pa-fcard${r.you ? " is-you" : ""}`}>
                    <ShirtImg kit={p.kit} num={r.num} alt={`La camiseta de ${r.name}${r.num ? `, el ${r.num}` : ""}`} className="pa-fcard__shirt" size={54} />
                    <span className="pa-fcard__t">
                      <b>
                        {r.name}
                        {r.you && <i className="pa-tu">Tú</i>}
                      </b>
                      <small>{r.s}</small>
                    </span>
                    <span className="pa-fcard__v">
                      <b className="is-g">{r.g}</b>
                      <small>{r.gT}</small>
                    </span>
                    <span className="pa-fcard__v">
                      <b>{r.a}</b>
                      <small>{r.aT}</small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {fc.list.length > 0 && (
              <ol className="pa-flist">
                {fc.list.map((y) => (
                  <li key={y.key} className={y.cls}>
                    <span className="vd-clock">{y.min}</span>
                    <Ic name={y.icon} />
                    <span>
                      <b>{y.t}</b>
                      {y.s && <small>{y.s}</small>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {fc.mins.length > 0 && (
              <ol className="pa-fmins">
                {fc.mins.map((r) => (
                  <li key={r.id}>
                    <span className="pa-mins__n">{r.n}</span>
                    <b>{r.name}</b>
                    <span className="pa-mins__bar" aria-hidden="true">
                      {r.stints.map((s) => (
                        <i key={s.x} style={{ left: `${s.x}%`, width: `${s.w}%` }} />
                      ))}
                    </span>
                    <span className="pa-mins__v">{r.v}</span>
                  </li>
                ))}
              </ol>
            )}
            {fc.stretch.length > 0 && (
              <div className="pa-fwhen">
                <div className="pa-stretch" role="img" aria-label={fc.whenAria}>
                  {fc.stretch.map((s, i) => (
                    <span key={i} className="pa-stretch__c">
                      <i className="pa-stretch__u" style={{ height: `${s.u}px` }} />
                      <i className="pa-stretch__d" style={{ height: `${s.d}px` }} />
                    </span>
                  ))}
                  <span className="pa-stretch__axis" aria-hidden="true" />
                </div>
                <p className="pa-stretch__lab" aria-hidden="true">
                  <span>0′</span>
                  <span>Descanso</span>
                  <span>50′</span>
                </p>
              </div>
            )}
            {fc.mx.length > 0 && (
              <ul className="pa-fmx">
                {fc.mx.map((r) => (
                  <li key={r.rival} className={`pa-fmx__r ${r.cls}`}>
                    <span className="pa-fmx__t">
                      <span className="pa-tbl__crest is-rival" aria-hidden="true">
                        <RivalMark logo={r.logo}>{r.ini}</RivalMark>
                      </span>
                      <b>{r.rival}</b>
                    </span>
                    <span className="pa-fmx__legs">
                      {r.legs.map((g) => (
                        <button key={g.j} type="button" className={`pa-mx__b ${g.cls}`} onClick={() => p.onToJor(g.j)} aria-label={g.aria}>
                          <em className={`pa-let pa-let--${g.lc}`}>{g.l}</em>
                          <span>{g.t}</span>
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {fc.note && (
              <p className="pa-fnote">
                <Ic name={fc.noteIcon} />
                <span>{fc.note}</span>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
