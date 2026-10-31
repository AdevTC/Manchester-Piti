// «El palco» · Jugadores, ported from the prototype (Numeros.dc.html): the ranking (quick metrics, «Todas», the podium,
// the rows, the player's card and cara a cara, the gantt, rachas, hitos, marcas), «En el campo» (the constellation of
// goal passes and the spots), «Evolución», and the window «Toda la plantilla, en una tabla». The arithmetic is in
// jugadores.ts.
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Ic, PShirt, Seg, Win } from "./kit";
import { jugadores, plantilla, type JugView } from "./jugadoresView";
import type { PlaceProps } from "./types";

const css = (o: Record<string, string | number>) => o as CSSProperties;
const Tu = () => <span className="nx-you">Tú</span>;
const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
/** On a phone the card sits under the list: a pick brings it into view (a row of the whole table also moves the focus). */
const toCard = (focus: boolean) =>
  window.setTimeout(() => {
    const el = document.getElementById("nx-card");
    if (!el) return;
    if (focus) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }, 60);

export function Jugadores({ v, st, act }: PlaceProps) {
  if (st.grow === "jugadores") return <Plantilla v={v} st={st} act={act} />;
  const j = jugadores(v, st, act);
  const narrowPick = (pick: () => void) => () => {
    pick();
    if (act.narrow()) toCard(false);
  };
  return (
    <section aria-labelledby="nx-j-h">
      <header className="nx-head">
        <div className="nx-head__t">
          <p className="nx-kick">{j.kick}</p>
          <h2 className="nx-h2" id="nx-j-h">
            {j.title}
          </h2>
          <p className="nx-sub">{j.sub}</p>
        </div>
      </header>
      <div className="nx-ctl">
        <Seg label="Qué estadística" className={j.quickOn ? "" : "is-none"} style={{ minWidth: "min(100%,520px)" }} opts={j.quick} />
        <button type="button" className={`vd-glass vd-press nx-btn ${j.moreCls}`.trim()} aria-haspopup="dialog" onClick={j.openStats}>
          <Ic name="grid" />
          {j.moreT}
        </button>
        <Seg label="Cómo verlos" style={{ minWidth: "min(100%,400px)" }} opts={j.views} />
      </div>
      {j.note && <p className="nx-note nx-note--top">{j.note}</p>}

      {j.isRank && <Ranking j={j} narrowPick={narrowPick} />}
      {j.isCampo && <Campo j={j} />}
      {j.isEvo && <Evo j={j} />}
    </section>
  );
}

function Ranking({ j, narrowPick }: { j: JugView; narrowPick: (pick: () => void) => () => void }) {
  return (
    <>
      <div className="nx-cols">
        <div>
          {j.locked && (
            <div className="vd-glass vd-glass--deep nx-glass nx-door">
              <Ic name="lock" />
              <div>
                <h3 className="nx-h3">La porra es del vestuario</h3>
                <p className="nx-sheet__p">La clasificación de la porra solo la ve el equipo. Si eres del Piti, entra y sale aquí. Mientras, el resto de rankings es para todos.</p>
                <Link className="vd-glass vd-press nx-btn" to="/vestuario">
                  Entrar al vestuario
                </Link>
              </div>
            </div>
          )}
          {j.porraEmpty && <p className="nx-note">{j.porraEmpty}</p>}
          {j.podium.length > 0 && (
            <div className={`nx-podium ${j.podCls}`}>
              {j.podium.map((p) => (
                <button key={p.key} type="button" className={`nx-pod ${p.lvl}`} aria-pressed={p.on} aria-label={p.aria} onClick={narrowPick(p.pick)}>
                  <span className="nx-pod__v">{p.val}</span>
                  <PShirt n={p.n} size={p.s} />
                  <span className="nx-pod__n">
                    {p.name}
                    {p.you && <Tu />}
                  </span>
                  <span className="nx-pod__base">{p.rk}</span>
                </button>
              ))}
            </div>
          )}
          {j.onlyOne && <p className="nx-note">{j.onlyOne}</p>}
          {j.rows.length > 0 && (
            <ul className="nx-rklist" aria-label={j.listAria}>
              {j.rows.map((r) => (
                <li key={r.key}>
                  <button type="button" className={`nx-rkr ${r.cls}`.trim()} aria-pressed={r.on} aria-label={r.aria} onClick={narrowPick(r.pick)}>
                    <span className="nx-rkr__p">{r.rk}</span>
                    <PShirt n={r.n} className="nx-shirt" />
                    <span className="nx-rkr__n">
                      {r.name}
                      {r.you && <Tu />}
                    </span>
                    <span className="nx-rkr__b" aria-hidden="true">
                      <i style={{ width: `${r.w}%` }} />
                    </span>
                    <span className="nx-rkr__v">{r.val}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="nx-links">
            {j.hasMore && (
              <button type="button" className="nx-lnk" onClick={j.toggleAll}>
                {j.allT}
              </button>
            )}
            <button type="button" className="nx-lnk" onClick={j.openTable}>
              Toda la plantilla, en una tabla
            </button>
          </div>
          <div className="nx-racecap">
            {j.meLine && (
              <span>
                <b>{j.meLine}</b>
              </span>
            )}
            {j.race.map((t) => (
              <span key={t}>{t}</span>
            ))}
            {j.voteOpen && (
              <span>
                <Ic name="star" />
                {j.voteOpen}
              </span>
            )}
            {j.mvpList.length > 0 && (
              <span>
                Los MVP, jornada a jornada: {j.mvpList.map((m, i) => (
                  <span key={m.key}>
                    {i > 0 && " · "}
                    {m.j} <b>{m.name}</b>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="nx-side">{j.showCard && (j.isVs ? <Versus j={j} /> : <PlayerCard j={j} />)}</div>
      </div>

      <section className="nx-sec" aria-labelledby="nx-gantt-h">
        <div className="nx-sec__head">
          <h3 className="nx-h3" id="nx-gantt-h">
            {j.ganttT}
          </h3>
          <p className="nx-meta">Cada barra, los minutos en el campo</p>
        </div>
        {j.gantt.length > 0 ? (
          <>
            <div className="nx-gantt">
              {j.gantt.map((g) => (
                <div key={g.key} className={`nx-gt ${g.cls}`.trim()} role="img" aria-label={g.label}>
                  <span className="nx-gt__n">{g.name}</span>
                  <span className="nx-gt__t">
                    {g.st.map((s) => (
                      <i key={s.key} style={{ left: `${s.l}%`, width: `${s.w}%` }} />
                    ))}
                  </span>
                  <span className="nx-gt__v">{g.min}′</span>
                </div>
              ))}
            </div>
            <div className="nx-gt-ax" aria-hidden="true">
              <span />
              <span>
                <span>0′</span>
                <span>10′</span>
                <span>20′</span>
                <span>30′</span>
                <span>40′</span>
                <span>50′</span>
              </span>
              <span />
            </div>
            {j.ganttNote && <p className="nx-note">{j.ganttNote}</p>}
          </>
        ) : (
          <p className="nx-note">{j.ganttNone || "Aún no hay minutos registrados."}</p>
        )}
      </section>

      <div className="nx-cols">
        <section className="nx-sec" aria-labelledby="nx-jr-h">
          <div className="nx-sec__head">
            <h3 className="nx-h3" id="nx-jr-h">
              Rachas de los jugadores
            </h3>
            <p className="nx-meta">{j.streakSub}</p>
          </div>
          <Seg label="Qué racha" scroll style={{ marginBottom: 12 }} opts={j.streakOpts} />
          <div>
            {j.streaks.map((r) => (
              <div key={r.key} className="nx-streak">
                <span className="nx-streak__n">{r.cur}</span>
                <span className="nx-streak__t">
                  {r.name}
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
          {j.noStreaks && <p className="nx-note">Nadie lleva esta racha ahora mismo.</p>}
        </section>
        <div>
          <section className="nx-sec" aria-labelledby="nx-hitos-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-hitos-h">
                Próximos hitos
              </h3>
            </div>
            <div>
              {j.hitos.map((h) => (
                <div key={h.key} className="nx-hito">
                  <b>{h.name}</b>
                  <span>
                    {h.g} / {h.step} · {h.t}
                  </span>
                  <span className="nx-hito__b" aria-hidden="true">
                    <i style={{ width: `${h.w}%` }} />
                  </span>
                </div>
              ))}
            </div>
            {j.hitos.length === 0 && <p className="nx-note">El primer gol pone en marcha los hitos.</p>}
          </section>
          <section className="nx-sec" aria-labelledby="nx-ir-h">
            <div className="nx-sec__head">
              <h3 className="nx-h3" id="nx-ir-h">
                Marcas de los jugadores
              </h3>
            </div>
            <div>
              {j.indRec.map((r) => (
                <button key={r.key} type="button" className="nx-ir" onClick={r.pick}>
                  <PShirt n={r.n} size={34} className="nx-shirt" />
                  <span>
                    <span className="nx-ir__t">{r.t}</span>
                    <span className="nx-ir__l">{r.line}</span>
                  </span>
                  <span className="nx-ir__v">{r.v}</span>
                </button>
              ))}
            </div>
            {j.indRec.length === 0 && <p className="nx-note">Sin registros en este período.</p>}
            <div className="nx-multi">
              <p className="nx-sheet__lab">Dobletes, hat-tricks y asistencias múltiples</p>
              {j.multi.length > 0 ? (
                <div className="nx-conn">
                  {j.multi.map((m) => (
                    <div key={m.key} className="nx-conn__r">
                      <span>{m.name}</span>
                      <b>{m.t}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="nx-sheet__p">{j.multiNone}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function PlayerCard({ j }: { j: JugView }) {
  const c = j.card;
  return (
    <article id="nx-card" tabIndex={-1} className="vd-glass vd-glass--deep nx-glass" aria-labelledby="nx-card-h">
      <div className="nx-card__head">
        <PShirt n={c.n} size={84} />
        <div>
          <h3 className="nx-card__name" id="nx-card-h">
            {c.name}
            {c.you && <Tu />}
          </h3>
          {c.full && <p className="nx-card__full">{c.full}</p>}
          <p className="nx-card__pos">{c.pos}</p>
        </div>
      </div>
      <div className="nx-tiles">
        {c.tiles.map((x) => (
          <div key={x.key} className={`nx-tile ${x.cls}`.trim()}>
            <b>{x.v}</b>
            <span>{x.t}</span>
          </div>
        ))}
      </div>
      {c.hasStints && (
        <div className="nx-mins">
          <p className="nx-mins__k">
            <span>{c.stintT}</span>
            <span>0′–50′</span>
          </p>
          <div className="nx-mins__bar" aria-hidden="true">
            {c.stints.map((s) => (
              <i key={s.key} style={{ left: `${s.l}%`, width: `${s.w}%` }} />
            ))}
          </div>
        </div>
      )}
      <ul className="nx-heat" aria-label="Sus jornadas">
        {c.heat.map((h) => (
          <li key={h.key} className={h.cls || undefined} aria-label={h.label}>
            <span aria-hidden="true">
              <b>{h.g}</b>
              {h.j}
            </span>
          </li>
        ))}
      </ul>
      <dl className="nx-rates">
        {c.rates.map((x) => (
          <div key={x.key}>
            <dt>{x.t}</dt>
            <dd>{x.v}</dd>
          </div>
        ))}
      </dl>
      <div className="nx-acts2">
        <Link className="vd-glass vd-press nx-btn" to={c.href}>
          Su ficha
        </Link>
        <button type="button" className="vd-glass vd-press nx-btn" onClick={j.startVs}>
          <Ic name="vs" />
          Cara a cara
        </button>
      </div>
    </article>
  );
}

function Versus({ j }: { j: JugView }) {
  const s = j.vs;
  return (
    <article id="nx-card" tabIndex={-1} className="vd-glass vd-glass--deep nx-glass" aria-labelledby="nx-vs-h">
      <div className="nx-sec__head" style={{ marginBottom: 12 }}>
        <h3 className="nx-h3 nx-h3--g" id="nx-vs-h">
          Cara a cara
        </h3>
        <button type="button" className="nx-lnk" onClick={j.endVs}>
          Volver a la ficha
        </button>
      </div>
      <div className="nx-vs">
        <div className="nx-vs__p">
          <PShirt n={s.a.n} size={70} />
          <b>{s.a.name}</b>
        </div>
        <span className="nx-vs__x">vs</span>
        <div className="nx-vs__p">
          <PShirt n={s.b.n} size={70} />
          <b>{s.b.name}</b>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {s.rows.map((r) => (
          <div key={r.key} className={`nx-vsr ${r.cls}`.trim()} role="group" aria-label={r.aria}>
            <span className="nx-vsr__t" aria-hidden="true">
              {r.t}
            </span>
            <span className="nx-vsr__a" aria-hidden="true">
              {r.a}
            </span>
            <span className="nx-vsr__l" aria-hidden="true">
              <i style={{ width: `${r.aw}%` }} />
            </span>
            <span className="nx-vsr__r" aria-hidden="true">
              <i style={{ width: `${r.bw}%` }} />
            </span>
            <span className="nx-vsr__b" aria-hidden="true">
              {r.b}
            </span>
          </div>
        ))}
      </div>
      <p className="nx-note" style={{ color: "var(--vd-g-ink2)" }} aria-live="polite">
        {s.sum}
      </p>
      <p className="nx-sheet__lab" style={{ marginTop: 16 }}>
        Con quién lo comparas
      </p>
      <div className="nx-pk">
        {s.opts.map((o) => (
          <button key={o.key} type="button" className="vd-glass nx-pick" aria-pressed={o.on} onClick={o.pick}>
            <PShirt n={o.n} />
            {o.t}
          </button>
        ))}
      </div>
    </article>
  );
}

function Campo({ j }: { j: JugView }) {
  return (
    <>
      <Seg label="El campo" style={{ maxWidth: 380, marginBottom: 18 }} opts={j.cvOpts} />
      {j.isPases && (
        <div className="nx-cols">
          <div>
            <div className="nx-pitch nx-pitch--h">
              <div className="vd-pitch" aria-hidden="true" />
              <svg className="nx-lines" viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="6" y="6" width="288" height="138" rx="6" />
                <line x1="150" y1="6" x2="150" y2="144" />
                <circle cx="150" cy="75" r="20" />
                <rect x="6" y="40" width="34" height="70" />
                <rect x="260" y="40" width="34" height="70" />
              </svg>
              <svg className="nx-arcs" viewBox="0 0 300 140" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                {j.arcs.d1 && <path className="a1" d={j.arcs.d1} />}
                {j.arcs.d2 && <path className="a2" d={j.arcs.d2} />}
                {j.arcs.d3 && <path className="a3" d={j.arcs.d3} />}
                {j.arcs.dSel && <path className="aS" d={j.arcs.dSel} />}
              </svg>
              {j.stars.map((s) => (
                <button key={s.key} type="button" className={`nx-star ${s.cls}`.trim()} style={{ left: `${s.left}%`, top: `${s.top}%` }} aria-pressed={s.on} aria-label={s.label} onClick={s.pick}>
                  <span className="nx-star__d" style={{ width: s.size, height: s.size }} />
                  <span className="nx-star__n">{s.name}</span>
                </button>
              ))}
            </div>
            <p className="nx-note">Atacamos hacia la derecha. Cada estrella, un jugador en su sitio habitual: más grande, más goles y asistencias. Cada línea, un pase de gol; más gruesa, más goles. Toca una estrella.</p>
          </div>
          <div className="nx-side">
            <div className="vd-glass vd-glass--deep nx-glass" aria-live="polite">
              {j.starSel ? (
                <>
                  <div className="nx-card__head">
                    <PShirt n={j.starSel.n} size={60} />
                    <div>
                      <h3 className="nx-card__name">{j.starSel.name}</h3>
                      <p className="nx-card__pos">{j.starSel.line}</p>
                    </div>
                  </div>
                  <p className="nx-sheet__lab" style={{ marginTop: 18 }}>
                    Le asisten
                  </p>
                  <div className="nx-conn">
                    {j.starSel.gives.map((x) => (
                      <div key={x.key} className="nx-conn__r">
                        <span>{x.t}</span>
                        <b>{x.n}</b>
                      </div>
                    ))}
                  </div>
                  {j.starSel.noGives && <p className="nx-sheet__p">Nadie le ha dado un pase de gol todavía.</p>}
                  <p className="nx-sheet__lab" style={{ marginTop: 16 }}>
                    Asiste a
                  </p>
                  <div className="nx-conn">
                    {j.starSel.takes.map((x) => (
                      <div key={x.key} className="nx-conn__r">
                        <span>{x.t}</span>
                        <b>{x.n}</b>
                      </div>
                    ))}
                  </div>
                  {j.starSel.noTakes && <p className="nx-sheet__p">Aún no ha dado un pase de gol.</p>}
                  <div className="nx-links">
                    <button type="button" className="nx-lnk" onClick={j.starSel.open}>
                      Sus números
                    </button>
                    <button type="button" className="nx-lnk" onClick={j.starSel.clear}>
                      Ver todas las líneas
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="nx-h3 nx-h3--g">Las conexiones de la temporada</h3>
                  {j.noLinks ? (
                    <p className="nx-sheet__p" style={{ marginTop: 14 }}>
                      {j.pasesSub}
                    </p>
                  ) : (
                    <div className="nx-conn" style={{ marginTop: 14 }}>
                      {j.top.map((x) => (
                        <div key={x.key} className="nx-conn__r">
                          <span>{x.t}</span>
                          <b>{x.n}</b>
                          <span className="nx-conn__b" aria-hidden="true">
                            <i style={{ width: `${x.w}%` }} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {j.isPuestos && (
        <div className="nx-cols">
          <div>
            <div className="nx-pitch nx-pitch--v">
              <div className="vd-pitch" aria-hidden="true" />
              <svg className="nx-lines" viewBox="0 0 100 118" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="3" y="3" width="94" height="112" rx="3" />
                <line x1="3" y1="59" x2="97" y2="59" />
                <circle cx="50" cy="59" r="11" />
                <rect x="28" y="3" width="44" height="16" />
                <rect x="28" y="99" width="44" height="16" />
              </svg>
              {j.spots.map((s) => (
                <button key={s.key} type="button" className={`nx-spot ${s.cls}`.trim()} style={{ left: `${s.x}%`, top: `${s.y}%` }} aria-pressed={s.on} aria-label={s.label} onClick={s.pick}>
                  <span className="nx-spot__c">{s.code}</span>
                  <span className="nx-spot__n">{s.owner}</span>
                  <span className="nx-spot__m">{s.min}</span>
                </button>
              ))}
            </div>
            <p className="nx-note">Nuestra portería abajo. Cada puesto, con su dueño: quien más minutos ha jugado ahí.</p>
            {j.noPos ? <p className="nx-note">{j.noPos}</p> : j.unused && <p className="nx-note">{j.unused}</p>}
          </div>
          <div className="nx-side">
            <div className="vd-glass vd-glass--deep nx-glass" aria-live="polite">
              <p className="nx-sheet__k">{j.spot.code}</p>
              <h3 className="nx-card__name">{j.spot.name}</h3>
              <p className="nx-card__pos">{j.spot.line}</p>
              <div className="nx-who">
                {j.spot.who.map((w) => (
                  <div key={w.key} className="nx-who__r">
                    <span>
                      <b>{w.name}</b>
                      {w.ga && <small>{w.ga}</small>}
                    </span>
                    <span className="nx-who__b" aria-hidden="true">
                      <i style={{ width: `${w.w}%` }} />
                    </span>
                    <span>{w.min}′</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Evo({ j }: { j: JugView }) {
  return (
    <>
      <Seg label="Qué evolución" style={{ maxWidth: 560, marginBottom: 18 }} opts={j.evoOpts} />
      <div className="nx-evo">
        <svg viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-label={j.evoAria}>
          <g className="nx-evo__grid">
            <line x1="0" y1="40" x2="600" y2="40" />
            <line x1="0" y1="80" x2="600" y2="80" />
            <line x1="0" y1="120" x2="600" y2="120" />
            <line x1="0" y1="160" x2="600" y2="160" />
          </g>
          {j.evoLines.map((l) => (l.d ? <path key={l.key} className={l.cls} d={l.d} /> : null))}
        </svg>
        <p className="nx-evo__ax">
          <span>{j.evoFrom}</span>
          <span>{j.evoTo}</span>
        </p>
      </div>
      {j.evoKeys.length > 0 ? (
        <p className="nx-keys">
          {j.evoKeys.map((k) => (
            <span key={k.key} className={k.cls}>
              <i aria-hidden="true" />
              {k.name} <b>{k.v}</b>
            </span>
          ))}
        </p>
      ) : (
        <p className="nx-note">Sin datos todavía.</p>
      )}
      {j.evoOne && <p className="nx-note">Con una jornada, cada línea es un solo paso: la evolución se dibuja jornada a jornada.</p>}
      <p className="nx-note">Las líneas acumulan jornada a jornada, con trazo y color distintos para cada uno. Salen los seis primeros; elige a quién seguir, hasta seis.</p>
      <div className="nx-pk" role="group" aria-label="A quién seguir (hasta seis)">
        {j.evoPeople.map((p) => (
          <button key={p.key} type="button" className="vd-glass nx-pick" aria-pressed={p.on} onClick={p.pick}>
            {p.t}
          </button>
        ))}
      </div>
    </>
  );
}

/** «Toda la plantilla, en una tabla»: the window that grows over Jugadores. */
function Plantilla({ v, st, act }: PlaceProps) {
  const gj = plantilla(v, st, act);
  return (
    <Win
      id="nx-gj-h"
      title="Toda la plantilla, en una tabla"
      back="Jugadores"
      onClose={() => act.grow(null)}
      actions={
        <button type="button" className="vd-glass vd-press nx-btn" onClick={gj.csv}>
          <Ic name="download" />
          Descargar CSV
        </button>
      }
    >
      <div className="nx-catbar" style={{ marginBottom: 14 }}>
        <Seg label="Qué columnas" scroll opts={gj.sets} />
        <label className="vd-glass nx-field">
          <Ic name="search" />
          <span className="nx-vh">Buscar jugador</span>
          <input type="search" value={gj.q} onChange={(e) => gj.setQ(e.target.value)} placeholder="Buscar jugador o dorsal" />
        </label>
      </div>
      <p className="nx-win__lead">{gj.count} Toca una cabecera para ordenar; toca a un jugador para ver su ficha.</p>
      <div className="nx-tscroll" tabIndex={0} role="region" aria-label="Toda la plantilla, con desplazamiento lateral">
        <table className="nx-tbl">
          <caption className="nx-vh">Toda la plantilla</caption>
          <thead>
            <tr>
              <th scope="col" className="nx-tbl__p">
                Jugador
              </th>
              {gj.cols.map((c) => (
                <th key={c.key} scope="col" aria-sort={c.aria}>
                  <button type="button" className="nx-sort" aria-pressed={c.on} onClick={c.pick}>
                    {c.t}
                    <Ic name={c.ic} />
                  </button>
                </th>
              ))}
              <th scope="col">Sus jornadas</th>
            </tr>
          </thead>
          <tbody>
            {gj.rows.map((r) => (
              <tr key={r.key} className={r.cls || undefined}>
                <th scope="row" className="nx-tbl__p">
                  <button
                    type="button"
                    className="nx-lnk nx-tbl__who"
                    style={css({ textDecoration: "none", color: "inherit" })}
                    onClick={() => {
                      r.pick();
                      toCard(true);
                    }}
                  >
                    <PShirt n={r.n} />
                    {r.name}
                    {r.you && <Tu />}
                  </button>
                </th>
                {r.cells.map((c) => (
                  <td key={c.key} className={c.cls || undefined}>
                    {c.v}
                  </td>
                ))}
                <td>
                  <span className="nx-heat nx-heat--row" role="img" aria-label={r.heatAria}>
                    {r.heat.map((h) => (
                      <span key={h.key} className={h.cls || undefined}>
                        <span>
                          <b>{h.g}</b>
                        </span>
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gj.empty && <p className="nx-note">Ningún jugador coincide con la búsqueda.</p>}
    </Win>
  );
}
