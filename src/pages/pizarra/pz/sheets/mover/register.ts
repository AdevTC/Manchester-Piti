// r14 «La pizarra» · the «Mover a…» sheet (?hoja=mover). Owned by the SIETE agent.
import { lazy } from "react";
import { registerSheet } from "../../store/registry";

registerSheet("mover", {
  title: "Mover a…",
  Component: lazy(() => import("./Mover").then((m) => ({ default: m.MoverSheet }))),
});
