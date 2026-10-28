// «Solo para la capitanía»: the sala for whoever is inside without the armband, in the sala's own frame (no web
// footer under a dock, no clipped tab: B-SH-16). The anotador of the match that matters now sees his mesa
// («Abrir la mesa de la J3», M-21); anyone else, the way back to the vestuario. Only public data (the captains'
// collections are not his to read): the club's matches and the match's own scorers.
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useClubData } from "../../../lib/clubData";
import { jornadaNumbers } from "../../../lib/derived/jornada";
import { useMatchClock } from "../../../hooks/useMatchClock";
import { useMatchScorers } from "../../vestuario/live";
import { hoyHero } from "../data/moments";

/** The match an anotador opens la mesa for (being played, just played or next), if the viewer keeps it. */
function useScorerMatch(): { id: string; label: string; rival: string } | null {
  const { user } = useAuth();
  const club = useClubData();
  const now = useMatchClock(club.matches);
  const hero = hoyHero(
    club.matches.map((m) => ({ ...m, published: true })),
    now,
  );
  const scorers = useMatchScorers(user && hero ? hero.match.id : undefined);
  if (!user || !hero || !scorers.data.includes(user.uid)) return null;
  const j = jornadaNumbers(club.matches).get(hero.match.id);
  return { id: hero.match.id, label: j ? `la J${j}` : "el partido", rival: hero.match.rival ?? "el rival" };
}

export function Door() {
  const mesa = useScorerMatch();
  return (
    <section className="sc-door vd-reg-1" aria-labelledby="sc-door-t">
      <img className="sc-door__crest" src="/crest-128.webp" alt="" width={72} height={72} />
      <p className="sc-door__k">Sala de control</p>
      <h1 className="sc-door__t" id="sc-door-t">
        Solo para la capitanía
      </h1>
      {mesa ? (
        <>
          <p className="sc-door__p">
            Aquí se convoca y se publica el acta, y eso lo hace quien lleva el brazalete. Lo tuyo hoy es la mesa: anotas {mesa.label} contra {mesa.rival}.
          </p>
          <div className="sc-door__a">
            <Link className="vd-btn vd-glass vd-press vd-btn--pri" to="/partidos/$matchId/mesa" params={{ matchId: mesa.id }}>
              {mesa.label === "el partido" ? "Abrir la mesa del partido" : `Abrir la mesa de ${mesa.label}`}
            </Link>
            <Link className="vd-btn vd-glass vd-press" to="/vestuario">
              Volver al vestuario
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="sc-door__p">Aquí se cuecen las convocatorias y las actas, y el brazalete no es tuyo (de momento). Lo tuyo te espera en el vestuario.</p>
          <div className="sc-door__a">
            <Link className="vd-btn vd-glass vd-press vd-btn--pri" to="/vestuario">
              Volver al vestuario
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
