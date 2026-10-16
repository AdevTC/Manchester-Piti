// The vestuario's «Ya está tu temporada en cromos»: one banner from the moment a season closes (a later one
// takes over) until 14 days after the new one kicks off, for a linked member whose recap is ready
// (perfil/recapView: recapOffer, recapClosedAt, recapBannerOn). It opens Perfil › Temporada with the
// story already up (/profile#cromos).
import { Link } from "@tanstack/react-router";
import { CREST } from "../perfil/icons";
import { CROMOS_HASH } from "../perfil/tabs";
import "../perfil/recap.css";

export function RecapBanner({ seasonName }: { seasonName: string }) {
  return (
    <section className="rc-ban" aria-labelledby="rc-ban-t">
      <span className="rc-ban-st" aria-hidden="true">
        <img src={CREST} alt="" />
      </span>
      <div className="rc-ban-t">
        <span className="vx-kick">{seasonName} · cerrada</span>
        <h2 id="rc-ban-t">Ya está tu temporada en cromos</h2>
        <p>Tus partidos, tus goles, tu socio y el equipo, cromo a cromo. Compártelos.</p>
        <Link className="rc-ban-go" to="/profile" hash={CROMOS_HASH}>
          Ver mis cromos
        </Link>
      </div>
    </section>
  );
}
