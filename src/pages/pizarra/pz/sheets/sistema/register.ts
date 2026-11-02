// r14 «La pizarra» · the «El sistema» sheet (?hoja=sistema). Owned by the SIETE agent.
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";

registerSheet("sistema", {
  title: "El sistema",
  kicker: "Los 15 de fútbol 7",
  Component: lazyPart(() => import("./Sistema").then((m) => m.SistemaSheet)),
});
