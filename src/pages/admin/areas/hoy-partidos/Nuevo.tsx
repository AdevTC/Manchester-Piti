// HOY Y PARTIDOS · Nuevo partido (/admin/partidos/nuevo): rival, fecha y hora; el resto, cuando lo sepas (board
// part-partidos.html § 2). TEMPORARY: today's «Nuevo partido» dialog over the season's list.
import { Partidos } from "../../views/Partidos";
import { Interim } from "../../shell/Interim";

export function NuevoScreen() {
  return (
    <Interim search={{ nuevo: true }} head={{ title: "Nuevo partido", sub: "Rival, fecha y hora; el resto, cuando lo sepas", back: { to: "/admin/partidos", label: "Volver a Partidos" } }}>
      <Partidos />
    </Interim>
  );
}
