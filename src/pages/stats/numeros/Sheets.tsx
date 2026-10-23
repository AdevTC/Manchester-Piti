// «Números»: the sheets over the open screen (NU- boards) — «Busca o pregunta», each «?», «Qué números ver»,
// «¿Y si…?», a player's numbers, a rival's dossier and a statistic's card. The scrim and Esc close them; the page
// gives the focus back.
import type { CSSProperties, ReactNode, Ref } from "react";
import type { NuState, NuView } from "./view";
import { I } from "./bits";
import { A, CardNumbers, RivalFacts, RivalGames } from "./Screens";
import { Shirt } from "./bits";

type V = NuView;
const css = (o: Record<string, string | number>) => o as CSSProperties;

function Close({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="vd-glass vd-press vd-ibtn" onClick={onClose} aria-label="Cerrar">
      <I name="close" />
    </button>
  );
}
function Sheet({ id, wide, className, children, sheetRef }: { id: string; wide?: boolean; className?: string; children: ReactNode; sheetRef: Ref<HTMLElement> }) {
  return (
    <section ref={sheetRef} tabIndex={-1} className={`vd-glass vd-glass--deep vd-sheet nu-sheet${wide ? " nu-sheet--wide" : ""}${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}>
      {children}
    </section>
  );
}
function SegRow({ label, opts, i }: { label: string; opts: { t: string; on: boolean; pick: () => void }[]; i: number }) {
  return (
    <div className="vd-glass vd-seg" role="radiogroup" aria-label={label} style={css({ "--n": opts.length, "--i": i })}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.t} type="button" role="radio" className="vd-seg__b" aria-checked={o.on} onClick={o.pick}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function Sheets({ v, st, onClose, openSearch, infoScope, numOf, sheetRef }: { v: V; st: NuState; onClose: () => void; openSearch: () => void; infoScope: () => void; numOf: (id: string) => number | ""; sheetRef: Ref<HTMLElement> }) {
  if (!st.sheet) return null;
  let body: ReactNode = null;
  if (st.sheet === "search") {
    const s = v.search;
    body = (
      <Sheet id="nu-s-find" wide className="nu-sheet--search" sheetRef={sheetRef}>
        <div className="nu-sheet__top">
          <header className="nu-sheet__head">
            <h2 id="nu-s-find">Busca o pregunta</h2>
            <Close onClose={onClose} />
          </header>
          <label className="nu-field">
            <span className="vd-vh">Buscar en Números</span>
            <input className="vd-input nu-find__in" type="search" value={s.q} onChange={(e) => s.setQ(e.target.value)} placeholder="Alcides, Orduña, pases, minutos, racha…" />
          </label>
        </div>
        {s.has && (
          <ul className="nu-res">
            {s.res.map((r) => (
              <li key={r.key}>
                <button type="button" className="nu-res__b" onClick={r.go}>
                  <em>{r.g}</em>
                  <b>{r.t}</b>
                  <small>{r.s}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {s.none && <p className="nu-sheet__p">{s.noneT}</p>}
        {s.empty && (
          <>
            <h3 className="nu-h4">Lo que más se pregunta</h3>
            <ul className="nu-asks nu-asks--sheet">
              {s.all.map((a) => (
                <li key={a.key}>
                  <button type="button" className="nu-ask" onClick={a.go}>
                    {a.t}
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="nu-h4">Dónde está cada cosa</h3>
            <ul className="nu-map">
              {s.map.map((m) => (
                <li key={m.key}>
                  <button type="button" className="nu-map__b" onClick={m.go}>
                    <b>{m.t}</b>
                    <span>{m.d}</span>
                    <I name="chev-r" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Sheet>
    );
  } else if (st.sheet === "info") {
    const i = v.infoS;
    body = (
      <Sheet id="nu-s-info" sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <I name="help" className="nu-sheet__ic" />
          <h2 id="nu-s-info">{i.t}</h2>
          <Close onClose={onClose} />
        </header>
        <p className="nu-info__d">{i.d}</p>
        {i.extra && <p className="nu-sheet__p">{i.extra}</p>}
        {i.where && <p className="nu-sheet__p">Dónde: {i.where}</p>}
        <div className="nu-sheet__btns">
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={onClose}>
            Entendido
          </button>
          <button type="button" className="vd-link" onClick={openSearch}>
            Buscar otra cosa
          </button>
        </div>
      </Sheet>
    );
  } else if (st.sheet === "scope") {
    const s = v.scope;
    body = (
      <Sheet id="nu-s-scope" wide sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <h2 id="nu-s-scope">Qué números ver</h2>
          <Close onClose={onClose} />
        </header>
        <p className="nu-sheet__p">Un solo período para todas las pantallas. La tabla de la liga es siempre la de hoy; lo demás sigue lo que elijas. Las jornadas, con la moviola.</p>
        <h3 className="nu-h4">Temporada</h3>
        <SegRow label="Temporada" opts={s.seasonOpts} i={s.seasonI} />
        <h3 className="nu-h4">Dónde</h3>
        <SegRow label="Dónde" opts={s.campoOpts} i={s.campoI} />
        <h3 className="nu-h4">
          Partidos <small>(ninguno elegido: todos)</small>
        </h3>
        <ul className="nu-chips" aria-label="Partidos del período">
          {s.matches.map((m) => (
            <li key={m.key}>
              <button type="button" className="nu-chip nu-chip--stat" aria-pressed={m.on} onClick={m.pick}>
                {m.t} <small>{m.s}</small>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="nu-h4">
          Jugadores <small>(ninguno elegido: todos)</small>
        </h3>
        <ul className="nu-chips" aria-label="Jugadores del período">
          {s.people.map((p) => (
            <li key={p.key}>
              <button type="button" className="nu-chip" aria-pressed={p.on} onClick={p.pick}>
                <i>{p.n}</i>
                {p.t}
              </button>
            </li>
          ))}
        </ul>
        {s.players && <p className="nu-sheet__p">Las tablas y los rankings muestran los jugadores elegidos; los resultados del equipo conservan a todos.</p>}
        <p className="nu-sheet__count">{s.count}</p>
        <div className="nu-sheet__btns">
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={onClose}>
            Ver los números
          </button>
          <button type="button" className="vd-link" onClick={s.clear}>
            Quitar filtros
          </button>
          <button type="button" className="vd-link" onClick={infoScope}>
            ¿Cómo funciona?
          </button>
        </div>
      </Sheet>
    );
  } else if (st.sheet === "ysi") {
    const y = v.ysi;
    body = (
      <Sheet id="nu-s-ysi" wide sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <h2 id="nu-s-ysi">¿Y si…?</h2>
          <Close onClose={onClose} />
        </header>
        <p className="nu-sheet__p">Pon resultados de mentira a lo que queda y mira dónde acabaríamos. {y.note}</p>
        <div className="nu-ysi__counts">
          {y.counts.map((c) => (
            <p key={c.t} className="vd-count">
              <b>{c.v}</b>
              <span>{c.t}</span>
            </p>
          ))}
        </div>
        <div className="nu-ysi__fill">
          <span>Rellenar el resto:</span>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={y.fillG}>
            Todo victorias
          </button>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={y.fillAsi}>
            Como hasta ahora
          </button>
          <button type="button" className="vd-glass vd-press vd-btn vd-btn--sm" onClick={y.fillP}>
            Todo derrotas
          </button>
        </div>
        <ul className="nu-ysi">
          {y.rows.map((r) => (
            <li key={r.key}>
              <span className="nu-ysi__t">
                <b>
                  {r.j} · {r.rival}
                </b>
                <small>{r.where}</small>
              </span>
              <span className="nu-ysi__b" role="group" aria-label={r.lab}>
                <button type="button" className="nu-gep nu-gep--g" aria-pressed={r.g} onClick={r.pg} aria-label="Ganamos">
                  G
                </button>
                <button type="button" className="nu-gep nu-gep--e" aria-pressed={r.e} onClick={r.pe} aria-label="Empatamos">
                  E
                </button>
                <button type="button" className="nu-gep nu-gep--p" aria-pressed={r.p} onClick={r.pp} aria-label="Perdemos">
                  P
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="nu-sheet__btns">
          <button type="button" className="vd-glass vd-press vd-btn" onClick={y.real}>
            Volver a lo real
          </button>
        </div>
      </Sheet>
    );
  } else if (st.sheet === "player" && v.pl) {
    const p = v.pl;
    body = (
      <Sheet id="nu-s-pl" sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <Shirt className="nu-sheet__shirt" num={numOf(p.id)} alt={p.alt} />
          <div className="nu-sheet__who">
            <h2 id="nu-s-pl">
              {p.name}
              {p.you && <i className="nu-tu">Tú</i>}
            </h2>
            {p.full && <p>{p.full}</p>}
            <p>{[p.pos, p.scopeT].filter(Boolean).join(" · ")}</p>
          </div>
          <Close onClose={onClose} />
        </header>
        <CardNumbers c={p} />
        <div className="nu-sheet__btns">
          <A className="vd-glass vd-press vd-btn vd-btn--pri" href={p.href}>
            Su ficha
          </A>
          <A className="vd-glass vd-press vd-btn" href={p.duel}>
            Cara a cara con…
          </A>
        </div>
      </Sheet>
    );
  } else if (st.sheet === "rival" && v.rv) {
    const d = v.rv;
    body = (
      <Sheet id="nu-s-rv" sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <span className="vd-team__crest vd-team__crest--rival nu-dossier__crest" aria-hidden="true">
            {d.ini}
          </span>
          <div className="nu-sheet__who">
            <h2 id="nu-s-rv">{d.rival}</h2>
            <p>{d.rec}</p>
          </div>
          <Close onClose={onClose} />
        </header>
        <RivalGames d={d} />
        <RivalFacts d={d} />
      </Sheet>
    );
  } else if (st.sheet === "metric") {
    const m = v.mt;
    body = (
      <Sheet id="nu-s-mt" sheetRef={sheetRef}>
        <header className="nu-sheet__head">
          <div className="nu-sheet__who">
            <p>{m ? `${m.fam} · ${m.id}` : st.sheetId}</p>
            <h2 id="nu-s-mt">{m ? m.t : "Cargando la ficha…"}</h2>
          </div>
          <Close onClose={onClose} />
        </header>
        {m && (
          <>
            <p className="nu-mt__v">
              <b>{m.v}</b>
              <span className={`nu-fig__st ${m.cls}`}>{m.st}</span>
            </p>
            <p className="nu-info__d">{m.def}</p>
            <p className="nu-sheet__p">{m.why}</p>
            <dl className="nu-dl">
              <div>
                <dt>Para quién</dt>
                <dd>{m.scope}</dd>
              </div>
              <div>
                <dt>Qué tiene que narrar la mesa</dt>
                <dd>{m.narr}</dd>
              </div>
            </dl>
            <h3 className="nu-h4">Jugadas y registros</h3>
            <ul className="nu-ev">
              {m.evid.map((e) => (
                <li key={e.key}>
                  <A href={e.href}>
                    <b>{e.t}</b>
                    <span>{e.d}</span>
                  </A>
                </li>
              ))}
            </ul>
            {m.noEv && <p className="nu-sheet__p">Sin jugadas que mostrar en este período.</p>}
            {m.evMore && <p className="nu-sheet__p">{m.evMore} en el catálogo.</p>}
          </>
        )}
      </Sheet>
    );
  }
  if (!body) return null;
  return (
    <>
      <div className="nu-scrim" onClick={onClose} aria-hidden="true" />
      {body}
    </>
  );
}
