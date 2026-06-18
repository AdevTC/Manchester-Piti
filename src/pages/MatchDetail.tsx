import React from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { matchDetailQuery, playersNameMapQuery } from "../lib/detailQueries";
import {
  groupEvents,
  outcomeOf,
  OUTCOME,
  formatLongDate,
  type RawEvent,
  type FireDate,
} from "../components/match/matchData";
import { BoardSheet } from "../components/match/BoardBits";
import "./MatchDetail.css";

const route = getRouteApi("/matches/$matchId");

export const MatchDetail: React.FC = () => {
  const { matchId } = route.useParams();
  // Same queryKey the route loader warmed via ensureQueryData → hot cache, no
  // double fetch. The name map is prefetched here (cheap, shared key).
  const { data: match } = useQuery(matchDetailQuery(matchId));
  const { data: names = {} } = useQuery(playersNameMapQuery);

  if (!match) {
    return (
      <div className="md-page fade-in">
        <Link to="/" className="md-back">
          <ArrowLeft size={16} aria-hidden="true" /> Volver al marcador
        </Link>
        <div className="md-empty">
          <span className="md-empty-mark">Partido no encontrado</span>
          <p className="md-empty-text">
            No hay ninguna entrada con esta referencia. Puede que se haya eliminado.
          </p>
        </div>
      </div>
    );
  }

  const gf = (match.goalsFor as number | undefined) ?? 0;
  const gc = (match.goalsAgainst as number | undefined) ?? 0;
  const outcome = outcomeOf(gf, gc);
  const groups = groupEvents(match.events as RawEvent[] | undefined, names);
  const rival = (match.rival as string | undefined) || "Rival";
  const competition = (match.competition as string | undefined) || "Liga";
  const longDate = formatLongDate(match.date as FireDate);

  return (
    <div className="md-page fade-in">
      <Link to="/" className="md-back">
        <ArrowLeft size={16} aria-hidden="true" /> Volver al marcador
      </Link>

      <header className="md-head" data-outcome={outcome}>
        <span className="md-comp">{competition}</span>
        <h2 className="md-fixture">
          <span className="md-club">Manchester Piti</span>
          <span className="md-vs" aria-hidden="true">
            vs
          </span>
          <span className="md-rival">{rival}</span>
        </h2>
        {longDate && <p className="md-date">{longDate}</p>}

        <div
          className="md-score"
          aria-label={`${OUTCOME[outcome].word}: Manchester Piti ${gf}, ${rival} ${gc}`}
        >
          <span className={`md-score-n md-score-n--${outcome === "win" ? "win" : "muted"}`}>{gf}</span>
          <span className="md-score-colon" aria-hidden="true">
            :
          </span>
          <span className={`md-score-n ${outcome === "loss" ? "md-score-n--loss" : "md-score-n--muted"}`}>{gc}</span>
        </div>
        <span className={`md-outcome md-outcome--${outcome}`}>{OUTCOME[outcome].word}</span>
      </header>

      <section className="md-detail" aria-label="Detalle del partido">
        {groups.hasAny || groups.lineup.length > 0 ? (
          <BoardSheet groups={groups} goalsFor={gf} />
        ) : (
          <p className="md-detail-empty">Sin anotaciones registradas para este partido.</p>
        )}
      </section>
    </div>
  );
};

export default MatchDetail;
