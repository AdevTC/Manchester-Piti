// The carril (M-03) as React: `Carril` is the match's navigation — six glass stations joined by a line, each with its
// name and its state in words, the current one lit (aria-current="page", its dot travels between screens: law 4) —
// and `MiniCarril` the same six in small for Hoy's hero and the season's rows (six dots, the current one lit, the
// station that matters in words beside them; one accessible name, the dots are decoration).
import { VIcon } from "../../../components/vidrio/VIcon";
import { SalaLink } from "../shell/SalaLink";
import type { Station } from "../../../lib/adminUrls";
import { stationLabel, type StationView } from "./carril";

export function Carril({ stations, current, label = "Las estaciones del partido (flechas ← →)" }: { stations: StationView[]; current: Station; label?: string }) {
  return (
    <ol className="sc-carril" style={{ ["--n" as string]: stations.length }} aria-label={label}>
      {stations.map((s) => {
        const on = s.id === current;
        return (
          <li key={s.id}>
            <SalaLink to={s.path} className={`sc-station is-${s.state}`} aria-current={on ? "page" : undefined} aria-label={stationLabel(s)} aria-keyshortcuts="ArrowLeft ArrowRight">
              <span className="sc-station__dot vd-glass">
                <VIcon name={s.icon} size={19} className="sc-i" />
              </span>
              <b aria-hidden="true">{s.name}</b>
              <small aria-hidden="true">{s.word}</small>
            </SalaLink>
          </li>
        );
      })}
    </ol>
  );
}

/** The carril in small: `current` lit (the station that matters now), its words beside. `label` names it whole
 *  («J3 · Convocatoria: Sin mandar»). Pass `to` to make it a link (Hoy: to the station). */
export function MiniCarril({ stations, current, className = "" }: { stations: StationView[]; current: Station; className?: string }) {
  const cur = stations.find((s) => s.id === current) ?? stations[0];
  return (
    <span className={`sc-mini ${className}`.trim()}>
      <span className="sc-carril sc-carril--mini" style={{ ["--n" as string]: stations.length }} aria-hidden="true">
        {stations.map((s) => (
          <span key={s.id} className={`sc-station is-${s.state}${s.id === current ? " is-cur" : ""}`}>
            <span className="sc-station__dot vd-glass">
              <VIcon name={s.icon} size={11} className="sc-i" />
            </span>
          </span>
        ))}
      </span>
      <span className={`sc-mini__w${cur.state === "toca" ? " is-toca" : ""}`}>
        <b>{cur.name}</b> · {cur.word}
        {cur.state === "toca" && <span className="vd-vh"> · te toca</span>}
      </span>
    </span>
  );
}
