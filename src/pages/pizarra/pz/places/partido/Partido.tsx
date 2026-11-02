// r14 «La pizarra» · Partido (El día de partido en un sitio: antes, en juego, descanso y después (PARTIDO)). Placeholder of the base: the PARTIDO agent fills
// this file (regions: lead · side · peek · panel; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Partido({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="partido" data-pz-layout={layout}>
      <b>Partido</b>
      <span>El día de partido en un sitio: antes, en juego, descanso y después (PARTIDO).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
