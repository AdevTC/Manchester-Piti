import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Pause, Play } from "lucide-react";
import { useClubData, playerName, formatDate } from "../../lib/clubData";
import { analysePlayer, chronological } from "../../lib/clubAnalytics";
export function ResultsTicker() {
  const { matches, players, loading, error } = useClubData();
  const [paused, setPaused] = useState(false);
  const entries = useMemo(() => {
    const games = chronological(matches);
    const scored = players
      .map((p) => analysePlayer(p, games))
      .filter((p) => p.matchesPlayed > 0)
      .sort(
        (a, b) =>
          b.goals - a.goals || playerName(a).localeCompare(playerName(b)),
      );
    const result: {
      id: string;
      type: "match" | "player";
      label: string;
      detail: string;
      outcome?: string;
    }[] = [];
    const latest = [...games].reverse();
    for (let i = 0; i < Math.max(latest.length, scored.length); i++) {
      const m = latest[i],
        p = scored[i];
      if (m)
        result.push({
          id: m.id,
          type: "match",
          label: "Piti " + m.goalsFor + "–" + m.goalsAgainst + " " + m.rival,
          detail: formatDate(m.date),
          outcome:
            m.goalsFor! > m.goalsAgainst!
              ? "win"
              : m.goalsFor === m.goalsAgainst
                ? "draw"
                : "loss",
        });
      if (p)
        result.push({
          id: p.id,
          type: "player",
          label: playerName(p),
          detail:
            p.goals +
            " G · " +
            p.assists +
            " A · " +
            p.matchesPlayed +
            " PJ" +
            (p.tracked ? " · " + p.minutes + " MIN" : ""),
        });
    }
    return result;
  }, [matches, players]);
  if (loading || error || !entries.length) return null;
  const width = entries.reduce(
    (s, e) => s + (e.label.length + e.detail.length) * 7 + 100,
    0,
  );
  return (
    <section
      className={"club-ticker" + (paused ? " is-paused" : "")}
      aria-label="Resultados y estadísticas del historial"
    >
      <div className="club-ticker-label">
        <span>EN DATOS</span>
        <button
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"}
          aria-pressed={paused}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
      <div className="club-ticker-window">
        <div
          className="club-ticker-track"
          style={
            {
              "--ticker-duration": Math.max(35, width / 48) + "s",
            } as CSSProperties
          }
        >
          {[0, 1].map((copy) => (
            <div
              className="club-ticker-group"
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
            >
              {entries.map((e) =>
                e.type === "match" ? (
                  <Link
                    key={"m" + e.id}
                    className="club-ticker-item"
                    to="/matches/$matchId"
                    params={{ matchId: e.id }}
                    tabIndex={copy ? -1 : 0}
                  >
                    <i className={e.outcome} />
                    <strong>{e.label}</strong>
                    <small>{e.detail}</small>
                  </Link>
                ) : (
                  <Link
                    key={"p" + e.id}
                    className="club-ticker-item player"
                    to="/jugadores/$playerId"
                    params={{ playerId: e.id }}
                    tabIndex={copy ? -1 : 0}
                  >
                    <span className="ticker-stat-mark">↗</span>
                    <strong>{e.label}</strong>
                    <small>{e.detail}</small>
                  </Link>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
