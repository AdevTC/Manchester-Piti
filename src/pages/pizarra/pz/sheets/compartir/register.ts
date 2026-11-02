// r14 «La pizarra» · the «Compartir» sheet (?hoja=compartir). Owned by the CHARLA agent.
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";

registerSheet("compartir", {
  title: "Compartir",
  kicker: (_args, P) => {
    const b = P.sel.board();
    return "El estudio" + (b ? " · " + b.name : "");
  },
  Component: lazyPart(() => import("./Compartir").then((m) => m.CompartirSheet)),
});
