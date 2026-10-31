// «El palco»: the words on «Qué números ver» when the page is cut — «Repaso · J8», «Hasta la J8», «En casa», a match,
// a player, «Todas las temporadas» (the filters add up: «Hasta la J8 · En casa»). Empty: the season as it is today.
import type { NuState, NuView } from "../numeros/view";

export function filterLabel(v: Pick<NuView, "upto" | "edge" | "scope">, st: Pick<NuState, "temporada" | "replay" | "campo" | "partidos" | "jug">): string {
  const bits: string[] = [];
  if (st.temporada === "todas") bits.push("Todas las temporadas");
  else if (v.upto < v.edge) bits.push(st.replay ? `Repaso · J${v.upto}` : `Hasta la J${v.upto}`);
  if (st.campo === "casa") bits.push("En casa");
  else if (st.campo === "fuera") bits.push("Fuera");
  if (st.partidos.length === 1) bits.push(v.scope.matches.find((m) => m.key === st.partidos[0])?.t ?? "Un partido");
  else if (st.partidos.length > 1) bits.push(`${st.partidos.length} partidos`);
  if (st.jug.length === 1) bits.push(v.scope.people.find((p) => p.key === st.jug[0])?.t ?? "Un jugador");
  else if (st.jug.length > 1) bits.push(`${st.jug.length} jugadores`);
  return bits.join(" · ");
}
