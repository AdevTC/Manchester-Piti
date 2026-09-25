import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { useClubContent } from "../../lib/clubContent";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { useShirtStills } from "../../components/jersey3d/useShirtStills";
import { leaders, narrative, playerLines, playerOfTheMoment, seasonPulse, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { MatchHero } from "./MatchHero";
import { PonteLaCamiseta } from "./PonteLaCamiseta";
import { SeasonRow, Sponsors, VestuarioBand } from "./Sections";
import "../../styles/home.css";
import "../../styles/home-match.css";

/** Public home, match day: the next game, the player of the moment, the season, and a shirt for the fans. */
export function HomePage() {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const content = useClubContent();
  const now = useClock(60_000);
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
  const still = useShirtStills(shot);

  return (
    <div className="vx hm">
      <CelesteBackdrop />
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
      <MatchHero story={story} pulse={pulse} now={now} moment={moment} momentStill={shot[0] && still(shot[0])} />
      <SeasonRow pulse={pulse} now={now} nameOf={nameOf} />
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
