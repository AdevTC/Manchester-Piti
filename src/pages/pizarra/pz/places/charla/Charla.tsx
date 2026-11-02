// r14 «La pizarra» · Charla (La charla a pantalla completa: Grada, los pasos, la voz y «¡Vamos, Piti!» (CHARLA)). Placeholder of the base: the CHARLA agent fills
// this file (regions: lead · side · peek · panel · full; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Charla({ region, layout }: RegionProps) {
  const P = usePz();
  if (region !== "lead" && region !== "peek" && region !== "full") return null;
  return (
    <div className="pz-ph" data-pz-place="charla" data-pz-layout={layout}>
      <b>Charla</b>
      <span>La charla a pantalla completa: Grada, los pasos, la voz y «¡Vamos, Piti!» (CHARLA).</span>
      {region === "full" && (
        <button type="button" className="vd-glass vd-press pz-btn pz-btn--pri" onClick={() => P.nav("/pizarra/siete")}>
          Volver al siete
        </button>
      )}
    </div>
  );
}
