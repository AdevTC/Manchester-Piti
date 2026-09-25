import type { CSSProperties } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { compareMetric, duelVerdict, PROFILE_METRICS, SEASON_METRICS, type SquadRow } from "../../lib/squad";

interface Props {
  rows: SquadRow[];
  a: SquadRow;
  b: SquadRow;
  withStats: boolean;
  onPick: (side: "a" | "b", id: string) => void;
  onSwap: () => void;
}

/** Duel names shrink with their longest word instead of breaking it (narrow phones, two columns). */
function duelFit(name: string): CSSProperties {
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => [...w].length));
  return { "--k": Math.min(1, 6 / longest), "--k2": Math.min(1, 9 / longest) } as CSSProperties;
}
const valueClass = (base: string, v: string, wins: boolean) => `${base}${v === "—" ? " nd" : wins ? " win" : ""}`;
/** A bar is lit unless the other player wins that figure (age, weight and ties light both). */
const barClass = (base: string, v: string, otherWins: boolean) => `${base}${v === "—" ? " nd" : otherWins ? "" : " win"}`;

function Rail({ side, label, rows, chosen, other, onPick }: { side: "a" | "b"; label: string; rows: SquadRow[]; chosen: SquadRow; other: SquadRow; onPick: Props["onPick"] }) {
  return (
    <div className={`sq-cxrail ${side}`}>
      <span className="k">
        <span>{label}</span>
        <b>{chosen.name}</b>
      </span>
      <div className="chips" role="group" aria-label={label}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            className={r.id === chosen.id ? "on" : r.id === other.id ? "dis" : undefined}
            aria-pressed={r.id === chosen.id}
            aria-label={`${r.name}, dorsal ${r.num}`}
            onClick={() => onPick(side, r.id)}
          >
            {r.num}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Two players side by side: their shirts on the rail and mirrored bars for each figure. */
export function CaraACara({ rows, a, b, withStats, onPick, onSwap }: Props) {
  const metrics = [...PROFILE_METRICS, ...(withStats ? SEASON_METRICS : [])].map(([key, label]) => compareMetric(key, label, a, b, rows));
  return (
    <div className="sq-cx">
      <div className="sq-cxpick">
        <Rail side="a" label="Jugador 1" rows={rows} chosen={a} other={b} onPick={onPick} />
        <Rail side="b" label="Jugador 2" rows={rows} chosen={b} other={a} onPick={onPick} />
      </div>
      <div className="sq-duel">
        {[a, b].map((p, i) => (
          <div key={i} className={`side ${i ? "r" : "l"}`}>
            <div className="shirt">
              <ShirtBack name={p.name} num={p.num} hanger />
            </div>
            <span className="tag">{p.num}</span>
            <b style={duelFit(p.name)}>{p.name}</b>
            {p.full && <small>{p.full}</small>}
          </div>
        ))}
        <button type="button" className="vs" onClick={onSwap} aria-label="Intercambiar jugadores">
          VS
        </button>
      </div>
      <ul className="sq-metrics">
        {metrics.map((m) => (
          <li key={m.key} className="m" aria-label={`${m.label}: ${a.name} ${m.left}, ${b.name} ${m.right}`}>
            <span aria-hidden="true" className={valueClass("v", m.left, m.leftWins)}>{m.left}</span>
            <span aria-hidden="true" className={barClass("bar l", m.left, m.rightWins)}>
              <i style={{ "--w": `${m.leftPct}%` } as CSSProperties} />
            </span>
            <span aria-hidden="true" className="lab">
              {m.label}
            </span>
            <span aria-hidden="true" className={barClass("bar r", m.right, m.leftWins)}>
              <i style={{ "--w": `${m.rightPct}%` } as CSSProperties} />
            </span>
            <span aria-hidden="true" className={valueClass("v r", m.right, m.rightWins)}>{m.right}</span>
          </li>
        ))}
      </ul>
      <p className="sq-verdict" aria-live="polite">
        {duelVerdict(a, b, withStats)}
      </p>
      {!withStats && <p className="sq-note">Partidos, goles, asistencias y minutos se suman solos a la comparación con cada acta, desde la jornada 1.</p>}
    </div>
  );
}
