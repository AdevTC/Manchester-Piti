import { useState, type CSSProperties } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { Icon } from "../../components/celeste/icons";
import { compareMetric, duelVerdict, PROFILE_METRICS, SEASON_METRICS, type SquadRow } from "../../lib/squad";
import { PlayerPicker } from "./PlayerPicker";

interface Props {
  rows: SquadRow[];
  a: SquadRow;
  b: SquadRow;
  withStats: boolean;
  kit: "home" | "away";
  /** Photos for the duel (angled towards each other) and for the picker (straight back). */
  duelStill: (row: SquadRow, side: "a" | "b") => string | undefined;
  still: (row: SquadRow) => string | undefined;
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

/** Two players face to face: their real shirts, one tap on either corner to change who is there. */
export function CaraACara({ rows, a, b, withStats, kit, duelStill, still, onPick, onSwap }: Props) {
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const metrics = [...PROFILE_METRICS, ...(withStats ? SEASON_METRICS : [])].map(([key, label]) => compareMetric(key, label, a, b, rows));
  const corner = (side: "a" | "b", p: SquadRow) => {
    const src = duelStill(p, side);
    return (
      <button type="button" className={`sq-corner ${side}`} aria-haspopup="dialog" aria-label={`${side === "a" ? "Jugador 1" : "Jugador 2"}: ${p.name}. Cambiar jugador`} onClick={() => setPicking(side)}>
        <span className="spot" aria-hidden="true" />
        <span className="pic" key={p.id}>
          {src ? <img src={src} alt="" draggable={false} /> : <ShirtBack name={p.name} num={p.num} />}
        </span>
        <span className="who">
          <span className="tag">{p.num}</span>
          <b style={duelFit(p.name)}>{p.name}</b>
          {p.full && <small>{p.full}</small>}
        </span>
        <span className="change">
          <Icon name="swap" size={14} stroke={2.2} />
          Cambiar
        </span>
      </button>
    );
  };
  return (
    <div className="sq-cx">
      <div className="sq-ring">
        {corner("a", a)}
        <button type="button" className="vs" onClick={onSwap} aria-label="Intercambiar las esquinas">
          <span>VS</span>
          <Icon name="swap" size={14} stroke={2.4} />
        </button>
        {corner("b", b)}
        <div className="board">
          <ul className="sq-metrics">
            {metrics.map((m) => (
              <li key={m.key} className="m" aria-label={`${m.label}: ${a.name} ${m.left}, ${b.name} ${m.right}`}>
                <span aria-hidden="true" className={valueClass("v", m.left, m.leftWins)}>
                  {m.left}
                </span>
                <span aria-hidden="true" className={barClass("bar l", m.left, m.rightWins)}>
                  <i style={{ "--w": `${m.leftPct}%` } as CSSProperties} />
                </span>
                <span aria-hidden="true" className="lab">
                  {m.label}
                </span>
                <span aria-hidden="true" className={barClass("bar r", m.right, m.leftWins)}>
                  <i style={{ "--w": `${m.rightPct}%` } as CSSProperties} />
                </span>
                <span aria-hidden="true" className={valueClass("v r", m.right, m.rightWins)}>
                  {m.right}
                </span>
              </li>
            ))}
          </ul>
          <p className="sq-verdict" aria-live="polite">
            {duelVerdict(a, b, withStats)}
          </p>
          {!withStats && <p className="sq-note">Partidos, goles, asistencias y minutos se suman solos con cada acta, desde la jornada 1.</p>}
        </div>
      </div>
      {picking && (
        <PlayerPicker
          side={picking}
          rows={rows}
          chosenId={picking === "a" ? a.id : b.id}
          otherId={picking === "a" ? b.id : a.id}
          kit={kit}
          still={still}
          onPick={(id) => {
            onPick(picking, id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
