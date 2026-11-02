// r14 «La pizarra» · Partido: what the place tells the shell (MARCO.txt § registerPlace) — its live sublabel («Hoy
// 18:00», «En juego 23′», «Jugado 3–2»), the badge while live («23′ · 2–1», en juego), the one primary action of each
// phase (Mandar a la mesa · Hacer el cambio · Aplicar la 2ª parte · Ver el partido) and its two sheets.
// Loaded eagerly by places/index.ts (keep it light: the components are lazy; actions.ts is pure logic).
import { lazy } from "react";
import { registerPlace, registerSheet } from "../../store/registry";
import { badgeOf, primaryOf, subOf } from "./actions";

registerPlace("partido", {
  Component: lazy(() => import("./Partido").then((m) => ({ default: m.Partido }))),
  sub: subOf,
  primary: primaryOf,
  badge: badgeOf,
  share: "compartir",
});
registerSheet("pt-mesa", {
  title: "Mandar a la mesa",
  kicker: "El siete del partido",
  Component: lazy(() => import("./Sheets").then((m) => ({ default: m.MesaSheet }))),
});
registerSheet("pt-otro", {
  title: "Otro cambio",
  kicker: "Se apunta en el acta",
  Component: lazy(() => import("./Sheets").then((m) => ({ default: m.OtroSheet }))),
});
