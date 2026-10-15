import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { useClubContent } from "../../lib/clubContent";
import { useMatchClock } from "../../hooks/useMatchClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { ClubDataError, StateStage } from "../../components/celeste/StatePanel";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { leaders, narrative, playerLines, playerOfTheMoment, seasonPulse, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { HomeHoy } from "./HomeHoy";
import { MatchHero } from "./MatchHero";
import { PonteLaCamiseta } from "./PonteLaCamiseta";
import { SeasonRow, Sponsors, VestuarioBand } from "./Sections";
import "../../styles/celeste/page.css";
// home-match.css before home.css: the cascade the server-rendered home has always had (home.css was a
// shared chunk linked after the page's own sheet; now only the home imports it).
import "../../styles/home-match.css";
import "../../styles/home.css";

/** Public home, match day: the next game, the player of the moment, the season, and a shirt for the fans. */
export function HomePage() {
  const { matches, players, loading, error } = useClubData();
  const { seasons } = useSeason();
  const content = useClubContent();
  const now = useMatchClock(matches);
  const theme = useDocumentTheme();
  const seasonId = currentSeasonId(nextFixture(matches, now), matches, seasons);
  const seasonName = seasons.find((s) => s.id === seasonId)?.name ?? "Temporada";

  const squad: SquadMember[] = players
    .filter((p) => p.seasons?.includes(seasonId))
    .map((raw) => {
      const p = playerForSeason(raw, seasonId, seasons);
      return { id: p.id, name: playerName(p), num: p.number != null ? String(p.number) : "", birthDate: p.birthDate };
    })
    .sort((a, b) => Number(a.num || 999) - Number(b.num || 999) || a.name.localeCompare(b.name, "es"));
  const pulse = seasonPulse(matches, seasonId, now);
  const lines = playerLines(squad, pulse.played);
  const [scorer] = leaders(lines, "goals", 1);
  const nameOf = (id: string) => lines.find((l) => l.id === id)?.name ?? playerName(players.find((p) => p.id === id));
  const story = narrative(pulse, { seasonName, squadSize: squad.length, now, nameOf, scorer });
  const moment = playerOfTheMoment(lines, pulse, now);
  const shot = moment ? [{ kit: "home" as const, theme, name: moment.line.name.toUpperCase(), num: moment.line.num }] : [];
  // Off the main thread: on a first visit this photo is made while the page is still loading, and on
  // the main thread its WebGL work held the headline back for seconds on a mid-range phone.
  const still = useShirtStills(shot, { offMainThread: true });

  return (
    <div className="vx hm" aria-busy={loading}>
      <CelesteBackdrop />
      {/* «Hoy» shares the header's slot (a fragment) instead of taking one of its own: the page's children
          keep their count and places, so the useId values below (AddToCalendar's aria-controls) — and with
          them the server-rendered HTML — stay byte for byte the fan's. It renders nothing on the server. */}
      <>
        <CelesteHeader
          active="inicio"
          sub="Manchester Piti"
          actions={
            <>
              <ThemeToggle />
              <Link className="hm-cta-top" to="/vestuario">
                <Icon name="padlock" size={16} stroke={2.2} />
                <span className="t">Vestuario</span>
                <span className="hm-sr">Entrar al vestuario</span>
              </Link>
            </>
          }
        />
        <HomeHoy matches={matches} players={players} now={now} />
      </>
      {/* The headline is written from the data: until it arrives the hero keeps its place empty,
          so the text appears once instead of changing (and pushing the page) as each collection lands. */}
      {/* The data did not arrive: the error in the hero's place (no empty season pretending to be real). */}
      {error ? (
        <StateStage>
          <ClubDataError heading="h1" />
        </StateStage>
      ) : loading ? (
        <section className="hm-match hm-wait" aria-label="Cargando el partido" />
      ) : (
        <MatchHero story={story} pulse={pulse} now={now} moment={moment} momentStill={shot[0] && still(shot[0])} />
      )}
      {!error && <SeasonRow pulse={pulse} now={now} nameOf={nameOf} />}
      <PonteLaCamiseta theme={theme} />
      <div className="hm-bottom">
        <Link className="hm-squad" to="/plantilla">
          <span className="i">
            <Icon name="team" size={22} stroke={2} />
          </span>
          <span>
            <b>Conoce a los {squad.length || "jugadores"}</b>
            <span>Camisetas, fichas, pichichi, cumpleaños y cara a cara en Plantilla</span>
          </span>
          <span className="ar">
            <Icon name="arrow" size={18} stroke={2.2} />
          </span>
        </Link>
        <VestuarioBand theme={theme} />
      </div>
      <Sponsors sponsors={content.sponsors} />
      <CelesteFooter />
      <CelesteDock active="inicio" />
    </div>
  );
}
