// r14 «La pizarra» · the «Candidatos» sheet (?hoja=candidatos). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("candidatos", {
  title: "Candidatos",
  Component: lazy(() => import("./Candidatos").then((m) => ({ default: m.CandidatosSheet }))),
});
