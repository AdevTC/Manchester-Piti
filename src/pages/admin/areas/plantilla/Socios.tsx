// PLANTILLA · Socios (/admin/plantilla/socios[?ver=fichas|dentro|invitaciones]): la puerta dentro de la sala — llaman a
// la puerta, piden su ficha, dentro, invitaciones (M-12; board part-plantilla.html § socios). TEMPORARY: today's
// «Cuentas» (the ficha claims).
import { Fichas } from "../../views/Fichas";
import { Interim } from "../../shell/Interim";

export function SociosScreen() {
  return (
    <Interim>
      <Fichas />
    </Interim>
  );
}
