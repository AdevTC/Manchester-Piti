// Números, the season now (V-Integracion «Números con 14 equipos», V-Vivo phone «Números»): the league table
// in focus mode (the leader, us ±3, «N equipos más arriba/abajo») that moves with every goal — our row and the
// rival's with a dashed edge and «Si acaba así» until the acta —, «Ver la tabla entera (N)» growing into «La
// clasificación entera», the scorers and assisters with «En directo» on tonight's ones, and our form with
// tonight's letter dashed. Reads only public data (the captains' standings, the matches).
import type { CSSProperties } from "react";
import { GrowWindow, SeeAll, useGrow } from "../../components/vidrio";
import type { Standings } from "../../lib/standings";
import { projectTable, tableFocus, type SimRow } from "../../lib/derived/vidrio/table";
import type { LeaderRow, SeasonLeaders } from "../../lib/derived/vidrio/leaders";
import type { FormLetter } from "../../lib/derived/vidrio/numerosLive";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const SHOWN = 5;

function Row({ r, prov }: { r: SimRow; prov: boolean }) {
  const mark = prov && r.touched;
  return (
    <tr className={[r.isUs && "us", mark && "prov"].filter(Boolean).join(" ") || undefined} aria-current={r.isUs ? "true" : undefined}>
      <td className="p">{r.pos}</td>
      <td className="t">
        {r.team}
        {mark && <span className="vd-provtag">Si acaba así</span>}
      </td>
      <td>{r.pj}</td>
        <td className="h-sm">{r.g}</td>
        <td className="h-sm">{r.e}</td>
        <td className="h-sm">{r.p}</td>
        <td className="h-sm">{signed(r.gf - r.gc)}</td>
      <td className="pts">{r.pts}</td>
    </tr>
  );
}

function Head() {
  return (
    <thead>
      <tr>
        <th className="p">
          <abbr title="Posición">Pos.</abbr>
        </th>
        <th className="t">Equipo</th>
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
        <th className="h-sm">
          <abbr title="Diferencia de goles">DG</abbr>
        </th>
        <th className="pts">
          <abbr title="Puntos">Pts</abbr>
        </th>
      </tr>
    </thead>
  );
}

function Leaders({ title, rows, empty, prov }: { title: string; rows: readonly LeaderRow[]; empty: string; prov: boolean }) {
  return (
    <div className="st-now__lead">
      <h3>{title}</h3>
      {rows.length ? (
        <ol>
          {rows.slice(0, SHOWN).map((r) => (
            <li key={r.id} className="st-now__srow">
              <span className="vd-shirt" style={{ "--s": "30px" } as CSSProperties} aria-hidden="true">
                <b>{r.num}</b>
              </span>
              <b>{r.name}</b>
              {prov && r.provisional > 0 ? <span className="vd-provtag">En directo</span> : <span />}
              <strong>{r.value}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="st-now__empty">{empty}</p>
      )}
      {rows.length > SHOWN && <p className="st-now__more">Y {rows.length - SHOWN} más en la pestaña Jugadores.</p>}
    </div>
  );
}

export interface AhoraProps {
  standings: Standings | null;
  /** The live score as if it ended now (a match being played, or played without its acta yet). */
  live: { rival: string; gf: number; ga: number } | null;
  leaders: SeasonLeaders;
  form: readonly FormLetter[];
}

export function Ahora({ standings, live, leaders, form }: AhoraProps) {
  const g = useGrow("st-tabla");
  const sim = standings?.rows.length ? projectTable(standings.rows, live) : null;
  const prov = !!live;
  const rows = sim?.rows ?? [];
  const focus = tableFocus(rows);
  const big = focus.some((f) => f.kind === "gap");
  const us = sim?.us ?? null;
  return (
    <section className="st-now" aria-label="La temporada, ahora">
      <div className={`st-now__tbl ${g.summaryProps.className}`} style={g.summaryProps.style}>
        <h2>Clasificación</h2>
        {sim ? (
          <>
            <table className="vd-table st-now__table">
              <caption className="vd-vh">Clasificación{prov ? ", si acaba así" : ""}</caption>
              <Head />
              <tbody>
                {focus.map((f, i) =>
                  f.kind === "gap" ? (
                    <tr key={`gap-${i}`} className="vd-gap">
                      <td colSpan={8}>{f.text}</td>
                    </tr>
                  ) : (
                    <Row key={f.row.team} r={f.row} prov={prov} />
                  ),
                )}
              </tbody>
            </table>
            {big && (
              <SeeAll
                summary={
                  <>
                    <b>{rows.length} equipos</b> en la liga{us?.pos ? `; vas ${us.pos}º` : ""}
                  </>
                }
                count={rows.length}
                label={`Ver la tabla entera (${rows.length})`}
                onOpen={g.grow}
              />
            )}
          </>
        ) : (
          <p className="st-now__empty">La clasificación sale aquí en cuanto el capitán la publique.</p>
        )}
      </div>
      <div className="st-now__side">
        <Leaders title="Goleadores" rows={leaders.goals} empty="Nadie ha marcado todavía. El primero estrena la tabla." prov={leaders.live} />
        <Leaders title="Asistencias" rows={leaders.assists} empty="Sin asistencias todavía." prov={leaders.live} />
        <div className="st-now__lead">
          <h3>Forma</h3>
          {form.length ? (
            <ol className="vd-form" aria-label="Forma, de la más antigua a la de hoy">
              {form.map((f, i) => (
                <li key={i} className={`vd-form__l vd-form__l--${f.tone === "e" ? "e" : f.tone}`} role="img" aria-label={f.label}>
                  {f.l}
                </li>
              ))}
            </ol>
          ) : (
            <p className="st-now__empty">Sin jornadas todavía.</p>
          )}
        </div>
      </div>
      {sim && (
        <GrowWindow open={g.open} title="La clasificación entera" sub={`${rows.length} equipos.${prov ? " La fila del Piti va con borde discontinuo mientras sea «si acaba así»." : ""}`} onClose={g.close} className="st-grow" {...g.windowProps}>
          <table className="vd-table st-now__table">
            <caption className="vd-vh">La clasificación entera</caption>
            <Head />
            <tbody>
              {rows.map((r) => (
                <Row key={r.team} r={r} prov={prov} />
              ))}
            </tbody>
          </table>
        </GrowWindow>
      )}
    </section>
  );
}
