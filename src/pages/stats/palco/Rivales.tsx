// «El palco» · Rivales: the next rival (or today's), every rival of the league with its record, its last letters,
// its goals for and against and its next date; the chosen one's dossier with every game. The arithmetic is in
// rivalesView.ts; the escudos are the ones the actas saved (RivalMark falls back to the initials).
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { RivalMark } from "../../../components/vidrio/RivalMark";
import { Ic } from "./kit";
import { rivalesView } from "./rivalesView";
import type { PlaceProps } from "./types";

function Crest({ logo, ini, big }: { logo?: string; ini: string; big?: boolean }) {
  return (
    <span className={`nx-ini${big ? " nx-ini--big" : ""}`} aria-hidden="true">
      <RivalMark logo={logo}>{ini}</RivalMark>
    </span>
  );
}

export function Rivales({ v, act }: PlaceProps) {
  const r = rivalesView(v.rivales, act);
  const dos = useRef<HTMLHeadingElement>(null);
  // on a phone the dossier is under the list: picking a rival takes you (and the focus) to it
  const show = (pick: () => void) => () => {
    pick();
    if (!act.narrow()) return;
    window.setTimeout(() => {
      const h = dos.current;
      if (!h) return;
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      h.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      h.focus({ preventScroll: true });
    }, 40);
  };
  return (
    <section aria-labelledby="nx-r-h">
      <header className="nx-head">
        <div className="nx-head__t">
          <p className="nx-kick">{r.kick}</p>
          <h2 className="nx-h2" id="nx-r-h">
            {r.title}
          </h2>
          <p className="nx-sub">{r.sub}</p>
        </div>
      </header>
      {r.next && (
        <div className="vd-glass nx-next">
          <Crest logo={r.next.logo} ini={r.next.ini} big />
          <div>
            <p className="nx-next__k">{r.next.k}</p>
            <p className="nx-next__t">{r.next.rival}</p>
            <p className="nx-next__s">{r.next.s}</p>
          </div>
          <button type="button" className="vd-glass vd-press nx-btn" onClick={show(r.next.pick)}>
            Ver el cara a cara
          </button>
        </div>
      )}
      <div className="nx-cols">
        <div>
          <label className="vd-glass nx-field nx-field--riv">
            <Ic name="search" />
            <span className="nx-vh">Buscar rival</span>
            <input type="search" placeholder="Buscar rival" value={r.q} onChange={(e) => r.setQ(e.target.value)} />
          </label>
          <ul className="nx-rivs" aria-label="Los rivales de la liga">
            {r.rows.map((x) => (
              <li key={x.key}>
                <button type="button" className="vd-glass vd-press nx-rv" aria-pressed={x.on} onClick={show(x.pick)}>
                  <Crest logo={x.logo} ini={x.ini} />
                  <span className="nx-rv__t">
                    <b>{x.rival}</b>
                    <span>{x.rec}</span>
                  </span>
                  <span className="nx-rv__l" aria-hidden="true">
                    {x.letters.map((l) => (
                      <span key={l.key} className={`vd-form__l ${l.cls}`}>
                        {l.l}
                      </span>
                    ))}
                  </span>
                  {x.played && (
                    <span className="nx-rv__gb" aria-hidden="true">
                      <i style={{ width: `${x.gfW}%` }} />
                      <i style={{ width: `${x.gcW}%` }} />
                    </span>
                  )}
                  {(x.now || x.next) && (
                    <span className="nx-rv__n">
                      {x.now && (
                        <span className="nx-viva">
                          <span className="nx-dot" />
                          {x.now}
                        </span>
                      )}
                      {x.now && x.next ? " · " : null}
                      {x.next}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {r.empty && <p className="nx-note">Ningún rival se llama así.</p>}
        </div>
        <div className="nx-side">
          <article className="vd-glass vd-glass--deep nx-glass" aria-labelledby="nx-dos-h">
            <div className="nx-dos__head">
              <Crest logo={r.d.logo} ini={r.d.ini} big />
              <div>
                <h3 className="nx-dos__name" id="nx-dos-h" ref={dos} tabIndex={-1}>
                  {r.d.rival}
                </h3>
                <p className="nx-dos__rec">{r.d.rec}</p>
              </div>
            </div>
            {r.d.games.length > 0 && (
              <ul className="nx-games" aria-label={`Los partidos contra ${r.d.rival}`}>
                {r.d.games.map((m) => (
                  <li key={m.key}>
                    <Link to={m.href} className={`nx-gm ${m.cls}`}>
                      <span className="nx-gm__j">{m.j}</span>
                      <span className="nx-gm__r">{m.res}</span>
                      <span className="nx-gm__w">
                        <b>
                          {m.day} · {m.where}
                          {m.live && (
                            <>
                              {" · "}
                              <span className="nx-viva">
                                <span className="nx-dot" aria-hidden="true" />
                                En directo, si acaba así
                              </span>
                            </>
                          )}
                        </b>
                        {m.who}
                      </span>
                      <Ic name="arrow" className="nx-gm__go" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {r.d.noGames && <p className="nx-sheet__p nx-dos__none">Aún no hemos jugado contra ellos.</p>}
            <dl className="nx-rates">
              <div>
                <dt>Nuestros goleadores</dt>
                <dd>{r.d.scorers}</dd>
              </div>
              <div>
                <dt>Mayor victoria</dt>
                <dd>{r.d.big}</dd>
              </div>
              <div>
                <dt>La primera vez</dt>
                <dd>{r.d.first}</dd>
              </div>
              <div>
                <dt>Lo siguiente</dt>
                <dd>{r.d.next}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </section>
  );
}
