// "¡GOL!" over a live scoreboard when we score: a flash, the word and confetti in the club colours for
// ~2.6 s. Whether to play it is decided by useGoalCelebration (only a goal that is new since the screen
// opened and happened right now, never a goal already in the data); with reduced motion the word just
// appears (styles/partidos.css turns the animations off).
import type { CSSProperties } from "react";

const PIECES = Array.from({ length: 46 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  "--r": `${(i * 53) % 180}deg`,
  "--d": `${(1.8 + ((i * 7) % 10) / 10).toFixed(2)}s`,
  "--w": `${((i * 3) % 9) / 20}s`,
  background: ["#6CABDD", "#FFC659", "#eef4ff", "#9fd0f2", "#ffe0a0"][i % 5],
}));

/** `burst` is the key from useGoalCelebration: 0 shows nothing, each new value plays the show once. */
export function GoalBurst({ burst, who }: { burst: number; who?: string }) {
  if (!burst) return null;
  return (
    <div className="pt-goal" key={burst} role="status">
      <span className="flash" />
      <div className="confetti" aria-hidden="true">
        {PIECES.map((style, i) => (
          <i key={i} style={style as CSSProperties} />
        ))}
      </div>
      <span className="word">¡GOL!</span>
      {who && <span className="who">{who}</span>}
    </div>
  );
}
