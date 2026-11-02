// r14 «La pizarra» · the «Publicar el siete» sheet (?hoja=publicar). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("publicar", {
  title: "Publicar el siete",
  kicker: "Lo verá todo el equipo",
  Component: lazy(() => import("./Publicar").then((m) => ({ default: m.PublicarSheet }))),
});
