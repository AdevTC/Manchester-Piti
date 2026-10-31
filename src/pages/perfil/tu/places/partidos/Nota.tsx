// Tus partidos › «Tu nota, jornada a jornada» and the season in figures (TuCarta tc-pa): the frozen notas as a
// line (the average dashed, the MVP in gold; the gaps are jornadas he didn't play), each nota a button that
// focuses its jornada; with one nota, one point and «con la segunda sale tu línea».
import type { JornadaRow } from "../../me";
import type { Chart } from "../partidosView";

export function NotaChart({ chart, rows, pick }: { chart: Chart; rows: readonly JornadaRow[]; pick: (i: number) => void }) {
  const played = rows.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "played" && x.r.nota !== null);
  return (
    <section aria-labelledby="tp-ch-h">
      <div className="nx-sec__head">
        <h3 className="nx-h3" id="tp-ch-h">
          Tu nota, jornada a jornada
        </h3>
        <p className="nx-meta">Las notas congeladas de cada acta</p>
      </div>
      <div className="tc-chart tp-chart">
        {/* (it stretches to a readable height on a phone: the strokes keep their width, the dots are drawn on top) */}
        <svg viewBox="0 0 640 200" preserveAspectRatio="none" role="img" aria-label={chart.aria}>
          <path className="tp-ch__grid" d={chart.grid} />
          {chart.avg && <path className="tp-ch__avg" d={chart.avg} />}
          {chart.line && <path className="tp-ch__line" d={chart.line} />}
        </svg>
        {chart.labs.map((l) => (
          <i key={l.left} className={`tp-ch__pt${l.t.endsWith("MVP") ? " is-gold" : ""}`} style={{ left: l.left, top: l.top }} aria-hidden="true" />
        ))}
        {chart.labs.map((l, k) => {
          const x = played[k];
          return (
            <button key={l.left} type="button" className="tc-chart__lab tp-ch__lab" style={{ left: l.left, top: l.top }} onClick={() => x && pick(x.i)} aria-label={x ? `${x.r.jLabel} contra ${x.r.rival}: ${x.r.notaText}, ${x.r.bandWord}${x.r.mvp ? ", MVP" : ""}. Ver tu partido` : l.t}>
              {l.t}
            </button>
          );
        })}
        {chart.js.map((l) => (
          <span key={l.left} className="tc-chart__j" style={{ left: l.left }} aria-hidden="true">
            {l.t}
          </span>
        ))}
        {chart.gs.map((l) => (
          <span key={l.t} className="tc-chart__g" style={{ top: l.top }} aria-hidden="true">
            {l.t}
          </span>
        ))}
      </div>
      <p className="tc-chart__note">{chart.note}</p>
    </section>
  );
}

export function Figures({ figs }: { figs: { v: string; k: string }[] }) {
  return (
    <section aria-label="Tu temporada en números">
      <div className="tc-figs">
        {figs.map((f) => (
          <div key={f.k} className="tc-fig">
            <b>{f.v}</b>
            <span>{f.k}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
