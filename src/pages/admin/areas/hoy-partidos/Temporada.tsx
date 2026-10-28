// HOY Y PARTIDOS · Partidos, la temporada (/admin/partidos): the table of jornadas with the mini carril in every row
// (partido/Carril MiniCarril, partido/carril stationsOf), the filters, «Archivados», search (`/`) and «Nuevo partido»
// (`n`) (board part-partidos.html § 1). TEMPORARY: today's Partidos (list + workspace) until wave 2 draws it.
import { Partidos } from "../../views/Partidos";
import { Interim } from "../../shell/Interim";

export function TemporadaScreen() {
  return (
    <Interim>
      <Partidos />
    </Interim>
  );
}
