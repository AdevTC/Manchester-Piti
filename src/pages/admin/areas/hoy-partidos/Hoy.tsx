// HOY Y PARTIDOS · Hoy (/admin): la semana, Te toca, el partido que importa ahora con su carril (MiniCarril or the
// carril itself, partido/Carril) y lo que pide su estación (board SC-Admin › Hoy, hoy.js / part-hoy.html).
// TEMPORARY: today's Hoy inside the new frame until wave 2 draws it.
import { Hoy } from "../../views/Hoy";
import { Interim } from "../../shell/Interim";

export function HoyScreen() {
  return (
    <Interim>
      <Hoy />
    </Interim>
  );
}
