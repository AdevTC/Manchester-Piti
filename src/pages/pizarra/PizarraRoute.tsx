// /pizarra/*: la pizarra r14 («El campo es el escenario»), one page across its places (pz/PizarraR14). The old
// addresses (/pizarra, its #panels, ?desde=mesa, /pizarra/dibujar) redirect before it loads (lib/legacyUrls).
import { PizarraR14 } from "./pz/PizarraR14";

export function PizarraRoute() {
  return <PizarraR14 />;
}
