// r14 «La pizarra» · the «Ajustes de la pizarra» sheet (?hoja=ajustes). Owned by the PACHANGA agent.
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";

registerSheet("ajustes", {
  title: "Ajustes de la pizarra",
  kicker: "Solo para ti",
  Component: lazyPart(() => import("./Ajustes").then((m) => m.AjustesSheet)),
});
