// r14 «La pizarra» · the «La ficha» sheet (?hoja=ficha&jugador=<pid>): La carta + his notas, where he has played,
// his química in this seven, his answer and the actions. Owned by the SIETE agent. (The store titles it with his
// name; the kicker says where he is.)
import { lazy } from "react";
import { registerSheet } from "../../store/registry";
import { sieteApi } from "../../places/siete/sieteApi";

registerSheet("ficha", {
  title: "",
  kicker: (a) => {
    const P = sieteApi();
    const pid = typeof a.pid === "string" ? a.pid : typeof a.jugador === "string" ? a.jugador : "";
    const s = P && pid ? P.sel.ver()?.slots.find((x) => x.playerId === pid) : null;
    return s ? "En el siete · " + s.code : "La ficha";
  },
  Component: lazy(() => import("./Ficha").then((m) => ({ default: m.FichaSheet }))),
});
