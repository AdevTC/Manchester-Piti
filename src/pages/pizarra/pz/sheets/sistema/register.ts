// r14 «La pizarra» · the «El sistema» sheet (?hoja=sistema). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("sistema", {
  title: "El sistema",
  Component: lazy(() => import("./Sistema").then((m) => ({ default: m.SistemaSheet }))),
});
