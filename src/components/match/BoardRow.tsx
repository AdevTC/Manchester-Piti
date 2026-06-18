import React, { useId, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { groupEvents, outcomeOf, OUTCOME, compactDate, formatLongDate, type MatchDoc } from "./matchData";
import { DotMatrixScorers, BoardSheet, FlapTile } from "./BoardBits";

/** One line on the board. Our scorers are always on the dot-matrix feed (never
 *  hidden); the "Crónica" disclosure adds the full breakdown in place. */
export const BoardRow: React.FC<{ match: MatchDoc; playersMap: Record<string, string>; index: number }> = ({
  match,
  playersMap,
  index,
}) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const gf = match.goalsFor ?? 0;
  const gc = match.goalsAgainst ?? 0;
  const outcome = outcomeOf(gf, gc);
  const groups = useMemo(() => groupEvents(match.events, playersMap), [match.events, playersMap]);
  const d = compactDate(match.date);
  const expandable = groups.hasAny || groups.lineup.length > 0;

  const accName = `${OUTCOME[outcome].word}, Manchester Piti ${gf}, ${match.rival ?? "Rival"} ${gc}. ${match.competition || "Liga"}. ${formatLongDate(match.date)}`;

  return (
    <motion.li
      className="mp-bd-row"
      style={{ ["--i" as string]: Math.min(index, 16) } as React.CSSProperties}
      data-outcome={outcome}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: Math.min(index, 16) * 0.05, ease: "easeOut" }}
    >
      <div className="mp-bd-row-main">
        <div className="mp-bd-row-result">
          <FlapTile outcome={outcome} />
          <span className="mp-bd-row-date">
            <b>{d.day}</b>
            <span>
              {d.month} &rsquo;{d.year}
            </span>
          </span>
        </div>

        <div className="mp-bd-row-fixture">
          <span className="mp-bd-row-comp">{match.competition || "Liga"}</span>
          <span className="mp-bd-row-vs">
            <span className="mp-bd-row-vs-pre">vs</span> <strong>{match.rival || "Rival"}</strong>
          </span>
        </div>

        <div className="mp-bd-row-score" aria-label={accName}>
          <span className={`mp-bd-row-num mp-bd-row-num--${outcome === "win" ? "win" : outcome === "draw" ? "draw" : "muted"}`}>
            {gf}
          </span>
          <span className="mp-bd-row-colon" aria-hidden="true">
            :
          </span>
          <span className={`mp-bd-row-num ${outcome === "loss" ? "mp-bd-row-num--loss" : "mp-bd-row-num--muted"}`}>{gc}</span>
        </div>

        <div className="mp-bd-row-feed">
          <DotMatrixScorers groups={groups} goalsFor={gf} variant="row" />
        </div>

        {expandable && (
          <button
            type="button"
            className="mp-bd-row-cronica"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="mp-bd-row-cronica-txt">Crónica</span>
            <ChevronDown size={14} className="mp-bd-row-chev" aria-hidden="true" />
          </button>
        )}
      </div>

      {expandable && open && (
        <div id={panelId} className="mp-bd-row-panel">
          <BoardSheet groups={groups} goalsFor={gf} />
        </div>
      )}
    </motion.li>
  );
};
