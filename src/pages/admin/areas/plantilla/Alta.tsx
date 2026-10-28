// PLANTILLA · el alta (/admin/plantilla/alta[?dorsal=N]): «La camiseta se estampa mientras escribes» (board
// part-plantilla.html § alta). TEMPORARY: today's «Alta de jugador».
import { useSearch } from "@tanstack/react-router";
import { Plantilla } from "../../views/Plantilla";
import { Interim } from "../../shell/Interim";

export function AltaScreen() {
  const dorsal = useSearch({ strict: false, select: (s) => (s as { dorsal?: unknown }).dorsal });
  return (
    <Interim search={{ nuevo: true, ...(dorsal !== undefined ? { dorsal } : {}) }} head={{ title: "Camiseta nueva", sub: "Alta de jugador", back: { to: "/admin/plantilla", label: "Volver a la plantilla" } }}>
      <Plantilla />
    </Interim>
  );
}
