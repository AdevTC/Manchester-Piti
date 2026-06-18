import React from "react";
import { motion } from "motion/react";
import { EventGlyph, type GlyphKind } from "./MatchBits";
import { OUTCOME, type EventGroups, type Outcome } from "./matchData";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* ---------------- Result flap tile (V / E / D) ----------------
 * Mount flip via Motion. The 3D read comes from the CSS already on the tile:
 * `.mp-bd-tile { perspective }` + `.mp-bd-tile-card { transform-origin: 50% 0 }`.
 * Reduced motion neutralizes the rotateX via the global <MotionConfig>. */
export const FlapTile: React.FC<{ outcome: Outcome; size?: "lg" | "sm" }> = ({ outcome, size = "sm" }) => (
  <span className={`mp-bd-tile mp-bd-tile--${outcome} mp-bd-tile--${size}`} aria-hidden="true">
    <motion.span
      className="mp-bd-tile-card"
      initial={{ rotateX: -90 }}
      animate={{ rotateX: 0 }}
      transition={{ duration: 0.42, ease: "easeOut" }}
    >
      {OUTCOME[outcome].letter}
    </motion.span>
  </span>
);

/* ---------------- Dot-matrix scorer strip (always visible) ----------------
 * The first-class, never-hidden record of OUR side of every match: who scored,
 * from where, who assisted, plus a glyph cluster for cards / keeper moments. */
export const DotMatrixScorers: React.FC<{
  groups: EventGroups;
  goalsFor: number;
  variant?: "hero" | "row";
}> = ({ groups, goalsFor, variant = "row" }) => {
  const hasGoals = groups.scorerTokens.length > 0 || groups.ownGoals.length > 0;

  const allChips: { kind: GlyphKind; n: number; tone: string; label: string }[] = [
    { kind: "yellow", n: groups.yellow.length, tone: "gold", label: plural(groups.yellow.length, "amarilla", "amarillas") },
    { kind: "double", n: groups.double.length, tone: "gold", label: plural(groups.double.length, "doble amarilla", "dobles amarillas") },
    { kind: "red", n: groups.red.length, tone: "red", label: plural(groups.red.length, "roja", "rojas") },
    { kind: "saved", n: groups.penaltySaved.length, tone: "sky", label: plural(groups.penaltySaved.length, "penalti parado", "penaltis parados") },
    { kind: "missed", n: groups.penaltyMissed.length, tone: "red", label: plural(groups.penaltyMissed.length, "penalti fallado", "penaltis fallados") },
    { kind: "woodwork", n: groups.woodwork.length, tone: "neutral", label: plural(groups.woodwork.length, "tiro al palo", "tiros al palo") },
  ];
  const chips = allChips.filter((c) => c.n > 0);
  const assistsOnly = groups.standaloneAssists.length;
  const hasContent = hasGoals || chips.length > 0 || assistsOnly > 0;

  // A row that produced nothing from our side stays quiet (no lit sub-board), so
  // the matches that DID score keep all the visual weight on the board.
  if (variant === "row" && !hasContent) {
    return (
      <span className="mp-bd-feed-quiet">
        Sin goles{goalsFor > 0 ? ` · ${plural(goalsFor, "gol a favor", "goles a favor")}` : ""}
      </span>
    );
  }

  return (
    <div className={`mp-bd-matrix mp-bd-matrix--${variant}`}>
      <span className="mp-bd-matrix-tex" aria-hidden="true" />
      {variant === "hero" && <span className="mp-bd-matrix-label">Goles</span>}
      <span className="mp-bd-matrix-feed">
        {hasGoals ? (
          <>
            {groups.scorerTokens.map((t, i) => (
              <span className="mp-bd-scorer" key={`s-${i}`} style={{ ["--si" as string]: i }}>
                <span className="mp-bd-scorer-name">{t.name}</span>
                {t.count > 1 && <sup className="mp-bd-scorer-x">&times;{t.count}</sup>}
                {t.penalty && (
                  <sup className="mp-bd-scorer-tag" title="de penalti" aria-label="de penalti">
                    P
                  </sup>
                )}
                {t.freekick && (
                  <sup className="mp-bd-scorer-tag" title="de falta" aria-label="de falta">
                    F
                  </sup>
                )}
                {t.assists.length > 0 && <span className="mp-bd-scorer-assist"> &rsaquo; {t.assists.join(", ")}</span>}
              </span>
            ))}
            {groups.ownGoals.map((n, i) => (
              <span className="mp-bd-scorer mp-bd-scorer--og" key={`og-${i}`} style={{ ["--si" as string]: groups.scorerTokens.length + i }}>
                <span className="mp-bd-scorer-name">{n}</span>
                <sup className="mp-bd-scorer-tag">p.p.</sup>
              </span>
            ))}
          </>
        ) : (
          <span className="mp-bd-matrix-none">
            Sin goles{goalsFor > 0 ? ` · ${plural(goalsFor, "gol a favor", "goles a favor")}` : " registrados"}
          </span>
        )}
      </span>

      {(chips.length > 0 || assistsOnly > 0) && (
        <span className="mp-bd-matrix-marks">
          {chips.map((c) => (
            <span className={`mp-bd-mark mp-bd-mark--${c.tone}`} key={c.kind} title={c.label} aria-label={c.label}>
              <EventGlyph kind={c.kind} label="" />
              <b>{c.n}</b>
            </span>
          ))}
          {assistsOnly > 0 && (
            <span className="mp-bd-mark mp-bd-mark--asist" title={plural(assistsOnly, "asistencia", "asistencias")}>
              <span className="mp-bd-mark-asist-glyph" aria-hidden="true">
                &rsaquo;
              </span>
              <b>{assistsOnly}</b>
            </span>
          )}
        </span>
      )}
    </div>
  );
};

/* ---------------- Expanded detail sheet (board-styled columns) ---------------- */
const SheetLine: React.FC<{ tone?: string; glyph?: GlyphKind; label: string; children: React.ReactNode }> = ({
  tone,
  glyph,
  label,
  children,
}) => (
  <li className="mp-bd-sheet-line">
    {glyph && (
      <span className={`mp-bd-sheet-glyph mp-bd-ink-${tone ?? "neutral"}`} aria-hidden="true">
        <EventGlyph kind={glyph} label={label} />
      </span>
    )}
    <span className="mp-bd-sheet-text">{children}</span>
  </li>
);

export const BoardSheet: React.FC<{ groups: EventGroups; goalsFor: number; hideGoals?: boolean }> = ({
  groups,
  goalsFor,
  hideGoals = false,
}) => {
  const cols: { key: string; label: string; body: React.ReactNode }[] = [];

  if (!hideGoals && (groups.goalLines.length > 0 || groups.ownGoals.length > 0)) {
    cols.push({
      key: "goles",
      label: "Goles",
      body: (
        <ul className="mp-bd-sheet-list">
          {groups.goalLines.map((g, i) => (
            <li className="mp-bd-goal" key={`g-${i}`}>
              <span className="mp-bd-goal-scorer">{g.scorer}</span>
              {g.kind === "penalty" && <span className="mp-bd-goal-tag">de penalti</span>}
              {g.kind === "freekick" && <span className="mp-bd-goal-tag">de falta</span>}
              {g.assist && <span className="mp-bd-goal-assist">&rsaquo; asist. {g.assist}</span>}
            </li>
          ))}
          {groups.ownGoals.map((n, i) => (
            <li className="mp-bd-goal mp-bd-goal--og" key={`og-${i}`}>
              <span className="mp-bd-goal-scorer">{n}</span>
              <span className="mp-bd-goal-tag">en propia (p.p.)</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (groups.yellow.length > 0 || groups.double.length > 0 || groups.red.length > 0) {
    cols.push({
      key: "disc",
      label: "Disciplina",
      body: (
        <ul className="mp-bd-sheet-list">
          {groups.yellow.map((n, i) => (
            <SheetLine key={`y-${i}`} glyph="yellow" tone="gold" label="Amarilla">
              {n}
            </SheetLine>
          ))}
          {groups.double.map((n, i) => (
            <SheetLine key={`dy-${i}`} glyph="double" tone="gold" label="Doble amarilla">
              {n} <span className="mp-bd-sheet-note">doble amarilla</span>
            </SheetLine>
          ))}
          {groups.red.map((n, i) => (
            <SheetLine key={`r-${i}`} glyph="red" tone="red" label="Roja">
              {n} <span className="mp-bd-sheet-note">roja</span>
            </SheetLine>
          ))}
        </ul>
      ),
    });
  }

  if (groups.penaltySaved.length > 0 || groups.penaltyMissed.length > 0 || groups.woodwork.length > 0) {
    cols.push({
      key: "keeper",
      label: "Portería y madera",
      body: (
        <ul className="mp-bd-sheet-list">
          {groups.penaltySaved.map((n, i) => (
            <SheetLine key={`ps-${i}`} glyph="saved" tone="sky" label="Penalti parado">
              {n} <span className="mp-bd-sheet-note">penalti parado</span>
            </SheetLine>
          ))}
          {groups.penaltyMissed.map((n, i) => (
            <SheetLine key={`pm-${i}`} glyph="missed" tone="red" label="Penalti fallado">
              {n} <span className="mp-bd-sheet-note">penalti fallado</span>
            </SheetLine>
          ))}
          {groups.woodwork.map((n, i) => (
            <SheetLine key={`w-${i}`} glyph="woodwork" tone="neutral" label="Tiro al palo">
              {n} <span className="mp-bd-sheet-note">al palo</span>
            </SheetLine>
          ))}
        </ul>
      ),
    });
  }

  if (groups.standaloneAssists.length > 0) {
    cols.push({
      key: "asis",
      label: "Asistencias",
      body: (
        <ul className="mp-bd-sheet-list">
          {groups.standaloneAssists.map((n, i) => (
            <li className="mp-bd-sheet-line" key={`a-${i}`}>
              <span className="mp-bd-sheet-text mp-bd-ink-sky">{n}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // On the hero the goals already live in the dot-matrix strip; if no other
  // detail exists there is nothing to add, so render nothing.
  if (hideGoals && cols.length === 0 && groups.lineup.length === 0) return null;

  return (
    <div className="mp-bd-sheet">
      {cols.length > 0 ? (
        <div className="mp-bd-sheet-cols">
          {cols.map((c) => (
            <section className="mp-bd-sheet-col" key={c.key}>
              <h4 className="mp-bd-sheet-h">{c.label}</h4>
              {c.body}
            </section>
          ))}
        </div>
      ) : (
        // No category columns. On the hero the goals are shown in the strip, so
        // stay silent; on a row's expanded panel, state the honest summary.
        !hideGoals && (
          <p className="mp-bd-sheet-empty">
            Sin anotaciones registradas · {plural(goalsFor, "gol a favor", "goles a favor")}
          </p>
        )
      )}
      {groups.lineup.length > 0 && (
        <p className="mp-bd-sheet-lineup">
          <span className="mp-bd-sheet-lineup-k">Alineación ({groups.lineup.length})</span>
          {groups.lineup.join(" · ")}
        </p>
      )}
    </div>
  );
};
