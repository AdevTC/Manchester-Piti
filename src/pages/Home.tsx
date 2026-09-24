import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowRight, Trophy, Users, Heart } from "lucide-react";
import {
  useClubData,
  nextFixture,
  isCompleted,
  playerName,
} from "../lib/clubData";
import { useClubContent } from "../lib/clubContent";
import { useClock } from "../hooks/useClock";
import { useSeason } from "../context/SeasonContext";
import { ResultsTicker } from "../components/club/ResultsTicker";
import { computeStats } from "../lib/playerStats";
import {
  FixtureCard,
  PhotoSpace,
  SectionTitle,
  DataState,
} from "../components/club/ClubUI";
export function HomePage() {
  const { matches, players, loading, error } = useClubData();
  const content = useClubContent();
  const { seasons } = useSeason();
  const now = useClock();
  const next = nextFixture(matches, now);
  const currentSeason =
    next?.seasonId || matches[0]?.seasonId || seasons.at(-1)?.id;
  const completed = matches.filter(
    (m) => isCompleted(m) && (!currentSeason || m.seasonId === currentSeason),
  );
  const latest = matches.find(isCompleted);
  const leader = players
    .map((p) => ({ ...p, stats: computeStats(p.id, completed) }))
    .sort((a, b) => b.stats.goals - a.stats.goals)[0];
  const wins = completed.filter(
    (m) => (m.goalsFor ?? 0) > (m.goalsAgainst ?? 0),
  ).length;
  return (
    <>
      <section className="club-home-hero">
        <div className="club-hero-copy">
          <div className="club-edition">
            <span className="club-dot" />
            {content.location || "EL SITIO OFICIAL DEL EQUIPO"}
            <span>FÚTBOL 7</span>
          </div>
          <h1>
            MANCHESTER
            <br />
            <span>PITI</span>
          </h1>
          <p>{content.intro}</p>
          <div className="club-actions">
            <Link to="/partidos" className="club-button">
              Ver partidos <ArrowUpRight size={18} />
            </Link>
            <Link to="/plantilla" className="club-text-link">
              Conoce al equipo <ArrowRight size={17} />
            </Link>
          </div>
          <div className="club-hero-foot">
            <span>MANCHESTER PITI</span>
            <span>Fútbol 7 · Equipo amateur</span>
          </div>
        </div>
        <PhotoSpace url={content.photoUrl} className="club-hero-photo" />
      </section>
      <ResultsTicker />
      <div className="club-section">
        <DataState loading={loading} error={error} />
        <SectionTitle
          title="La semana del Piti"
          to="/partidos"
          action="Todo el calendario"
          text="Próximo encuentro y último resultado."
        />
        <div className="club-grid-2">
          {next ? (
            <FixtureCard match={next} featured />
          ) : (
            <div className="club-next-empty">
              <span className="club-kicker">CALENDARIO</span>
              <h3>Próximo partido pendiente</h3>
              <p>
                El próximo encuentro aparecerá aquí en cuanto se confirme el
                calendario.
              </p>
              <Link to="/partidos" className="club-text-link">
                Consultar partidos <ArrowRight size={17} />
              </Link>
            </div>
          )}
          {latest ? (
            <FixtureCard match={latest} featured />
          ) : (
            <div className="club-empty">
              <Trophy size={35} />
              <h3>Sin resultados registrados</h3>
              <p>Aquí aparecerá el primer resultado del equipo.</p>
            </div>
          )}
        </div>
        <div className="club-season-strip">
          <div>
            <span>EN CIFRAS</span>
            <h3>
              {seasons.find((s) => s.id === currentSeason)?.name || "El club"}
            </h3>
          </div>
          {[
            [completed.length, "Partidos"],
            [wins, "Victorias"],
            [completed.reduce((s, m) => s + (m.goalsFor ?? 0), 0), "Goles"],
            [
              players.filter(
                (p) =>
                  p.active !== false &&
                  (!currentSeason || p.seasons?.includes(currentSeason)),
              ).length,
              "Jugadores",
            ],
          ].map(([v, l]) => (
            <div key={l}>
              <b>{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <section className="club-section club-protagonists">
        <SectionTitle
          title="El equipo"
          to="/plantilla"
          action="Ver plantilla"
          text="Plantilla y rendimiento."
        />
        <div className="club-grid-3">
          {leader && leader.stats.goals > 0 ? (
            <Link
              to="/jugadores/$playerId"
              params={{ playerId: leader.id }}
              className="club-spotlight"
            >
              <span className="club-kicker">
                <Trophy size={16} /> EL PICHICHI
              </span>
              <b className="club-spotlight-number">
                {leader.stats.goals}
                <small>GOLES</small>
              </b>
              <h3>{playerName(leader)}</h3>
              <span>
                Ver estadísticas <ArrowUpRight size={18} />
              </span>
            </Link>
          ) : (
            <Link to="/stats" className="club-feature-tile">
              <Trophy />
              <h3>Estadísticas</h3>
              <p>Goles, asistencias, minutos y récords.</p>
              <ArrowUpRight />
            </Link>
          )}
          <Link to="/plantilla" className="club-feature-tile blue">
            <Users />
            <h3>Plantilla</h3>
            <p>Fichas de jugadores y datos de cada temporada.</p>
            <ArrowUpRight />
          </Link>
          <Link to="/club" className="club-feature-tile">
            <Heart />
            <h3>El club</h3>
            <p>Historia, campo y contacto.</p>
            <ArrowUpRight />
          </Link>
        </div>
      </section>
      <section className="club-join-band">
        <div>
          <span className="club-kicker">ÁREA PRIVADA</span>
          <h2>Vestuario</h2>
          <p>
            Convocatorias, pizarra y votación del MVP. Acceso para miembros del
            equipo.
          </p>
        </div>
        <Link to="/vestuario" className="club-button light">
          Entrar al vestuario <ArrowUpRight size={18} />
        </Link>
      </section>
      {content.sponsors.length > 0 && (
        <section className="club-section">
          <SectionTitle
            title="Patrocinadores"
            text="Entidades que apoyan al equipo."
          />
          <div className="club-sponsors">
            {content.sponsors.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noreferrer">
                {s.logo && <img src={s.logo} alt="" />}
                <b>{s.name}</b>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
