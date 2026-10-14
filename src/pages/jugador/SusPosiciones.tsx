// «Sus posiciones» on the player's page: where he played in the selected period — the history map on a
// night pitch, and by exact position his minutes, matches, goals, assists and form (Valoración).
import { useMemo } from "react";
import type { ClubMatch } from "../../lib/clubData";
import { POSITIONS, type PositionSet } from "../../lib/positions";
import { playerPositions } from "../../lib/positionStats";
import { MapaPosiciones } from "../../components/posiciones/MapaPosiciones";
import { MasMinutos, PlayedNote } from "../../components/posiciones/haJugadoDe";
import { usePlayed } from "../../components/posiciones/usePlayed";
import { fmtMinutes } from "../../lib/derived/minutes";
import type { MvpOf } from "../../lib/derived/mvpOf";
import { NewBadge } from "../../components/NewBadge";

interface Props {
  playerId: string;
  name: string;
  positions: PositionSet;
  /** The matches of the selected period (one season or the whole history). */
  games: ClubMatch[];
  periodName: string;
  /** The MVP of a match (for the form rating); absent = MVPs don't count. */
  /** The shared MVP reader (derived/mvpOf), for the ratings by position (required). */
  mvpOf: MvpOf;
}

export function SusPosiciones({ playerId, name, positions, games, periodName, mvpOf }: Props) {
  const pos = useMemo(() => playerPositions(playerId, games, mvpOf), [playerId, games, mvpOf]);
  const played = usePlayed(pos);
  const top = pos.lines[0];
  return (
    <section className="st-card jg-wide jg-two" aria-labelledby="jg-pos">
      <div className="st-hd">
        <span className="hm-kick" style={{ margin: 0 }}>
          Ha jugado de <NewBadge feature="posicionesJugador" />
        </span>
        <h2 className="st-h2" id="jg-pos">
          Sus posiciones
        </h2>
        <p className="st-mono">{periodName} · minutos por posición exacta, según las actas</p>
      </div>
      <div className="jg-pos">
        <div className="jg-pos-pitch">
          <MapaPosiciones size="m" label={`Dónde ha jugado ${name} · ${periodName}`} value={positions} played={played} estimated={pos.estimatedMatches > 0} />
        </div>
        <div className="jg-pos-side">
          {top ? (
            <>
              <MasMinutos top={top} className="jg-pos-lead" />
              <div className="st-tablebox">
                <table className="st-table jg-pos-table" aria-label={`Sus posiciones · ${periodName}`}>
                  <thead>
                    <tr>
                      <th scope="col">Posición</th>
                      <th scope="col">Minutos</th>
                      <th scope="col">
                        <abbr title="Partidos jugados">PJ</abbr>
                      </th>
                      <th scope="col">
                        <abbr title="Goles">G</abbr>
                      </th>
                      <th scope="col">
                        <abbr title="Asistencias">A</abbr>
                      </th>
                      <th scope="col">Valoración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.lines.map((l) => (
                      <tr key={l.code}>
                        <th scope="row">
                          {POSITIONS[l.code].name} <span className="cd">({l.code})</span>
                        </th>
                        <td>{fmtMinutes(l.minutes)}</td>
                        <td>{l.matches}</td>
                        <td>{l.goals}</td>
                        <td>{l.assists}</td>
                        <td>{l.rating ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="st-mono">Valoración: su forma en los partidos que jugó sobre todo en ese puesto; aparece desde el segundo.</p>
            </>
          ) : (
            <PlayedNote className="st-empty" />
          )}
        </div>
      </div>
    </section>
  );
}
