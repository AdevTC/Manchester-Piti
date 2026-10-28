// PLANTILLA · the F7 map of 13 places (board part-plantilla.html § Posiciones): «★ preferida» and «● también» (up
// to 6), one tap each. `mode` says what a tap marks in the ficha (★ Preferida · ● También); the alta's map cycles
// (first tap the preferida, the next ones «también», a marked one taps off). Read-only without `onTap`.
import { POSITIONS, type PosCode, type PositionSet } from "../../../../lib/positions";
import { SPOTS, type MapMode } from "./mapModel";

const hint = (mode: MapMode, isMain: boolean, isAlso: boolean) =>
  mode === "main" ? (isMain ? "quitarla de preferida" : "hacerla preferida") : mode === "also" ? (isAlso ? "quitarla de «también»" : "añadirla a «también»") : "cambiar";

export function Mapa({ value, mode, label, onTap, was, alta }: { value: PositionSet; mode: MapMode; label: string; onTap?: (c: PosCode) => void; was?: PositionSet; alta?: boolean }) {
  return (
    <div className={`spl-map${alta ? " spl-map--alta" : ""}`} role="group" aria-label={label}>
      <span className="spl-map__half" aria-hidden="true" />
      <span className="spl-map__box" aria-hidden="true" />
      {SPOTS.map((s) => {
        const isMain = value.main === s.c;
        const isAlso = value.also.includes(s.c);
        const wasOn = !!was && (was.main === s.c || was.also.includes(s.c));
        const state = isMain ? ": preferida" : isAlso ? ": también" : "";
        return (
          <button
            key={s.c}
            type="button"
            className={`spl-pos${isMain ? " is-main" : isAlso ? " is-also" : ""}${wasOn && !isMain && !isAlso ? " is-was" : ""}`}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            aria-pressed={isMain || isAlso}
            aria-label={`${s.c}, ${POSITIONS[s.c].name.toLocaleLowerCase("es")}${state}${onTap ? ` · toca para ${hint(mode, isMain, isAlso)}` : ""}`}
            onClick={() => onTap?.(s.c)}
          >
            {s.c}
          </button>
        );
      })}
    </div>
  );
}
