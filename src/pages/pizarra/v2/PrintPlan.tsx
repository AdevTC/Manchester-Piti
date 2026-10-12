// La pizarra · Bloque 5 — «Imprimir el plan» (Compartir): a clean A4 portrait sheet for the print dialog
// (or «Guardar como PDF»). The sheet is mounted on <body> only while printing; the print stylesheet in
// pizarra-equipo.css shows it alone. The content is printSheet.ts.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { PITCH_RATIO, type PrintView } from "./printSheet";
import "../../../styles/pizarra-equipo.css";

const H = 100 * PITCH_RATIO;

/** The seven on a top-view pitch (their goal at the top). */
function PitchSvg({ v }: { v: PrintView }) {
  return (
    <svg className="b5e-pp" viewBox={"-4 -4 108 " + (H + 8)} role="img" aria-label={"El siete: " + v.seven.map((s) => s.name + " (" + s.pos + ")").join(", ")}>
      <rect x="0" y="0" width="100" height={H} fill="none" stroke="currentColor" strokeWidth="0.6" />
      <line x1="0" y1={H / 2} x2="100" y2={H / 2} stroke="currentColor" strokeWidth="0.4" />
      <circle cx="50" cy={H / 2} r="9" fill="none" stroke="currentColor" strokeWidth="0.4" />
      <rect x="25" y="0" width="50" height="16" fill="none" stroke="currentColor" strokeWidth="0.4" />
      <rect x="25" y={H - 16} width="50" height="16" fill="none" stroke="currentColor" strokeWidth="0.4" />
      {v.seven.map((s) => (
        <g key={s.name + s.pos} transform={"translate(" + s.x + " " + s.y + ")"}>
          <circle r="5.2" fill="#fff" stroke="currentColor" strokeWidth="0.7" />
          <text y="1.9" textAnchor="middle" fontSize="5" fontWeight="800">
            {s.num || ""}
          </text>
          <text y="10.5" textAnchor="middle" fontSize="3.6" fontWeight="700">
            {s.name + (s.cap ? " (C)" : "")}
          </text>
          <text y="14.6" textAnchor="middle" fontSize="2.8">
            {s.pos}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** The sheet itself (exported for its test). */
export function PrintSheet({ v }: { v: PrintView }) {
  return (
    <article className="b5e-print" aria-label="Plan para imprimir">
      <header>
        <small>Manchester Piti · La pizarra</small>
        <h1>{v.title}</h1>
        {v.sub && <p>{v.sub}</p>}
      </header>
      <div className="b5e-pcols">
        <section>
          <h2>El siete</h2>
          <PitchSvg v={v} />
          {v.empty > 0 && <p>Faltan {v.empty === 1 ? "1 jugador" : v.empty + " jugadores"} por poner.</p>}
          <h2>Banquillo</h2>
          <p>{v.bench.length ? v.bench.join(", ") : "Nadie en el banquillo."}</p>
        </section>
        <section>
          <h2>Consignas</h2>
          <dl>
            {v.consignas.map((c) => (
              <div key={c.t}>
                <dt>{c.t}</dt>
                <dd>{c.d}</dd>
              </div>
            ))}
          </dl>
          <h2>Cambios</h2>
          {v.tandas.length ? (
            <ul>
              {v.tandas.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <p>Sin cambios planeados.</p>
          )}
          <h2>Lanzadores</h2>
          {v.takers.length ? (
            <ul>
              {v.takers.map((t) => (
                <li key={t.k}>
                  <b>{t.k}:</b> {t.v}
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin lanzadores elegidos.</p>
          )}
          <h2>El rival{v.rivalSys ? " · " + v.rivalSys : ""}</h2>
          {v.rival.length ? (
            <ul>
              {v.rival.map((r) => (
                <li key={r.who + r.note}>
                  <b>{r.who}:</b> {r.note}
                </li>
              ))}
            </ul>
          ) : (
            <p>{v.rivalSys ? "Sin notas del rival." : "Sin rival en la pizarra."}</p>
          )}
        </section>
      </div>
    </article>
  );
}

/** The button, and the sheet on <body> while the print dialog is open. */
export function PrintPlan({ view, onFail }: { view: () => PrintView; onFail: (msg: string) => void }) {
  const [v, setV] = useState<PrintView | null>(null);
  useEffect(() => {
    if (!v) return;
    const done = () => setV(null);
    window.addEventListener("afterprint", done);
    // (after the sheet is on the page: the dialog prints what is there)
    const t = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        onFail("Este navegador no deja imprimir desde aquí.");
        setV(null);
      }
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [v, onFail]);
  return (
    <>
      <button type="button" className="b3" onClick={() => setV(view())}>
        <Icon n="info" w={15} />
        Imprimir el plan
      </button>
      <small className="b5e-note">Una hoja A4 con el siete, el banquillo, las consignas, los cambios, los lanzadores y el rival (o guárdala en PDF).</small>
      {v && typeof document !== "undefined" && createPortal(<PrintSheet v={v} />, document.body)}
    </>
  );
}
