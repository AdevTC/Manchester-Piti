// What every «Ha jugado de» view says around the history map (the ficha's «Posiciones» tab, the player's
// «Sus posiciones»): the lead sentence and the note when there is nothing yet.
import { POSITIONS } from "../../lib/positions";
import type { PosLine } from "../../lib/positionStats";
import { fmtMinutes } from "../../lib/derived/minutes";

const partidos = (n: number): string => `${n} ${n === 1 ? "partido" : "partidos"}`;

/** «Más minutos de **Pivote (MCD)**: 320′ en 6 partidos». */
export function MasMinutos({ top, className }: { top: PosLine; className?: string }) {
  return (
    <p className={className}>
      Más minutos de <b>{`${POSITIONS[top.code].name} (${top.code})`}</b>: {fmtMinutes(top.minutes)} en {partidos(top.matches)}
    </p>
  );
}

/** Where the minutes by position come from (shown when there are none yet). */
export function PlayedNote({ className }: { className?: string }) {
  return <p className={className}>Cada acta dice dónde jugó: la pizarra oficial del partido o, sin ella, su posición preferida.</p>;
}
