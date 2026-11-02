// r14 «La pizarra» · the «La ficha» sheet (?hoja=ficha&jugador=<pid>): La carta + his notas, where he has played,
// his química in this seven, his answer and the actions. Owned by the SIETE agent. (The store titles it with his
// name; where he plays in this seven is a chip under the card.)
import { lazyPart } from "../../store/lazyPart";
import { registerSheet } from "../../store/registry";

registerSheet("ficha", {
  title: "",
  kicker: "La ficha",
  Component: lazyPart(() => import("./Ficha").then((m) => m.FichaSheet)),
});
