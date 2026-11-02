// r14 «La pizarra» · the «La ficha» sheet (?hoja=ficha). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("ficha", {
  title: "",
  Component: lazy(() => import("./Ficha").then((m) => ({ default: m.FichaSheet }))),
});
