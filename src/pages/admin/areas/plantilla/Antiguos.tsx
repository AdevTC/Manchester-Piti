// PLANTILLA · Antiguos (/admin/plantilla/antiguos): los jugadores de temporadas archivadas, visibles y recuperables
// (M-14; board part-plantilla.html § antiguos). TEMPORARY: a note until wave 2 draws it.
import { ComingScreen } from "../../shell/Screen";

export function AntiguosScreen() {
  return (
    <ComingScreen
      title="Antiguos"
      sub="Fichas de otras temporadas"
      back={{ to: "/admin/plantilla", label: "Volver a la plantilla" }}
      body="Aquí estarán los jugadores de las temporadas archivadas, para verlos y recuperarlos. Mientras tanto, una ficha vuelve a la temporada desde Temporadas."
      links={[{ to: "/admin/club/temporadas", label: "Temporadas" }]}
    />
  );
}
