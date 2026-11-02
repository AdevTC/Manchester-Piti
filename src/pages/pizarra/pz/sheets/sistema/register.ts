// r14 «La pizarra» · the «El sistema» sheet (?hoja=sistema). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("sistema", {
  title: "El sistema",
  kicker: "Los 15 de fútbol 7",
  Component: lazy(() => import("./Sistema").then((m) => ({ default: m.SistemaSheet }))),
});
