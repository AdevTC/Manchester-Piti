// La clasificación de la liga, public side: the strip («Vamos 3.º de 12 · 18 pts · J8», on the home and on
// /partidos, linking to the table) and the full table (/partidos?view=tabla). Our row says «Nosotros» in
// words and carries a left rule (never colour alone); the arrows compare with the table before the last
// save. Without a table nothing renders. Words and moves: lib/standings.
import { Link } from "@tanstack/react-router";
import { movesOf, moveText, stripText, updatedText, type Move, type Standings } from "../../lib/standings";
import { Icon } from "./icons";
import "../../styles/celeste/data.css";
import "../../styles/clasificacion.css";

export function StandingsStrip({ standings }: { standings: Standings | null }) {
  const text = standings ? stripText(standings) : null;
  if (!standings || !text) return null;
  return (
    <Link className="cl-strip" to="/partidos" search={{ view: "tabla" }} aria-label={`${text}. Ver la clasificación${standings.competition ? ` de ${standings.competition}` : ""}`}>
      <span className="k">Clasificación</span>
      <b>{text}</b>
      <span className="ar" aria-hidden="true">
        <Icon name="arrow" size={16} stroke={2.2} />
      </span>
    </Link>
  );
}

function MoveMark({ move }: { move: Move }) {
  if (!move || move.dir === "same") return <span className="cl-mv" aria-hidden="true" />;
  if (move.dir === "new") return <span className="cl-mv new">nuevo</span>;
  return (
    <span className={`cl-mv ${move.dir}`} title={moveText(move)}>
      <span aria-hidden="true">
        {move.dir === "up" ? "↑" : "↓"}
        {move.by}
      </span>
      <span className="hm-sr">{moveText(move)}</span>
    </span>
  );
}

const COLS = [
  ["pj", "PJ", "Partidos jugados"],
  ["g", "G", "Ganados"],
  ["e", "E", "Empatados"],
  ["p", "P", "Perdidos"],
  ["gf", "GF", "Goles a favor"],
  ["gc", "GC", "Goles en contra"],
] as const;

export function StandingsTable({ standings }: { standings: Standings }) {
  const moves = movesOf(standings.rows, standings.rowsPrev);
  const updated = updatedText(standings.updatedAt);
  const meta = [updated, standings.jornada ? `Jornada ${standings.jornada}` : "", standings.competition].filter(Boolean).join(" · ");
  return (
    <div className="cl">
      {meta && <p className="cl-meta">{meta}</p>}
      {/* (the table scrolls inside its own box: the page never scrolls sideways) */}
      <div className="st-tablebox cl-box" role="region" aria-label="Tabla de la clasificación" tabIndex={0}>
        <table className="st-table cl-table">
          <caption className="hm-sr">Clasificación{standings.competition ? `: ${standings.competition}` : ""}{standings.jornada ? `, jornada ${standings.jornada}` : ""}</caption>
          <thead>
            <tr>
              <th scope="col">Equipo</th>
              {COLS.map(([k, label, title]) => (
                <th key={k} scope="col">
                  <abbr title={title}>{label}</abbr>
                </th>
              ))}
              <th scope="col">
                <abbr title="Diferencia de goles">DG</abbr>
              </th>
              <th scope="col" className="pts">
                <abbr title="Puntos">Pts</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((r, i) => {
              const dg = r.gf - r.gc;
              return (
                <tr key={`${r.team}-${i}`} className={r.isUs ? "us" : undefined} aria-current={r.isUs ? "true" : undefined}>
                  <th scope="row">
                    <span className="cl-pos">{i + 1}</span>
                    <MoveMark move={moves[i]} />
                    <span className="cl-tw">
                      <span className="cl-team">{r.team}</span>
                      {r.isUs && <span className="cl-us">Nosotros</span>}
                    </span>
                  </th>
                  {COLS.map(([k]) => (
                    <td key={k}>{r[k]}</td>
                  ))}
                  <td>{dg > 0 ? `+${dg}` : dg < 0 ? `−${-dg}` : "0"}</td>
                  <td className="pts">{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
