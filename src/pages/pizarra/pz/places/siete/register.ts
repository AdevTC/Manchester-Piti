// r14 «La pizarra» · Siete: what the place tells the shell (MARCO.txt § registerPlace). Owned by the SIETE agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("siete", {
  sub: (P) => {
    const b = P.sel.board();
    const st = P.sel.status();
    return !b ? "Sin empezar" : st.full ? (b.isOfficial ? "Oficial" : "Listo") : st.n + " de 7";
  },
  Component: lazy(() => import("./Siete").then((m) => ({ default: m.Siete }))),
});
