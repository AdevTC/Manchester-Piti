// "¡GOL!" over a live scoreboard when our score goes up: a flash, the word and confetti in the club
// colours for ~2.6 s. Never on the first render (only a goal seen live) and with reduced motion the
// word just appears (styles/partidos.css turns the animations off).
import { useEffect, useRef, useState, type CSSProperties } from "react";

const PIECES = Array.from({ length: 46 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  "--r": `${(i * 53) % 180}deg`,
  "--d": `${(1.8 + ((i * 7) % 10) / 10).toFixed(2)}s`,
  "--w": `${((i * 3) % 9) / 20}s`,
  background: ["#6CABDD", "#FFC659", "#eef4ff", "#9fd0f2", "#ffe0a0"][i % 5],
}));

export function GoalBurst({ goals, who }: { goals: number; who?: string }) {
  const seen = useRef(goals);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (goals > seen.current) setBurst((n) => n + 1);
    seen.current = goals;
  }, [goals]);
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(0), 2700);
    return () => window.clearTimeout(t);
  }, [burst]);
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
