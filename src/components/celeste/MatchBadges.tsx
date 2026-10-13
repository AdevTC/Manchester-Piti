import { Icon } from "./icons";
import "./match-badges.css";

/** A single icon per statistic, with a count when it happens more than once. */
export function MatchBadges({ goals = 0, assists = 0, yellowCards = 0, redCards = 0 }: { goals?: number; assists?: number; yellowCards?: number; redCards?: number }) {
  const stats = [
    { kind: "goal", n: goals, label: goals === 1 ? "gol" : "goles", icon: <Icon name="ball" size={13} /> },
    { kind: "assist", n: assists, label: assists === 1 ? "asistencia" : "asistencias", icon: <Icon name="boot" size={13} /> },
    { kind: "yellow", n: yellowCards, label: yellowCards === 1 ? "amarilla" : "amarillas", icon: <i className="mb-card" /> },
    { kind: "red", n: redCards, label: redCards === 1 ? "roja" : "rojas", icon: <i className="mb-card" /> },
  ].filter((s) => s.n > 0);
  if (!stats.length) return null;
  return <span className="match-badges">{stats.map((s) => <span key={s.kind} className={`mb-stat ${s.kind}`} role="img" aria-label={`${s.n} ${s.label}`} title={`${s.n} ${s.label}`}><span aria-hidden="true">{s.icon}{s.n > 1 && <b>×{s.n}</b>}</span></span>)}</span>;
}
