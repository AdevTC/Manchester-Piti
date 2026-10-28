// PLANTILLA · Jugadores (/admin/plantilla): la plantilla en filas (camiseta impresa, dorsal, nombre, línea, estado, lo
// que falta, cuenta) con «Qué falta», the detail at the right on the desktop; the navigation «Jugadores · Socios ·
// Capitanes» (board part-plantilla.html § 1). Also /admin/plantilla/cromos (CromosScreen). TEMPORARY: today's
// Plantilla until wave 2 draws it.
import { Plantilla } from "../../views/Plantilla";
import { Interim } from "../../shell/Interim";

export function JugadoresScreen() {
  return (
    <Interim>
      <Plantilla />
    </Interim>
  );
}

/** /admin/plantilla/cromos: todos en cromos. */
export function CromosScreen() {
  return (
    <Interim search={{ vista: "cromos" }}>
      <Plantilla />
    </Interim>
  );
}
