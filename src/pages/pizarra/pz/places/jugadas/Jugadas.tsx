// r14 «La pizarra» · Jugadas (La biblioteca, el editor por pasos y la repetición; Dibujar (JUGADAS)). Placeholder of the base: the JUGADAS agent fills
// this file (regions: lead · side · peek · panel; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Jugadas({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="jugadas" data-pz-layout={layout}>
      <b>Jugadas</b>
      <span>La biblioteca, el editor por pasos y la repetición; Dibujar (JUGADAS).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
