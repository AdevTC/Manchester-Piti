import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSeason } from "../../context/SeasonContext";
import { formatDate, nextFixture, playerForSeason, playerName, useClubData } from "../../lib/clubData";
import { useClubContent } from "../../lib/clubContent";
import { useClock } from "../../hooks/useClock";
import { useDocumentTheme } from "../../hooks/useDocumentTheme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { CelesteBackdrop, CelesteDock, CelesteFooter, CelesteHeader } from "../../components/celeste/Chrome";
import { Icon } from "../../components/celeste/icons";
import { clubMedals, leaders, narrative, playerLines, playerMoment, seasonPulse, upcomingBirthdays, type SquadMember } from "../../lib/home";
import { currentSeasonId } from "../../lib/vestuario";
import { Vestidor } from "./Vestidor";
import { CalendarAndKits, ClubVitrina, RaceAndBirthdays, SeasonPulse, Sponsors, VestuarioBand } from "./Sections";
import "../../styles/home.css";

/** Public home, "El vestidor": the club's current season told around the 3D kit. */
export function HomePage() {
  const { matches, players } = useClubData();
  const { seasons } = useSeason();
  const content = useClubContent();
  const now = useClock();
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
  const scorers = leaders(lines, "goals");
  const [assister] = leaders(lines, "assists", 1);
  const nameOf = (id: string) => lines.find((l) => l.id === id)?.name ?? playerName(players.find((p) => p.id === id));
  const story = narrative(pulse, { seasonName, squadSize: squad.length, now, nameOf, scorer: scorers[0] });

  // A random player on every visit (fixed for the visit), then whoever the viewer picks.
  const [seed] = useState(() => Math.random());
  const [picked, setPicked] = useState<string | null>(null);
  const [kit, setKit] = useState<"home" | "away">("home");
  const defaultId = squad[Math.floor(seed * squad.length)]?.id;
  const selIndex = Math.max(0, lines.findIndex((l) => l.id === (picked ?? defaultId)));
  const selected = lines[selIndex];
  const moment = selected ? playerMoment(selected, { pichichiId: scorers[0]?.id, lastMatch: pulse.last }) : "";

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
      {lines.length > 0 ? (
        <Vestidor
          narrative={story}
          seasonName={seasonName}
          squad={lines}
          sel={selIndex}
          onSelect={(i) => setPicked(lines[i].id)}
          kit={kit}
          onKit={setKit}
          theme={theme}
          moment={moment}
          next={pulse.next}
          live={pulse.live}
          now={now}
        />
      ) : (
        <section className="hm-hero" aria-label="Portada" aria-busy="true">
          <div className="hm-in">
            <div className="hm-intro">
              <span className="k">{seasonName}</span>
              <h1>
                MANCHESTER <em>PITI</em>
              </h1>
              <p className="hm-narr">Cargando la plantilla…</p>
            </div>
          </div>
        </section>
      )}
      <SeasonPulse pulse={pulse} />
      <RaceAndBirthdays scorers={scorers} assister={assister} birthdays={upcomingBirthdays(squad, now)} />
      <ClubVitrina medals={clubMedals(pulse, lines, nameOf, (d) => formatDate(d))} seasonName={seasonName} />
      <CalendarAndKits pulse={pulse} now={now} nameOf={nameOf} kit={kit} onKit={setKit} />
      <Sponsors sponsors={content.sponsors} />
      <VestuarioBand theme={theme} />
      <CelesteFooter />
      <CelesteDock active="inicio" />
    </div>
  );
}
