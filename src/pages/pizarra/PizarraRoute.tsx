// /pizarra: la pizarra «Noche de partido».
import { PizarraPage } from "./v2/PizarraPage";
// Loaded with the route: it remembers ?tablero= and #panel before the season sync's first navigation
// (which drops the hash).
import "./v2/deeplink";

export function PizarraRoute() {
  return <PizarraPage />;
}
