// Tabla: the league table in focus (the leader … us ±3 …, «Ver la tabla entera» grows it) and «¿Y si…?» —
// make-believe results on the jornadas still to play (on the ribbon on a desktop, as rows here on a phone or a
// tablet), presets for the rest, what it would mean (points, place, at most, at least) and «Volver a lo real».
// While a match is live the table is «Si acaba así». A closed season shows how it ended, without «¿y si…?».
import type { CSSProperties } from "react";
import { region, SeeAll } from "../../../components/vidrio";
import { tableFocus, SIM_PRESETS, type PickLetter, type SimFixture, type SimPreset, type Simulation, type SimRow } from "../../../lib/derived/vidrio/table";
import { plural } from "../../../lib/derived/words";
import { formLetters, shortDay, signed, type FormLetter } from "./model";
import type { StripSegment } from "../../../lib/derived/vidrio/strip";
import { Count, Glyph } from "./bits";

export interface TablaProps {
  sim: Simulation | null;
  /** Rows as they are (null: the league hasn't published a table). */
  hasTable: boolean;
  fixtures: readonly SimFixture[];
  picks: Readonly<Record<string, PickLetter>>;
  preset: SimPreset;
  onPick: (id: string, l: PickLetter) => void;
  onPreset: (p: SimPreset) => void;
  onReset: () => void;
  live: boolean;
  closed: boolean;
  segments: readonly StripSegment[];
  lastPlayed: number | null;
  /** The jornada of the day, counted in the table (live, or played with the standings not yet updated). */
  tonightJ: number | null;
  /** Nothing played yet and the first one is today («la liga empieza esta noche»). */
  startsToday: boolean;
  onGrow: () => void;
  tablaVt: boolean;
  /** The cockpit's «Probarlo en la cinta» (Tabla isn't the vista). */
  onTry: () => void;
  vistaOn: boolean;
  seasonName: string;
}

const LETTER_WORD: Record<PickLetter, string> = { G: "Ganamos", E: "Empatamos", P: "Perdemos" };
const ord = (n: number) => `${n}º`;

function MoveMark({ row, anySim, live }: { row: SimRow; anySim: boolean; live: boolean }) {
  if (anySim && row.move !== 0)
    return (
      <span className="vd-move">
        <Glyph name="arrow" style={{ transform: row.move > 0 ? "none" : "rotate(180deg)" }} />
        {row.move > 0 ? `sube al ${ord(row.pos)}` : `baja al ${ord(row.pos)}`}
      </span>
    );
  if (!anySim && live && row.isUs)
    return (
      <span className="vd-move">
        <Glyph name="arrow" />
        si acaba así
      </span>
    );
  return null;
}

export function TableRows({ rows, full, anySim, live }: { rows: readonly SimRow[]; full: boolean; anySim: boolean; live: boolean }) {
  const items = full ? rows.map((r) => ({ kind: "row" as const, pos: r.pos, row: r, us: r.isUs, tied: false })) : tableFocus(rows);
  return (
    <>
      {items.map((it, i) =>
        it.kind === "gap" ? (
          <tr key={`gap-${i}`} className="vd-gap">
            <td colSpan={full ? 10 : 8}>
              <span aria-hidden="true">…</span>
              <span className="vd-vh">{it.text}</span>
            </td>
          </tr>
        ) : (
          <tr key={it.row.team} className={[it.row.isUs && "us", it.row.touched && anySim && "sim"].filter(Boolean).join(" ") || undefined} aria-current={it.row.isUs ? "true" : undefined}>
            <td className="p">{it.row.pos}</td>
            <td className="t">
              {it.row.team}
              {!full && <MoveMark row={it.row} anySim={anySim} live={live} />}
            </td>
            <td>{it.row.pj}</td>
            <td className="h-sm">{it.row.g}</td>
            <td className="h-sm">{it.row.e}</td>
            <td className="h-sm">{it.row.p}</td>
            {full && <td>{it.row.gf}</td>}
            {full && <td>{it.row.gc}</td>}
            <td>{signed(it.row.gf - it.row.gc)}</td>
            <td className="pts">{it.row.pts}</td>
          </tr>
        ),
      )}
    </>
  );
}

export function TableHead({ full }: { full: boolean }) {
  return (
    <thead>
      <tr>
        <th className="t" colSpan={2}>
          Equipo
        </th>
        <th>
          <abbr title="Partidos jugados">PJ</abbr>
        </th>
        <th className="h-sm">
          <abbr title="Ganados">G</abbr>
        </th>
        <th className="h-sm">
          <abbr title="Empatados">E</abbr>
        </th>
        <th className="h-sm">
          <abbr title="Perdidos">P</abbr>
        </th>
        {full && (
          <th>
            <abbr title="Goles a favor">GF</abbr>
          </th>
        )}
        {full && (
          <th>
            <abbr title="Goles en contra">GC</abbr>
          </th>
        )}
        <th>
          <abbr title="Diferencia de goles">DG</abbr>
        </th>
        <th>
          <abbr title="Puntos">Pts</abbr>
        </th>
      </tr>
    </thead>
  );
}

function Form({ letters }: { letters: FormLetter[] }) {
  if (!letters.length) return null;
  return (
    <div className="vp-formw">
      <p className="vd-small">La forma, las últimas jornadas</p>
      <ol className="vd-form" aria-label="La forma">
        {letters.map((f, i) => (
          <li key={i} className={`vd-form__l vd-form__l--${f.kind}`} aria-label={f.aria}>
            <span aria-hidden="true">{f.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Tabla({ sim, hasTable, fixtures, picks, preset, onPick, onPreset, onReset, live, closed, segments, lastPlayed, tonightJ, startsToday, onGrow, tablaVt, onTry, vistaOn, seasonName }: TablaProps) {
  const anySim = !!sim && (sim.picked > 0 || sim.filled > 0);
  const rows = sim?.rows ?? [];
  const focus = tableFocus(rows);
  const shownRows = focus.filter((x) => x.kind === "row").length;
  const hidden = rows.length - shownRows;
  const title = closed ? "Así acabó" : live ? "Si acaba así" : "La clasificación";
  const after = tonightJ ?? lastPlayed;
  const sub = closed ? `${seasonName}, final` : anySim ? "Con tus resultados de mentira" : rows.length > 9 ? `${rows.length} equipos; tú, en tu zona` : after ? `Después de la J${after}` : startsToday ? "Todos a cero: la liga empieza esta noche" : "Todos a cero: la liga aún no ha empezado";
  const open = fixtures.length;
  const unpicked = fixtures.filter((f) => !Object.hasOwn(picks, f.id)).length;
  const next5 = fixtures.slice(0, 5);
  const restMobile = fixtures.length - next5.filter((f) => Object.hasOwn(picks, f.id)).length;
  const results = sim?.results ?? {};
  const line = sim && sim.points !== null && sim.position !== null ? `${anySim ? "Con lo que has tocado" : "Ahora mismo"}: ${plural(sim.points, "punto")}, ${ord(sim.position)}.${rows.length > 7 && anySim ? " Los demás equipos se quedan como están." : ""}${sim.champions ? " Campeones, si acaba así." : ""}` : "";
  return (
    <section className={`vp-tabla ${region(3)}`} aria-labelledby="vp-tt">
      <div className="vp-tabla__t vd-grow-src" style={tablaVt ? ({ viewTransitionName: "vp-grow" } as CSSProperties) : undefined}>
        <div className="vp-tabla__head">
          <h2 className="vd-h3" id="vp-tt">
            {title}
          </h2>
          <p className="vd-small">{sub}</p>
        </div>
        {hasTable && sim ? (
          <>
            <table className="vd-table">
              <caption className="vd-vh">
                {title}
                {anySim ? ", con tus resultados de mentira" : ""}
              </caption>
              <TableHead full={false} />
              <tbody>
                <TableRows rows={rows} full={false} anySim={anySim} live={live} />
              </tbody>
            </table>
            <SeeAll
              summary={
                <>
                  Estás viendo los de tu zona: <b>{plural(hidden, "equipo más", "equipos más")}</b>
                </>
              }
              count={hidden}
              label={`Ver la tabla entera (${rows.length})`}
              onOpen={onGrow}
            />
          </>
        ) : (
          <p className="vp-empty">La liga aún no ha publicado la clasificación de esta temporada.</p>
        )}
      </div>
      <div className={`vp-y${vistaOn ? " vp-y--on" : ""}`}>
        {closed ? (
          <>
            <h3 className="vd-h4">La temporada acabó</h3>
            <p className="vd-body">Aquí ya no hay «¿y si…?»: así quedó la tabla.</p>
          </>
        ) : !open ? (
          <>
            <h3 className="vd-h4">¿Y si…?</h3>
            <p className="vd-body">No queda ninguna jornada por jugar: la tabla es la que es.</p>
          </>
        ) : (
          <>
            <h3 className="vd-h4">¿Y si…?</h3>
            <p className="vd-body vp-help vp-help--desk">
              <span className="vp-help--wide">{vistaOn ? "Toca G, E o P en las jornadas que faltan, en la cinta de arriba; muévela para llegar a las demás. Solo lo ves tú." : "Pon resultados de mentira a lo que falta y mira la tabla moverse."}</span>
              <span className="vp-help--cock">{vistaOn ? "Toca G, E o P en la cinta. Solo lo ves tú." : "Pon resultados de mentira y mira la tabla moverse."}</span>
            </p>
            <p className="vd-body vp-help vp-help--mob">Elige G, E o P en las próximas {Math.min(5, open)}. Solo lo ves tú: no cambia nada de verdad.</p>
            {!vistaOn && (
              <div className="vp-btns vp-try">
                <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={onTry}>
                  Probarlo en la cinta
                </button>
              </div>
            )}
            <div className="vp-simrows">
              {next5.map((f) => {
                const v = picks[f.id] ?? null;
                const at = ["G", "E", "P"].indexOf(v ?? "G");
                const seg = segments.find((s) => s.id === f.id);
                return (
                  <div key={f.id} className="vp-simrow">
                    <div>
                      <b>
                        J{f.jornada ?? "·"}, {f.rival}
                      </b>
                      <span>
                        {f.state === "aplazado" ? "Aplazado, sin fecha" : f.at !== null ? shortDay(f.at) : "Sin fecha"}, {seg?.home === false ? "fuera" : "en casa"}
                      </span>
                    </div>
                    <div className="vd-glass vd-seg" role="group" aria-label={`¿Y si en la J${f.jornada ?? ""} contra ${f.rival}…?`} style={{ "--i": at, "--n": 3 } as CSSProperties}>
                      <span className="vd-shelf__bead" aria-hidden="true" style={{ opacity: v ? 1 : 0 }} />
                      {(["G", "E", "P"] as const).map((l) => (
                        <button key={l} type="button" className="vd-seg__b" aria-pressed={v === l} aria-label={LETTER_WORD[l]} onClick={() => onPick(f.id, l)}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {(unpicked > 0 || preset !== "nada") && (
              <div className="vp-fill">
                <p className="vd-small">
                  <span className="vp-help--desk">Rellenar las otras {unpicked}:</span>
                  <span className="vp-help--mob">Rellenar las otras {restMobile}:</span>
                </p>
                <div className="vp-chips" role="group" aria-label="Rellenar el resto">
                  {SIM_PRESETS.map((p) => (
                    <button key={p.id} type="button" className="vd-glass vp-chipbtn vd-press" aria-pressed={preset === p.id} onClick={() => onPreset(p.id)}>
                      <span className="vp-chip__l">{p.label}</span>
                      <span className="vp-chip__s" aria-hidden="true">
                        {p.short}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sim && sim.points !== null && (
              <div className="vp-proj">
                <Count value={sim.points} label="puntos" />
                <Count value={sim.position ? ord(sim.position) : "–"} label="en la tabla" />
                <Count value={sim.comoMucho ?? "–"} label="como mucho" />
                <Count value={sim.comoPoco ?? "–"} label="como poco" />
              </div>
            )}
            <p className="vd-body vp-simline" aria-live="polite">
              {line}
            </p>
            {anySim && (
              <div className="vp-btns">
                <button type="button" className="vd-glass vd-btn vd-btn--sm vd-press" onClick={onReset}>
                  <Glyph name="reset" />
                  Volver a lo real
                </button>
              </div>
            )}
          </>
        )}
        <Form letters={formLetters(segments, results)} />
      </div>
    </section>
  );
}
