// La pizarra «Noche de partido» (behind /pizarra?v2 until it replaces the old board): the Celeste chrome
// around the app screen, wired to the app's data — the season's squad and matches, your boards
// (useLineups, autosaved) and the board you are allowed to edit.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { useSeason } from "../../../context/SeasonContext";
import { useClock } from "../../../hooks/useClock";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { CelesteDock, CelesteFooter, CelesteHeader } from "../../../components/celeste/Chrome";
import { initials } from "../../../lib/vestuario";
import { useLineups } from "../useLineups";
import { useBoardData } from "./useBoardData";
import { useBoardSession } from "./useBoardSession";
import { Board, type BoardPrefs } from "./Board";
import { CREST, Icon } from "./icons";
import "../../../styles/pizarra.css";
import "../../../styles/pizarra-app.css";

const PREFS_KEY = "mp_pizarra_v2_prefs";
const PREFS0: BoardPrefs = { snd: false, grid: true };
function readPrefs(): BoardPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...PREFS0, ...(JSON.parse(raw) as Partial<BoardPrefs>) } : PREFS0;
  } catch {
    return PREFS0;
  }
}

const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });

export function PizarraV2() {
  const { user, profile } = useAuth();
  const { seasons, selectedSeasonId, setSelectedSeasonId } = useSeason();
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const data = useBoardData(selectedSeasonId);
  const lineups = useLineups(selectedSeasonId);
  const squadIds = useMemo(() => data.squad.list.map((c) => c.id), [data.squad]);
  const now = useClock(60_000);
  const [prefs, setPrefsState] = useState(readPrefs);
  const setPrefs = (p: Partial<BoardPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode: this visit only */
      }
      return next;
    });
  };

  const draftName = data.next ? `J${data.next.j} · ${data.next.rival}` : "Mi tablero";
  const session = useBoardSession({
    seasonId: selectedSeasonId,
    lineups,
    squadIds,
    squadReady: !data.loading,
    uid: user?.uid ?? "preview",
    isAdmin,
    draftName,
  });
  const m = data.calendar.find((c) => c.id === session.matchId) ?? data.next;
  const match = m ? { short: `J${m.j} · ${m.rival}`, date: m.dateMs ? dayFmt.format(new Date(m.dateMs)).replace(/,/g, "") : "" } : null;
  const seasonName = selectedSeasonId === "all" ? "Histórico total" : (seasons.find((s) => s.id === selectedSeasonId)?.name ?? "Temporada");
  const nick = profile?.nickname ?? "";

  return (
    <Board
      session={session}
      squad={data.squad}
      seasonId={selectedSeasonId}
      seasonName={seasonName}
      seasons={seasons}
      onSeason={setSelectedSeasonId}
      match={match}
      meId={profile?.playerId ?? null}
      prefs={prefs}
      onPrefs={setPrefs}
      now={now}
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
              <ThemeToggle />
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
