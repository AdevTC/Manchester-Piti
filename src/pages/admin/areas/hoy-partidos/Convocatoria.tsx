// HOY Y PARTIDOS · the match's Convocatoria (/admin/partidos/<id>/convocatoria): quién viene (camisetas impresas por
// respuesta, ausentes con su fecha), el siete en el campo, el banquillo, invitados, turnos, recordatorios, «La
// pizarra coincide» and the primary «Mandar la convocatoria» (useStationPrimary) (board part-partidos.html § 5).
// Read the match with usePartido(). TEMPORARY: today's Convocar for this match.
import { Convocar } from "../../views/Convocar";
import { Interim } from "../../shell/Interim";
import { usePartido } from "../../partido/partidoContext";

export function ConvocatoriaScreen() {
  const { match } = usePartido();
  return (
    <Interim search={{ j: match.id }}>
      <Convocar />
    </Interim>
  );
}
