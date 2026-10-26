// Jornadas (/partidos), the PA- boards: «Hoy», the season's minimap, the pager and the filter; the ribbon of light
// (each jornada painted in the light of its kick-off); the lens on the chosen one — Previa, Directo, Acta or
// Aplazado. The member's own pieces (¿Vas?, the notices) come in as slots: they load in their own chunk.
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import type { PMatch } from "./season";
import type { Filt, Lente, jornadasView, lensView } from "./views";
import type { NotaBadge } from "./notas";
import { Ic, ShirtImg } from "./Icon";
import { SunCurve } from "./Drawings";
import { SocialIcon } from "../../../components/vidrio/SocialIcon";

const crest = "/crest-128.webp";

type JV = NonNullable<ReturnType<typeof jornadasView>>;
type LV = ReturnType<typeof lensView>;

export interface JornadasProps {
  jor: JV;
  lv: LV;
  sel: PMatch;
  filt: Filt;
  ribBox: Ref<HTMLDivElement>;
  mmBox: Ref<HTMLDivElement>;
  lensBox?: Ref<HTMLElement>;
  onPick: (j: number) => void;
  onHoy: () => void;
  onPrev: () => void;
  onNext: () => void;
  onMm: (e: MouseEvent<HTMLDivElement>) => void;
  onMmKey: (e: KeyboardEvent<HTMLDivElement>) => void;
  onSegKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onFilt: (f: Filt) => void;
  onLente: (l: Lente, off: boolean) => void;
  onCartel: () => void;
  onPip: () => void;
  goHref: (path: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
  /** «¿Vas el domingo?» for a jugador, or the convocatoria's note for everyone else. */
  rsvp: ReactNode;
  notify: ReactNode;
  ppNotify: ReactNode;
  onCal: () => void;
  mapsHref: string;
  porra: ReactNode;
}

const FILTS: [Filt, string][] = [
  ["todos", "Todos"],
  ["proximos", "Próximos"],
  ["resultados", "Resultados"],
];

export function Jornadas({ ribBox, mmBox, lensBox, ...p }: JornadasProps) {
  const { jor, lv, sel } = p;
  const { lens, pre, dir, act, pp } = lv;
  const filtI = FILTS.findIndex((f) => f[0] === p.filt);
  const tabI = Math.max(0, lens.tabs.findIndex((t) => t.on));
  return (
    <div className="pa-jor">
      <div className="pa-jbar">
        <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pa-hoy" onClick={p.onHoy} aria-disabled={jor.hoyOff} aria-label="Volver a hoy">
          Hoy
        </button>
        <div className="pa-mm" role="slider" tabIndex={0} aria-label="La temporada entera: toca una jornada" aria-valuemin={1} aria-valuemax={jor.n} aria-valuenow={sel.j} aria-valuetext={jor.winTxt} onClick={p.onMm} onKeyDown={p.onMmKey} ref={mmBox}>
          {jor.marks.map((k) => (
            <span key={k.j} className={`pa-mm__s ${k.cls}`} style={{ left: `${k.x}%`, width: `${k.w}%`, background: k.bg }}>
              <i>{k.l}</i>
            </span>
          ))}
          {jor.months.map((o) => (
            <span key={`${o.t}-${o.x}`} className="pa-mm__mo" style={{ left: `${o.x}%` }}>
              {o.t}
            </span>
          ))}
          <span className="pa-mm__hoy" style={{ left: `${jor.hoyX}%` }} aria-hidden="true" />
          <span className="pa-mm__win" style={{ left: `${jor.winX}%`, width: `${jor.winW}%` }} aria-hidden="true" />
        </div>
        <button type="button" className="vd-glass vd-ibtn vd-press pa-pg" onClick={p.onPrev} aria-disabled={jor.noPrev} aria-label="Jornadas anteriores">
          <Ic name="chev-l" />
        </button>
        <button type="button" className="vd-glass vd-ibtn vd-press pa-pg" onClick={p.onNext} aria-disabled={jor.noNext} aria-label="Jornadas siguientes">
          <Ic name="chev-r" />
        </button>
        <div className="vd-glass vd-seg pa-filt" role="radiogroup" aria-label="Qué jornadas" style={{ "--n": 3, "--i": filtI } as CSSProperties}>
          <span className="vd-shelf__bead" aria-hidden="true" />
          {FILTS.map(([id, t]) => (
            <button key={id} type="button" role="radio" className="vd-seg__b" aria-checked={p.filt === id} onClick={() => p.onFilt(id)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="pa-ribwrap" data-noswipe="1" data-scroll-x="1" ref={ribBox}>
        <div className="pa-rib" role="group" aria-label={jor.ribLabel}>
          <div className="pa-rib__band" aria-hidden="true" />
          {jor.tiles.map((t) => (
            <Tile key={t.j} t={t} onPick={p.onPick} onKey={p.onSegKey} />
          ))}
        </div>
      </div>

      <article className={`vd-glass vd-glass--deep vd-lens pa-lens pa-lens--${lens.lente}`} aria-labelledby="pa-lens-h" ref={lensBox} data-vd-lens="24,1.25,12">
        <header className="pa-lh">
          <b className="pa-lh__j" aria-hidden="true">
            J{lens.j}
          </b>
          <div className="pa-lh__t">
            <h2 className="pa-lh__h" id="pa-lens-h" aria-label={lens.aria}>
              {lens.title}
            </h2>
            <p className="pa-lh__m">{lens.when}</p>
          </div>
          <div className="pa-lh__end">
            {lens.tabs.length > 0 && (
              <div className="vd-glass vd-seg pa-ltabs" role="tablist" aria-label="La jornada" style={{ "--n": lens.tabs.length, "--i": tabI } as CSSProperties}>
                <span className="vd-shelf__bead" aria-hidden="true" />
                {lens.tabs.map((b) => (
                  <button key={b.id} type="button" role="tab" className="vd-seg__b" aria-selected={b.on} aria-disabled={b.off} tabIndex={b.on ? 0 : -1} onClick={() => p.onLente(b.id, b.off)}>
                    {b.t}
                    {b.live && <span className="vd-livedot" role="img" aria-label="en juego" />}
                    {b.small && <small>{b.small}</small>}
                  </button>
                ))}
              </div>
            )}
            {lens.only && <span className="pa-only">{lens.only}</span>}
            <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press pa-cartel" onClick={p.onCartel} aria-haspopup="dialog" aria-label="El cartel">
              <Ic name="share" />
              <span>El cartel</span>
            </button>
            {lens.video && (
              <a className="vd-glass vd-btn vd-btn--sm vd-press pa-video" href={lens.video} target="_blank" rel="noopener noreferrer" aria-label="Ver el partido en YouTube (se abre en otra pestaña)">
                <SocialIcon name="youtube" className="pa-i" />
                <span>Vídeo</span>
              </a>
            )}
            <a className="vd-glass vd-btn vd-btn--sm vd-btn--pri vd-press pa-open" href={lens.href} onClick={p.goHref(lens.href)}>
              Abrir el partido
              <Ic name="chev-r" />
            </a>
          </div>
        </header>

        {lens.lente === "previa" && (
          <div className="pa-lb pa-pre">
            <div className="pa-col pa-pre__time">
              <p className="pa-big pa-big--time">
                <span>{pre.time}</span>
              </p>
              <p className="pa-pre__day">
                <b>{pre.day}</b>
                <span>{pre.dist}</span>
              </p>
              <div className="pa-sunr" role="img" aria-label={pre.sunAria}>
                <SunCurve m={sel} />
              </div>
              {pre.hasFc ? (
                <ol className="pa-wx" aria-label="El tiempo por horas">
                  {pre.fc.map((w) => (
                    <li key={w.h} className={w.cls}>
                      <span>{w.h}</span>
                      <Ic name="sun" />
                      <b>{w.t}°</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="pa-wxnone">
                  <Ic name="sun" />
                  <span>{pre.open ? `${pre.light}. El tiempo por horas sale tres días antes.` : `${pre.light}.`}</span>
                </p>
              )}
            </div>
            <div className="pa-col pa-pre__siete">
              <p className="pa-k">El siete</p>
              <div className="pa-pitch" aria-label={pre.pitchAria} role="img">
                <span className="pa-pitch__lines" aria-hidden="true" />
                {pre.ghosts.map((g) => (
                  <span key={`${g.x}-${g.y}`} className="pa-ghost" style={{ left: `${g.x}%`, top: `${g.y}%` }} aria-hidden="true" />
                ))}
                <p className="pa-ghostnote">{pre.ghostNote}</p>
              </div>
              {pre.open && p.rsvp}
              <div className="pa-h2h">
                <span className="vd-team__crest vd-team__crest--rival pa-crest" aria-hidden="true">
                  {lens.ini}
                </span>
                <p>
                  <b>{pre.h2hT}</b>
                  <span>{pre.h2hS}</span>
                </p>
              </div>
            </div>
            <div className="pa-col pa-pre__venue">
              <div className="pa-map" aria-hidden="true">
                <span className="pa-map__park" />
                <span className="pa-map__r1" />
                <span className="pa-map__r2" />
                <span className="pa-map__r3" />
                <span className="pa-map__pitch" />
                <Ic name="flag" className="pa-map__pin" />
                <span className="pa-map__lab">{lens.venue}</span>
              </div>
              <p className="pa-venue">
                <b>{lens.venue}</b>
                <span>{pre.place}</span>
              </p>
              <div className="pa-btns">
                <a className="vd-glass vd-btn vd-btn--sm vd-press" href={p.mapsHref} target="_blank" rel="noopener noreferrer">
                  <Ic name="flag" />
                  Cómo llegar
                </a>
                <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={p.onCal}>
                  <Ic name="cal" />
                  Al calendario
                </button>
              </div>
              <div className="pa-kit">
                <ShirtImg kit={pre.kitKey} alt={pre.kitAlt} className="pa-kit__img" size={54} />
                <p>
                  <b>{pre.kitT}</b>
                  <span>{pre.kitS}</span>
                </p>
              </div>
              {pre.open && p.notify}
            </div>
          </div>
        )}

        {lens.lente === "directo" && (
          <div className="pa-lb pa-dir">
            <div className="pa-col pa-dir__score">
              <div className="pa-teams">
                <div className="pa-team">
                  <img className="pa-crestimg" src={crest} alt="" width={64} height={64} />
                  <b>Manchester Piti</b>
                  <span>{lens.usWhere}</span>
                </div>
                <p className="pa-big pa-big--score" role="status" aria-label={dir.aria}>
                  <span>{dir.gf}</span>
                  <i aria-hidden="true">–</i>
                  <span>{dir.ga}</span>
                </p>
                <div className="pa-team">
                  <span className="vd-team__crest vd-team__crest--rival pa-crest pa-crest--l" aria-hidden="true">
                    {lens.ini}
                  </span>
                  <b className="pa-rival">{lens.rival}</b>
                  <span>{lens.themWhere}</span>
                </div>
              </div>
              <p className="pa-dir__min">
                {dir.live && (
                  <>
                    <span className="vd-live">En directo</span> <span className="vd-clock">{dir.min ?? 0}′</span>{" "}
                  </>
                )}
                {dir.half}
              </p>
              <div className="pa-mom" role="img" aria-label={dir.momAria}>
                <span className="pa-mom__axis" aria-hidden="true" />
                <span className="pa-mom__half" aria-hidden="true" />
                <span className="pa-mom__played" style={{ width: `${dir.playedW}%` }} aria-hidden="true" />
                {dir.marks.map((k) => (
                  <span key={k.i} className={`pa-mom__k ${k.cls}`} style={{ left: `${k.x}%` }} aria-hidden="true" />
                ))}
                <span className="pa-mom__lab pa-mom__lab--a" aria-hidden="true">
                  0′
                </span>
                <span className="pa-mom__lab pa-mom__lab--h" aria-hidden="true">
                  Descanso
                </span>
                <span className="pa-mom__lab pa-mom__lab--b" aria-hidden="true">
                  {dir.durT}
                </span>
              </div>
              <p className="pa-mesa">{dir.mesa}</p>
            </div>
            <div className="pa-col pa-dir__plays">
              <p className="pa-k">Jugada a jugada</p>
              <ol className="pa-plays">
                {dir.plays.map((y, i) => (
                  <li key={`${y.min}-${i}`} className={y.cls}>
                    <span className="vd-clock">{y.min}′</span>
                    <Ic name={y.icon} />
                    <span>
                      <b>{y.t}</b>
                      {y.s && <small>{y.s}</small>}
                    </span>
                  </li>
                ))}
              </ol>
              {!dir.plays.length && <p className="pa-more">Aún sin jugadas apuntadas.</p>}
              {dir.more && <p className="pa-more">{dir.more}</p>}
            </div>
            <div className="pa-col pa-dir__side">
              <p className="pa-k">{dir.fieldT}</p>
              <p className="pa-oncampo">{dir.field}</p>
              {dir.bench && <p className="pa-sub">{dir.bench}</p>}
              {p.porra && <p className="pa-porra">{p.porra}</p>}
              <div className="pa-acts">
                <a className="vd-glass vd-btn vd-btn--pri vd-press" href={lens.href} onClick={p.goHref(lens.href)}>
                  Abrir el partido
                </a>
                {dir.live && (
                  <button type="button" className="vd-glass vd-btn vd-press" onClick={p.onPip}>
                    <Ic name="pip" />
                    Sacar el marcador
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {lens.lente === "acta" && (
          <div className="pa-lb pa-acta">
            <div className="pa-col pa-acta__score">
              <div className="pa-teams">
                <div className="pa-team">
                  <img className="pa-crestimg" src={crest} alt="" width={64} height={64} />
                  <b>Manchester Piti</b>
                  <span>{lens.usWhere}</span>
                </div>
                <p className="pa-big pa-big--score" aria-label={act.aria}>
                  <span>{act.gf}</span>
                  <i aria-hidden="true">–</i>
                  <span>{act.ga}</span>
                </p>
                <div className="pa-team">
                  <span className="vd-team__crest vd-team__crest--rival pa-crest pa-crest--l" aria-hidden="true">
                    {lens.ini}
                  </span>
                  <b className="pa-rival">{lens.rival}</b>
                  <span>{lens.themWhere}</span>
                </div>
              </div>
              <p className="pa-final">{act.final}</p>
              <ol className="pa-goals" aria-label="Los goles">
                {act.goals.map((g, i) => (
                  <li key={`${g.min}-${i}`} className={g.cls}>
                    <span className="vd-clock">{g.min}</span>
                    <b>{g.t}</b>
                    <span>{g.s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="pa-col pa-acta__mid">
              <div className={`pa-mvp ${act.mvpCls}`}>
                <Ic name="star" />
                <div>
                  <small>{act.mvpK}</small>
                  <b>{act.mvpT}</b>
                  <span>{act.mvpS}</span>
                </div>
                {act.vote && (
                  <a className="vd-glass vd-btn vd-btn--sm vd-press" href={act.voteHref} onClick={p.goHref(act.voteHref)}>
                    Votar
                  </a>
                )}
              </div>
              {act.notas && (
                <>
                  <ul className="pa-notas" aria-label="Las notas">
                    {act.notas.top.map((r) => (
                      <li key={r.id} className={r.me ? "is-me" : undefined}>
                        <span className="pa-notas__who">
                          <b>{r.name}</b>
                          {r.me && <span className="pa-me">Tú</span>}
                        </span>
                        <Nota b={r} lg />
                      </li>
                    ))}
                    {act.notas.mine && (
                      <li className="is-me">
                        <span className="pa-notas__who">
                          <b>La tuya</b>
                          <span className="pa-me" aria-hidden="true">
                            Tú
                          </span>
                        </span>
                        <Nota b={act.notas.mine} lg />
                      </li>
                    )}
                  </ul>
                  <a className="vd-glass vd-btn vd-btn--sm vd-press pa-notas__all" href={act.notas.href} onClick={p.goHref(act.notas.href)}>
                    Ver todas las notas
                  </a>
                </>
              )}
              <p className="pa-k">{act.cronT}</p>
              <p className="pa-cron">{act.cron}</p>
              <ul className="pa-facts">
                {act.facts.map((f, i) => (
                  <li key={`${f.t}-${i}`}>
                    <Ic name={f.icon} />
                    <span>
                      <b>{f.t}</b> {f.s}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pa-col pa-acta__side">
              <p className="pa-k">{act.minT}</p>
              <ol className={`pa-mins${act.notas ? " pa-mins--notas" : ""}`}>
                {act.mins.map((r) => (
                  <li key={r.id} className={r.me ? "is-me" : undefined}>
                    <span className="pa-mins__n">{r.n}</span>
                    <b>{r.name}</b>
                    <span className="pa-mins__bar" aria-hidden="true">
                      {r.stints.map((s) => (
                        <i key={`${s.x}`} style={{ left: `${s.x}%`, width: `${s.w}%` }} />
                      ))}
                    </span>
                    <span className="pa-mins__v">{r.v}′</span>
                    {r.nota && <Nota b={r.nota} />}
                  </li>
                ))}
              </ol>
              <p className="pa-sub">{act.minS}</p>
              <div className="pa-acts">
                <a className="vd-glass vd-btn vd-btn--pri vd-press" href={lens.href} onClick={p.goHref(lens.href)}>
                  Ver todo el partido
                </a>
              </div>
            </div>
          </div>
        )}

        {lens.lente === "pp" && (
          <div className="pa-lb pa-pp">
            <p className="pa-pp__big">Aplazado</p>
            <div className="pa-pp__txt">
              <p className="pa-pp__l">{pp.line}</p>
              <p className="pa-sub">{pp.sub}</p>
              {p.ppNotify}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

/** A nota's badge: the figure on its band's colour, and the band's word for a screen reader. */
function Nota({ b, lg }: { b: NotaBadge; lg?: boolean }) {
  return (
    <>
      <span className={`nb nb--${b.k}${lg ? " nb--lg" : ""}`} aria-hidden="true">
        {b.t}
      </span>
      <span className="vd-vh">{b.aria}</span>
    </>
  );
}

type TileV = JV["tiles"][number];

function Tile({ t, onPick, onKey }: { t: TileV; onPick: (j: number) => void; onKey: (e: KeyboardEvent<HTMLButtonElement>) => void }) {
  return (
    <>
      {t.gap && (
        <span className="pa-gap" style={{ "--u": t.gapU } as CSSProperties} aria-hidden="true">
          <small>{t.gapL}</small>
        </span>
      )}
      <div className={`pa-slot ${t.slotCls}`} data-j={t.j} style={{ viewTransitionName: `pa-t${t.j}`, "--rd": `${t.rd}ms` } as CSSProperties}>
        <span className={`pa-paint ${t.paintCls}`} style={{ "--a": t.ga, "--b": t.gb, "--m0": `${t.m0}%`, "--m1": `${t.m1}%` } as CSSProperties} aria-hidden="true">
          <i className="pa-phz" />
          <i className="pa-pturf" />
          <i className="pa-pscr" />
          {t.sun && <i className={t.sunCls} style={{ left: `${t.sunX}%`, top: `${t.sunY}%` }} />}
          {t.floods && <i className="pa-pfl" />}
        </span>
        <button type="button" className={`pa-seg ${t.segCls}`} aria-pressed={t.sel} tabIndex={t.sel ? 0 : -1} aria-label={t.aria} onClick={() => onPick(t.j)} onKeyDown={onKey}>
          {t.sel && (
            <span className="vd-glass pa-cur" aria-hidden="true">
              <span className="vd-glint" />
            </span>
          )}
          <span className="pa-seg__top" aria-hidden="true">
            <b className="pa-seg__j">J{t.j}</b>
            <span className="pa-seg__d">{t.day}</span>
            <span className="pa-seg__d pa-seg__d--s">{t.tiny}</span>
            <span className="pa-seg__l">{t.light}</span>
          </span>
          <span className="pa-seg__res" aria-hidden="true">
            {t.cd && <span className="pa-seg__cd">{t.cd}</span>}
            {t.scoreT && (
              <span className="pa-seg__score">
                {t.scoreT}
                {t.liveMin !== null && (
                  <span className="vd-live">
                    <span className="vd-clock">{t.liveMin}′</span>
                  </span>
                )}
                {t.letter && <em className={`pa-seg__let pa-let--${t.lc}`}>{t.letter}</em>}
              </span>
            )}
            {t.pp && <span className="pa-seg__pp">Aplazado</span>}
            {t.pend && <span className="pa-seg__pp">Sin acta</span>}
            {(t.tu || t.video) && (
              <span className="pa-seg__xtra">
                {t.tu && (
                  <span className="pa-seg__tu">
                    Tú<span className={`nb nb--${t.tu.k}`}>{t.tu.t}</span>
                  </span>
                )}
                {t.video && (
                  <span className={`pa-seg__vid${t.tu ? " is-icon" : ""}`}>
                    <SocialIcon name="youtube" size={14} />
                    <span className="pa-seg__vidt">Vídeo</span>
                  </span>
                )}
              </span>
            )}
          </span>
          <span className="pa-seg__bot" aria-hidden="true">
            <b>{t.rival}</b>
            <span>{t.where}</span>
          </span>
        </button>
      </div>
    </>
  );
}
