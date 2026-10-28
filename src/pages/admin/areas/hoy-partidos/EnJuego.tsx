// HOY Y PARTIDOS · the match's «La mesa» while it is played (/admin/partidos/<id>/en-juego): el marcador, la crónica
// que llega de la mesa, quién anota y «Abrir la mesa» (board part-partidos.html § 7). TEMPORARY: the score, who keeps
// la mesa and the way to it, until wave 2 draws it.
import { Link } from "@tanstack/react-router";
import { usePartido } from "../../partido/partidoContext";

export function EnJuegoScreen() {
  const { match, phase, review } = usePartido();
  const live = phase === "juego" || phase === "descanso";
  const played = phase === "final" || phase === "publicado";
  return (
    <section className="sc-sec" aria-labelledby="sc-ej-t">
      <header className="sc-sec__h">
        <h2 className="sc-h2" id="sc-ej-t">
          La mesa
        </h2>
        {match.mesa?.name && <span className="sc-sec__n">Anota {match.mesa.name}</span>}
      </header>
      <p className="sc-p">
        {live
          ? `En juego: ${review.goalsFor}–${review.goalsAgainst}. Lo que se apunta en la mesa llega aquí y al acta.`
          : played
            ? `Pitado: ${review.goalsFor}–${review.goalsAgainst}. Lo que se apuntó en la mesa está en el acta.`
            : "La mesa se abre el día del partido: el marcador, las jugadas y los cambios se apuntan desde allí."}
      </p>
      <div className="sc-actions-row" style={{ marginTop: 14 }}>
        <Link className="vd-btn vd-glass vd-press vd-btn--pri" to="/partidos/$matchId/mesa" params={{ matchId: match.id }}>
          Abrir la mesa
        </Link>
      </div>
    </section>
  );
}
