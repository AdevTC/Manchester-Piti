// r14 «La pizarra» · Plan (Cómo jugamos este partido: el rival, las claves, con y sin balón, pelotas paradas, «Si pasa…», notas (PLAN)). Placeholder of the base: the PLAN agent fills
// this file (regions: lead · side · peek · panel; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Plan({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="plan" data-pz-layout={layout}>
      <b>Plan</b>
      <span>Cómo jugamos este partido: el rival, las claves, con y sin balón, pelotas paradas, «Si pasa…», notas (PLAN).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
