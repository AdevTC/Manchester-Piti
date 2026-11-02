// r14 «La pizarra» · Tableros (Tus tableros, el oficial y los del equipo; Comparar y la historia (TABLEROS)). Placeholder of the base: the TABLEROS agent fills
// this file (regions: lead · side · peek · panel · stage; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Tableros({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="tableros" data-pz-layout={layout}>
      <b>Tableros</b>
      <span>Tus tableros, el oficial y los del equipo; Comparar y la historia (TABLEROS).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
