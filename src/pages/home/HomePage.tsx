import { useEffect, useRef, useState } from "react";
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

  // Changing player: the outgoing one stays briefly for its exit animation (removed by a timer,
  // so it never lingers, even without animations).
  const [leaving, setLeaving] = useState<string | null>(null);
  const touched = useRef(0);
  const leaveTimer = useRef(0);
  const current = useRef<string | undefined>(undefined);
  useEffect(() => {
    current.current = selected?.id;
  });
  const go = (nextId: string | undefined, manual = false) => {
    if (manual) touched.current = Date.now();
    const from = current.current;
    if (!nextId || nextId === from) return;
    window.clearTimeout(leaveTimer.current);
    setLeaving(from ?? null);
    setPicked(nextId);
    current.current = nextId;
    leaveTimer.current = window.setTimeout(() => setLeaving(null), 900);
  };
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  // Every 8 s the next player of a shuffled pass through the squad: nobody repeats until all
  // have been shown. Held 20 s after the viewer picks, while the pointer is over the cartel,
  // and while the tab is hidden.
  const [auto, setAuto] = useState(true);
  const holding = useRef(false);
  const bag = useRef<string[]>([]);
  const ids = squad.map((p) => p.id).join(",");
  useEffect(() => {
    const list = ids ? ids.split(",") : [];
    if (!auto || list.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden || holding.current || Date.now() - touched.current < 20_000) return;
      bag.current = bag.current.filter((id) => list.includes(id) && id !== current.current);
      if (!bag.current.length) {
        bag.current = list.filter((id) => id !== current.current);
        for (let i = bag.current.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag.current[i], bag.current[j]] = [bag.current[j], bag.current[i]];
        }
      }
      goRef.current(bag.current.pop());
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [auto, ids]);
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
          onSelect={(i) => go(lines[i].id, true)}
          leaving={lines.find((l) => l.id === leaving)}
          auto={auto}
          onToggleAuto={() => setAuto((a) => !a)}
          onHold={(h) => {
            holding.current = h;
          }}
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
