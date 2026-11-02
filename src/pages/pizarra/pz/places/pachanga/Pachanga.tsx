// r14 «La pizarra» · Pachanga (Los equipos del entreno: quién vino, petos, equilibrio, mezclar (PACHANGA)). Placeholder of the base: the PACHANGA agent fills
// this file (regions: lead · side · peek · panel; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Pachanga({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="pachanga" data-pz-layout={layout}>
      <b>Pachanga</b>
      <span>Los equipos del entreno: quién vino, petos, equilibrio, mezclar (PACHANGA).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
