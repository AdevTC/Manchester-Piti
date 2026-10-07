// La pizarra «Noche de partido» (behind /pizarra?v2 until it replaces the old board): the Celeste chrome
// around the app screen, wired to the app's data — the season's squad and matches, your boards
// (useLineups, autosaved), the board you are allowed to edit, the official the team sees (with the
// reactions to it) and the convocatoria of the board's match on the cromos.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useSeason } from "../../../context/SeasonContext";
import { useClock } from "../../../hooks/useClock";
import { useTheme } from "../../../hooks/useTheme";
import { Hint } from "../../../components/ui/hint";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../../components/celeste/Chrome";
import { initials } from "../../../lib/vestuario";
import { useLineups } from "../useLineups";
import { useReactions } from "../useReactions";
import { useBoardData } from "./useBoardData";
import { useBoardSession } from "./useBoardSession";
import { useConvocatoria } from "./useConvocatoria";
import { Board } from "./Board";
import { readPrefs, writePrefs, type BoardPrefs } from "./prefs";
import { matchDay, matchShort, officialFor, withConvocatoria } from "./boards";
import { CREST, Icon } from "./icons";
import { forgetDeepLink } from "./deeplink";
import "../../../styles/pizarra.css";
import "../../../styles/pizarra-app.css";

/** The header's day/night switch, sharing its state with Ajustes → «Partido de día». */
function ThemeButton({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const next = dark ? "claro" : "oscuro";
  return (
    <Hint label={`Cambiar a tema ${next}`}>
      <button type="button" onClick={onToggle} className="mp-theme-toggle" aria-label={`Cambiar a tema ${next}`}>
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </Hint>
  );
}

export function PizarraV2() {
  const { user, profile } = useAuth();
  const { seasons, selectedSeasonId } = useSeason();
  const navigate = useNavigate();
  // The season is URL-authoritative (SeasonUrlSync adopts ?season into context): picking one navigates.
  const pickSeason = (id: string) => void navigate({ to: ".", search: (prev) => ({ ...prev, season: id }) });
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const data = useBoardData(selectedSeasonId);
  const lineups = useLineups(selectedSeasonId);
  const squadIds = useMemo(() => data.squad.list.map((c) => c.id), [data.squad]);
  const now = useClock(60_000);
  const { theme, toggle: toggleTheme } = useTheme();
  const [prefs, setPrefsState] = useState(readPrefs);
  const setPrefs = (p: Partial<BoardPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      writePrefs(next);
      return next;
    });
  };

  const draftName = data.next ? matchShort(data.next) : "Mi tablero";
  const session = useBoardSession({
    seasonId: selectedSeasonId,
    lineups,
    squadIds,
    squadReady: !data.loading,
    uid: user?.uid ?? "preview",
    isAdmin,
    draftName,
  });
  // The board's match: the linked one, else the next. Its convocatoria goes on the cromos.
  const linked = data.calendar.find((c) => c.id === session.matchId) ?? null;
  const m = linked ?? data.next;
  const conv = useConvocatoria(m?.id ?? null);
  const squad = useMemo(() => withConvocatoria(data.squad, conv.conv), [data.squad, conv.conv]);
  const match = m ? { short: matchShort(m), date: matchDay(m.dateMs) } : null;
  // The official the team sees for this board: the one on screen when it is, else the match's or the season's.
  const official = session.official ? (lineups.official.find((d) => d.id === session.id) ?? null) : officialFor(session.officials, m?.id ?? null);
  const reactions = useReactions(official ? { id: official.id, isOfficial: official.isOfficial } : null);
  const seasonName = selectedSeasonId === "all" ? "Histórico total" : (seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Temporada");
  const nick = profile?.nickname ?? "";
  // The board has opened where the link asked: coming back later starts from the board you left.
  useEffect(() => {
    if (session.ready) forgetDeepLink();
  }, [session.ready]);

  return (
    <Board
      session={session}
      squad={squad}
      seasonId={selectedSeasonId}
      seasonName={seasonName}
      seasons={seasons}
      onSeason={pickSeason}
      match={match}
      meId={profile?.playerId ?? null}
      prefs={prefs}
      onPrefs={setPrefs}
      now={now}
      calendar={data.calendar}
      nextMatch={data.next}
      isAdmin={isAdmin}
      official={official}
      reactions={official ? { enabled: reactions.enabled, ok: reactions.ok, dudas: reactions.dudas, mine: reactions.mine, react: reactions.react } : null}
      conv={{ match: m, loading: conv.loading, error: conv.error }}
      theme={{ day: theme === "light", toggle: toggleTheme }}
      crest={
        <Link className="crest" to="/" aria-label="Manchester Piti: inicio">
          <img src={CREST} alt="" />
        </Link>
      }
      header={
        <CelesteHeader
          active="vestuario"
          sub="La pizarra"
          actions={
            <>
              <button
                type="button"
                className="mp-theme-toggle"
                onClick={() => setPrefs({ snd: !prefs.snd })}
                aria-pressed={prefs.snd}
                aria-label={prefs.snd ? "Silenciar los sonidos" : "Activar los sonidos"}
              >
                {prefs.snd ? <Icon n="sndOn" w={19} /> : <Icon n="sndOff" w={19} />}
              </button>
              <ThemeButton dark={theme === "dark"} onToggle={toggleTheme} />
              <Link className={"vx-avatar" + (isAdmin ? " cap" : "")} to="/profile" aria-label={"Tu perfil: " + nick}>
                {initials(nick)}
              </Link>
            </>
          }
        />
      }
      footer={
        <>
          <CelesteFooter />
          <CelesteDock active="vestuario" />
        </>
      }
    />
  );
}
