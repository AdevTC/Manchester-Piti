// r14 «La pizarra» · the «Mover a…» sheet (?hoja=mover&jugador=<pid>): the alternative to dragging. Owned by the
// SIETE agent.
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";
import { sieteApi } from "../../places/siete/sieteApi";

registerSheet("mover", {
  title: (a) => {
    const P = sieteApi();
    const pid = typeof a.pid === "string" ? a.pid : typeof a.jugador === "string" ? a.jugador : "";
    return P && pid ? "Mover a " + P.sel.name(pid) : "Mover a…";
  },
  kicker: "Sin arrastrar",
  Component: lazyPart(() => import("./Mover").then((m) => m.MoverSheet)),
});
