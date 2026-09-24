import { shareClubPage } from "../lib/share";
import { useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowUpRight, Download, Share2 } from "lucide-react";
import {
  useClubData,
  playerName,
  EVENT_LABELS,
  matchPhase,
  isCompleted,
} from "../lib/clubData";
import { useClock } from "../hooks/useClock";
import {
  FixtureCard,
  CalendarDownload,
  DataState,
} from "../components/club/ClubUI";
import { MvpVote } from "./Vestuario";
import { downloadMatchPoster } from "../lib/matchPoster";
export function MatchDetail() {
  const { matchId } = getRouteApi("/matches/$matchId").useParams();
  const { matches, players, loading, error } = useClubData();
  const now = useClock();
  const [notice, setNotice] = useState("");
  const match = matches.find((m) => m.id === matchId);
  if (loading || error)
    return (
      <div className="club-page">
        <DataState loading={loading} error={error} />
      </div>
    );
  if (!match)
    return (
      <div className="club-empty">
        <h1>Partido no encontrado</h1>
        <Link to="/partidos">Volver a partidos</Link>
      </div>
    );
  const names = Object.fromEntries(players.map((p) => [p.id, playerName(p)]));
  const past = matches.filter(
    (m) => m.id !== match.id && m.rival === match.rival && isCompleted(m),
  );
  const share = async () => {
    try {
      await shareClubPage(
        "partido",
        match.id,
        "Manchester Piti vs " + match.rival,
      );
      setNotice(typeof navigator.share === "function" ? "" : "Enlace copiado.");
    } catch {
      setNotice("No se ha compartido el enlace.");
    }
  };
  const poster = async (format: "square" | "story") => {
    try {
      await downloadMatchPoster(match, format);
      setNotice("Cartel descargado.");
    } catch {
      setNotice("No se pudo generar el cartel.");
    }
  };
  return (
    <div className="club-page">
      <Link className="club-text-link" to="/partidos">
        ← Todos los partidos
      </Link>
      <div className="club-match-detail">
        <FixtureCard match={match} featured />
      </div>
      <div className="club-actions">
        {matchPhase(match, now) === "scheduled" && (
          <CalendarDownload match={match} />
        )}
        <button className="club-button secondary" onClick={() => void share()}>
          <Share2 size={16} />
          Compartir partido
        </button>
        <button
          className="club-button secondary"
          onClick={() => void poster("square")}
        >
          <Download size={16} />
          Cartel cuadrado
        </button>
        <button
          className="club-button secondary"
          onClick={() => void poster("story")}
        >
          <Download size={16} />
          Historia vertical
        </button>
        {match.venue && (
          <a
            className="club-text-link"
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(match.venue)
            }
            target="_blank"
            rel="noreferrer"
          >
            Cómo llegar <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {match.report && (
        <section className="club-panel">
          <h2>Así lo vivimos</h2>
          <p className="club-long-copy">{match.report}</p>
        </section>
      )}
      {match.photoUrl && (
        <img
          className="club-report-photo"
          src={match.photoUrl}
          alt={"Manchester Piti contra " + match.rival}
        />
      )}
      <div className="club-grid-2">
        <section className="club-panel">
          <h2>La historia del partido</h2>
          <div className="club-timeline">
            {(match.events ?? [])
              .filter((e) => e.type !== "match_played")
              .slice()
              .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
              .map((e, i) => (
                <article key={e.id || i}>
                  <b>{e.minute !== undefined ? e.minute + "′" : "—"}</b>
                  <div>
                    <h3>{EVENT_LABELS[e.type] || e.type}</h3>
                    <p>
                      {names[e.playerId || ""] ||
                        (["opponent_goal", "opponent_own_goal"].includes(e.type)
                          ? match.rival
                          : "")}
                      {e.inPlayerId && " → " + names[e.inPlayerId]}
                      {e.assistPlayerId &&
                        " · Asistencia de " + names[e.assistPlayerId]}
                    </p>
                    {e.note && <small>{e.note}</small>}
                  </div>
                </article>
              ))}
          </div>
          {!match.events?.length && (
            <p>
              {isCompleted(match)
                ? "No se registraron eventos para este partido."
                : "El acta aparecerá después del encuentro."}
            </p>
          )}
        </section>
        <section className="club-panel">
          <h2>Los nuestros</h2>
          {match.version === 2 ? (
            <>
              {[
                ["El siete inicial", match.starters],
                ["Banquillo", match.bench],
                ["No convocados", match.notCalled],
              ].map(([label, ids]) => (
                <div className="club-lineup-list" key={label as string}>
                  <h3>{label as string}</h3>
                  {((ids as string[]) ?? []).map((id) => (
                    <Link
                      to="/jugadores/$playerId"
                      params={{ playerId: id }}
                      key={id}
                    >
                      <span>{names[id] || "Jugador"}</span>
                      <b>
                        {match.ledger?.[id]
                          ? match.ledger[id].minutes + "′"
                          : "→"}
                      </b>
                    </Link>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <p>
              Este partido pertenece al archivo anterior: no se registró su
              convocatoria completa.
            </p>
          )}
        </section>
      </div>
      {match.gallery && match.gallery.length > 0 && (
        <section className="club-grid-3">
          {match.gallery.map((url, i) => (
            <img
              key={url}
              className="club-gallery-image"
              src={url}
              alt={"Foto " + (i + 1) + " del partido"}
              loading="lazy"
            />
          ))}
        </section>
      )}
      <MvpVote match={match} />
      {past.length > 0 && (
        <section className="club-panel">
          <h2>Ya nos hemos visto</h2>
          <p>
            {past.length} encuentros anteriores en el archivo contra{" "}
            {match.rival}.
          </p>
          <div className="club-actions">
            {past.slice(0, 5).map((m) => (
              <Link
                key={m.id}
                to="/matches/$matchId"
                params={{ matchId: m.id }}
                className="club-button secondary"
              >
                {m.goalsFor}–{m.goalsAgainst} →
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export default MatchDetail;
