// The ficha's «Posiciones» tab (/plantilla): the history map — inside the tab on the phone, over the shirt's
// column on desktop so the tab fits unscrolled — and the words: his most-played position and the top five.
import { MapaPosiciones } from "../../components/posiciones/MapaPosiciones";
import { MasMinutos, PlayedNote } from "../../components/posiciones/haJugadoDe";
import { usePlayed } from "../../components/posiciones/usePlayed";
import { POSITIONS, type PositionSet } from "../../lib/positions";
import type { PlayerPositions } from "../../lib/positionStats";
import { fmtMinutes } from "../../lib/derived/minutes";

export function PosMap({ name, seasonName, positions, pos }: { name: string; seasonName: string; positions: PositionSet; pos: PlayerPositions }) {
  const played = usePlayed(pos);
  return <MapaPosiciones size="m" label={`Dónde ha jugado ${name} en ${seasonName}`} value={positions} played={played} estimated={pos.estimatedMatches > 0} />;
}

export function PosTable({ seasonName, pos }: { seasonName: string; pos: PlayerPositions }) {
  const top = pos.lines[0];
  if (!top) return <PlayedNote className="sq-pos-note" />;
  return (
    <>
      <MasMinutos top={top} className="sq-pos-lead" />
      <table className="sq-pos-table">
        <caption className="hm-sr">Minutos por posición en {seasonName}</caption>
        <thead>
          <tr>
            <th scope="col">Posición</th>
            <th scope="col">Min</th>
            <th scope="col">
              <abbr title="Partidos jugados">PJ</abbr>
            </th>
            <th scope="col">
              <abbr title="Goles">G</abbr>
            </th>
            <th scope="col">
              <abbr title="Asistencias">A</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {pos.lines.slice(0, 5).map((l) => (
            <tr key={l.code}>
              <th scope="row">
                {POSITIONS[l.code].name} <span>({l.code})</span>
              </th>
              <td>{fmtMinutes(l.minutes)}</td>
              <td>{l.matches}</td>
              <td>{l.goals}</td>
              <td>{l.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
