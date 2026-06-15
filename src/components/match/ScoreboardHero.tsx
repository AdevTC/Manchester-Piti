import React, { useMemo } from "react";
import { groupEvents, outcomeOf, OUTCOME, formatLongDate, type MatchDoc } from "./matchData";
import { FlapNumber } from "./FlapNumber";
import { DotMatrixScorers, BoardSheet } from "./BoardBits";

const BAR: Record<string, string> = { win: "#6CABDD", draw: "#FFC659", loss: "#ef5446" };

/** LA ÚLTIMA — the latest result, bloomed to the board's jumbo panel: a
 *  split-flap scoreline lit by the one floodlight, with our scorers running on
 *  the dot-matrix sub-board and the full breakdown inked in beneath. */
export const ScoreboardHero: React.FC<{ match: MatchDoc; playersMap: Record<string, string> }> = ({
  match,
  playersMap,
}) => {
  const gf = match.goalsFor ?? 0;
  const gc = match.goalsAgainst ?? 0;
  const outcome = outcomeOf(gf, gc);
  const groups = useMemo(() => groupEvents(match.events, playersMap), [match.events, playersMap]);
  const dateStr = formatLongDate(match.date);
  const rival = match.rival || "Rival";

  const homeBar = outcome === "win" || outcome === "draw" ? BAR[outcome] : null;
  const awayBar = outcome === "loss" || outcome === "draw" ? BAR[outcome] : null;

  return (
    <section
      className="mp-bd-hero"
      data-outcome={outcome}
      aria-label={`Última entrada: ${OUTCOME[outcome].word}, Manchester Piti ${gf}, ${rival} ${gc}. ${match.competition || "Liga"}.${dateStr ? ` ${dateStr}.` : ""}`}
    >
      <span className="mp-bd-hero-light" aria-hidden="true" />
      <span className="mp-bd-hero-crest" aria-hidden="true" />
      <span className="mp-bd-hero-grain" aria-hidden="true" />
      <span className="mp-bd-hero-sweep" aria-hidden="true" />

      <div className="mp-bd-hero-in">
        <div className="mp-bd-hero-top">
          <span className="mp-bd-hero-kicker">Última entrada · {match.competition || "Liga"}</span>
          <span className={`mp-bd-hero-verdict mp-bd-hero-verdict--${outcome}`}>
            {outcome === "win" ? (
              <svg className="mp-bd-hero-shine" viewBox="0 0 16 16" width="0.9em" height="0.9em" aria-hidden="true">
                <path d="M8 0 L9.7 6.3 L16 8 L9.7 9.7 L8 16 L6.3 9.7 L0 8 L6.3 6.3 Z" fill="currentColor" />
              </svg>
            ) : (
              <span className="mp-bd-hero-verdict-dot" aria-hidden="true" />
            )}
            {OUTCOME[outcome].word}
          </span>
        </div>

        <div className="mp-bd-hero-score">
          <span className="mp-bd-hero-team mp-bd-hero-team--home">Manchester Piti</span>

          <span className="mp-bd-hero-nums" aria-hidden="true">
            <span
              className={`mp-bd-hero-num${homeBar ? " mp-bd-hero-num--bar" : ""}`}
              style={homeBar ? ({ ["--bar" as string]: homeBar } as React.CSSProperties) : undefined}
            >
              <FlapNumber value={gf} />
            </span>
            <span className="mp-bd-hero-colon" aria-hidden="true">
              :
            </span>
            <span
              className={`mp-bd-hero-num${awayBar ? " mp-bd-hero-num--bar" : ""}`}
              style={awayBar ? ({ ["--bar" as string]: awayBar } as React.CSSProperties) : undefined}
            >
              <FlapNumber value={gc} startDelayMs={Math.min(900, 95 * Math.max(0, Math.round(gf))) + 140} />
            </span>
          </span>

          <span className="mp-bd-hero-team mp-bd-hero-team--away">{rival}</span>
        </div>

        <div className="mp-bd-hero-meta">
          {dateStr && <span className="mp-bd-hero-date">{dateStr}</span>}
          <span className="mp-bd-hero-honesty">Nuestra historia · solo nuestro bando</span>
        </div>

        <DotMatrixScorers groups={groups} goalsFor={gf} variant="hero" />
        <BoardSheet groups={groups} goalsFor={gf} hideGoals />
      </div>
    </section>
  );
};
