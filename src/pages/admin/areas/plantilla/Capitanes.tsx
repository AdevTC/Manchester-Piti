// PLANTILLA · Capitanes (/admin/plantilla/capitanes): el brazalete (permiso) y, aparte, el capitán en el campo de cada
// temporada (M-15; board part-plantilla.html § capitanes). TEMPORARY: today's Capitanes.
import { Capitanes } from "../../views/Capitanes";
import { Interim } from "../../shell/Interim";

export function CapitanesScreen() {
  return (
    <Interim>
      <Capitanes />
    </Interim>
  );
}
