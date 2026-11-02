// r14 «La pizarra» · Siete (El siete: los huecos, el banquillo, el sistema, las versiones, publicar (SIETE)). Placeholder of the base: the SIETE agent fills
// this file (regions: lead · side · peek · panel; see MARCO.txt).
import { usePz } from "../../store/context";
import type { RegionProps } from "../../store/types";

export function Siete({ region, layout }: RegionProps) {
  const P = usePz();
  const h = P.sel.headline();
  const M = P.sel.match();
  if (region === "side") return null;
  return (
    <div className={layout === "desktop" ? "pz-region" : undefined}>
      <div className={layout === "desktop" ? "pz-region__scroll" : undefined}>
        <section className="pz-hero">
          <p className="pz-kick">{M ? (M.j ? "J" + M.j + " · " : "") + M.rival : P.state.W.season.name}</p>
          {region === "peek" ? <p className="pz-h1" style={{ fontSize: 24 }}>{h.t}</p> : <h1 className="pz-h1">{h.t}</h1>}
          {region !== "peek" && <p className="pz-line">{h.s}</p>}
        </section>
      </div>
    </div>
  );
}
