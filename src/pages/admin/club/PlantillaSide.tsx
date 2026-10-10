// Plantilla's side when no ficha is open (desktop): the next ficha to complete (the one that lacks the
// most, his kit large), then the team at a glance — how many per line (with their kits stacked), the ones
// without a line, who is injured, and the season's free dorsals (each one starts an «Alta» wearing it) —
// plus the CSV export.
import { ShirtBack } from "../kit";
import { AdIcon } from "../ui/icons";
import { GAPS, freeDorsals, gapsText, lineCounts, type BoardFilter, type BoardRow } from "./plantillaBoard";
import { POS_LABEL, POSITIONS } from "./plantillaLogic";

export interface PlantillaSideProps {
  rows: readonly BoardRow[];
  still: (row: BoardRow) => string | undefined;
  onFilter: (f: BoardFilter) => void;
  onOpen: (id: string) => void;
  onAlta: (dorsal: number | null) => void;
  onExport: () => void;
}

const FREE_SHOWN = 24;

export function PlantillaSide({ rows, still, onFilter, onOpen, onAlta, onExport }: PlantillaSideProps) {
  const counts = lineCounts(rows);
  const none = counts.find((c) => c.key === "none")?.n ?? 0;
  const injured = rows.filter((r) => r.injured);
  const free = freeDorsals(rows, FREE_SHOWN);
  // the next ficha to complete: the one that lacks the most (a missing line first), lowest dorsal on a tie
  const next = [...rows].filter((r) => r.gaps.length).sort((a, b) => b.gaps.length - a.gaps.length || Number(b.gaps.includes("pos")) - Number(a.gaps.includes("pos")) || (a.number ?? 999) - (b.number ?? 999))[0];
  const src = next ? still(next) : undefined;
  return (
    <aside className="pls" aria-labelledby="pls-t">
      <h2 id="pls-t" className="ttl">
        Estado del equipo
      </h2>
      {next ? (
        <section className="nxt" aria-label="La siguiente ficha">
          <span className="big" aria-hidden="true">
            {src ? <img src={src} alt="" width={132} height={147} decoding="async" /> : <ShirtBack num={next.number ?? ""} name={next.name} size={110} big />}
          </span>
          <div className="nx">
            <h3 className="who">
              <b>{next.number ?? "—"}</b>
              {next.name}
            </h3>
            <span className="fsl" aria-hidden="true">
              {GAPS.map((g) => (
                <i key={g.key} className={next.gaps.includes(g.key) ? "no" : ""}>
                  {g.short}
                </i>
              ))}
            </span>
            <p className="sr">{gapsText(next.gaps)}</p>
          </div>
          <button type="button" className="btn sm sky" onClick={() => onOpen(next.id)} aria-label={`Completar la ficha de ${next.name}`}>
            Completar su ficha
            <AdIcon name="right" size={16} />
          </button>
        </section>
      ) : null}
      <div className="lines" role="list" aria-label="Por líneas">
        {POSITIONS.map((p) => {
          const of = rows.filter((r) => r.position === p);
          return (
            <div key={p} className="ln" role="listitem" aria-label={`${POS_LABEL[p]}s: ${of.length}`}>
              <span className="stack" aria-hidden="true">
                {of.slice(0, 4).map((r, i) => {
                  const src = still(r);
                  return (
                    <span key={r.id} className="mk" style={{ zIndex: 4 - i }}>
                      {src ? <img src={src} alt="" width={30} height={33} decoding="async" /> : <ShirtBack num={r.number ?? ""} size={28} />}
                    </span>
                  );
                })}
              </span>
              <b>{of.length}</b>
              <small>{p}</small>
            </div>
          );
        })}
      </div>
      {none ? (
        <button type="button" className="nudge" onClick={() => onFilter("pos")}>
          <AdIcon name="alert" size={16} />
          <span>
            <b>{none} sin línea</b> · colócalos en el tablón
          </span>
          <AdIcon name="right" size={16} />
        </button>
      ) : null}
      <section aria-labelledby="pls-inj">
        <h3 id="pls-inj">Lesionados</h3>
        {injured.length ? (
          <ul className="inj">
            {injured.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} aria-label={`Abrir la ficha de ${r.name} (lesionado)`}>
                  <b>{r.number ?? "—"}</b>
                  {r.name}
                  <AdIcon name="right" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mut">Nadie en el parte: todos disponibles.</p>
        )}
      </section>
      <section aria-labelledby="pls-free">
        <h3 id="pls-free">Dorsales libres</h3>
        <div className="free">
          {free.map((n) => (
            <button key={n} type="button" onClick={() => onAlta(n)} aria-label={`Alta con el ${n}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="mut">Toca uno para dar de alta a alguien con ese número.</p>
      </section>
      <button type="button" className="btn sm line exp" onClick={onExport} disabled={!rows.length} aria-label="Exportar la plantilla (CSV)">
        <AdIcon name="doc" size={16} />
        Exportar CSV
      </button>
    </aside>
  );
}
