// r14 «La pizarra» · the «Ajustes de la pizarra» sheet (?hoja=ajustes). Owned by the PACHANGA agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("ajustes", {
  title: "Ajustes de la pizarra",
  kicker: "Solo para ti",
  Component: lazy(() => import("./Ajustes").then((m) => ({ default: m.AjustesSheet }))),
});
