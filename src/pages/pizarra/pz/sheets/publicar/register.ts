// r14 «La pizarra» · the «Publicar el siete» sheet (?hoja=publicar). Owned by the SIETE agent.
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";

registerSheet("publicar", {
  title: "Publicar el siete",
  kicker: "Lo verá todo el equipo",
  Component: lazyPart(() => import("./Publicar").then((m) => m.PublicarSheet)),
});
