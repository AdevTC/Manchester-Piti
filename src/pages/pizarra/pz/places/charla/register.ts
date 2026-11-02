// r14 «La pizarra» · Charla: what the place tells the shell (MARCO.txt § registerPlace). Owned by the CHARLA agent.
// Loaded eagerly by places/index.ts (keep it light: the component itself is lazy).
import { lazy } from "react";
import { registerPlace } from "../../store/registry";

registerPlace("charla", {
  Component: lazy(() => import("./Charla").then((m) => ({ default: m.Charla }))),
  sub: (P) => {
    const v = P.sel.ver(P.sel.board(), "titular");
    return v ? P.sel.status(v).n + " de 7" : "";
  },
  share: "compartir",
});
