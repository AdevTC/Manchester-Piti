// /profile › Temporada › «Dónde has jugado» (vinculada only): the season's minutes by exact position on the
// night pitch (the shared map in history mode, with its one-line summary), an LED strip with the totals, and
// a nudge to «Tus posiciones» when what he plays most is not what his ficha says, and the way to the
// whole team's positions (/stats?view=positions, in the season).
import { Link } from "@tanstack/react-router";
import { MapaPosiciones } from "../../components/posiciones/MapaPosiciones";
import { PlayedNote } from "../../components/posiciones/haJugadoDe";
import { usePlayed } from "../../components/posiciones/usePlayed";
import type { PosCode, PositionSet } from "../../lib/positions";
import type { PlayerPositions } from "../../lib/positionStats";
import { Ic } from "./icons";
import { fmtMinutes } from "../../lib/derived/minutes";

const NONE: PositionSet = { main: null, also: [] };
const partidos = (n: number) => `${n} ${n === 1 ? "partido" : "partidos"}`;

export function DondeHasJugado({ played, positions, seasonId, seasonName, nudge, onGoPositions }: { played: PlayerPositions; positions: PositionSet | null; seasonId: string; seasonName: string; nudge: PosCode | null; onGoPositions: () => void }) {
  const record = usePlayed(played);
  const any = played.lines.length > 0;
  return (
    <div className="bk">
      <h3 className="bk-h">Dónde has jugado</h3>
      <p className="bk-d">Minutos por posición esta temporada.</p>
      {any && (
        <p className="dh-led">
          <span>
            <b>{fmtMinutes(played.minutes)}</b> con posición
          </span>
          <span>
            <b>{played.lines.length}</b> {played.lines.length === 1 ? "puesto" : "puestos"}
          </span>
          <span>{partidos(played.matches)}</span>
        </p>
      )}
      <div className="ps-pitch">
        <MapaPosiciones size="m" label={`Dónde has jugado en la ${seasonName}`} value={positions ?? NONE} played={record} estimated={played.estimatedMatches > 0} />
      </div>
      {!any && <PlayedNote className="dh-note" />}
      {nudge && (
        <button type="button" className="lk dh-nudge" onClick={onGoPositions}>
          <span className="lk-ic">
            <Ic n="target" w={20} />
          </span>
          <span className="lk-t">
            <b>Has jugado más de {nudge} que de lo que tienes puesto.</b>{" "}
            <small>¿Lo añades en Tus posiciones?</small>
          </span>
          <Ic n="right" />
        </button>
      )}
      <Link className="btn sm bk-go" to="/estadisticas/campo/puestos" search={{ ...(seasonId && seasonId !== "all" ? { temporada: seasonId } : {}) }}>
        Ver las posiciones del equipo
        <Ic n="right" />
      </Link>
    </div>
  );
}
