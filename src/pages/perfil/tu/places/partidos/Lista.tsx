// Tus partidos › every jornada as a table (desktop) or a list (phone), C's «Tus partidos» with its filters
// Jugados / Todos / Por jugar: the result (our score first), his minutes, his position, his goals and assists,
// his nota with its word (or why there isn't one); a row focuses its jornada.
import { TuIcon } from "../../../../../components/vidrio/tu/ui";
import type { Answer, JornadaRow } from "../../me";
import { filterOpts, tableRows, type Filter } from "../partidosView";
import { RadioSeg } from "./RadioSeg";

export function Lista({ rows, filter, setFilter, phone, pick, nextAnswer, caption }: { rows: readonly JornadaRow[]; filter: Filter; setFilter: (f: Filter) => void; phone: boolean; pick: (i: number) => void; nextAnswer: Answer | null; caption: string }) {
  const list = tableRows(rows, filter, nextAnswer);
  const empty = filter === "jugados" ? "Aún no has jugado ninguna jornada esta temporada." : filter === "porjugar" ? "No quedan jornadas por jugar." : "Aún no hay jornadas en el calendario.";
  return (
    <section className="tp-lista" aria-labelledby="tp-li-h">
      <div className="nx-sec__head">
        <h3 className="nx-h3" id="tp-li-h">
          Partido a partido
        </h3>
        <p className="nx-meta">Cada jornada con su resultado, tus minutos, tu puesto y tu nota del acta. Toca una para verla entera.</p>
      </div>
      <div className="tt-ctl">
        <RadioSeg label="Qué partidos" className="tt-seg3" opts={filterOpts(rows).map((o) => ({ key: o.k, t: `${o.t} · ${o.n}`, on: filter === o.k, pick: () => setFilter(o.k) }))} />
      </div>
      {!list.length ? (
        <p className="nx-meta tp-empty">{empty}</p>
      ) : phone ? (
        <ul className="tt-plist" aria-label={caption}>
          {list.map((x) => (
            <li key={x.r.matchId}>
              <button type="button" onClick={() => pick(x.i)} aria-label={x.openAria} aria-haspopup="dialog">
                <span className="tt-pj__node" aria-hidden="true">
                  {x.r.jLabel}
                </span>
                <span className="tt-pj__t">
                  <b>{x.r.rival}</b>
                  <span>{x.pline}</span>
                </span>
                <span className="tt-pj__v">
                  {x.isPlayed ? (
                    <>
                      <span className={`tt-nb tt-b--${x.r.band}`}>{x.r.notaText}</span>
                      <small>{x.r.bandWord}</small>
                    </>
                  ) : (
                    <small>{x.kindT}</small>
                  )}
                  {x.r.mvp && <span className="tt-mvp">MVP</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="tp-tabwrap">
          <table className="tt-tab">
            <caption className="nx-vh">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Jornada</th>
                <th scope="col">Rival</th>
                <th scope="col">Resultado</th>
                <th scope="col" className="r">
                  Minutos
                </th>
                <th scope="col">Puesto</th>
                <th scope="col">Goles y asist.</th>
                <th scope="col">Tu nota</th>
                <th scope="col">
                  <span className="nx-vh">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.r.matchId} className={x.trCls || undefined}>
                  <td>
                    <b>{x.r.jLabel}</b>
                    <small>{x.dateT}</small>
                  </td>
                  <td>
                    <b>{x.r.rival}</b>
                    <small>{x.haT}</small>
                  </td>
                  <td>{x.resT}</td>
                  <td className="r">{x.minT}</td>
                  <td>{x.posT}</td>
                  <td>{x.gaT}</td>
                  <td>
                    {x.isPlayed ? (
                      <span className="tt-nbw">
                        <span className={`tt-nb tt-b--${x.r.band}`}>{x.r.notaText}</span>
                        <span>{x.r.bandWord}</span>
                      </span>
                    ) : (
                      <span className="nx-meta">{x.kindT}</span>
                    )}
                    {x.r.mvp && (
                      <>
                        {" "}
                        <span className="tt-mvp">MVP</span>
                      </>
                    )}
                  </td>
                  <td className="r">
                    <button type="button" className="tt-rowbtn" onClick={() => pick(x.i)} aria-label={x.openAria}>
                      Ver la jornada
                      <TuIcon name="chev-r" className="nx-ic nx-ic--s" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
