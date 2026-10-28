// /admin/partidos/<id> without a station: the station of its moment (antes → Convocatoria, en juego → La mesa, final
// or «¿Se jugó?» → Acta, publicado → Después, aplazado o cancelado → Datos), drawn in place (the address stays).
import { ConvocatoriaScreen } from "../areas/hoy-partidos/Convocatoria";
import { DatosScreen } from "../areas/hoy-partidos/Datos";
import { EnJuegoScreen } from "../areas/hoy-partidos/EnJuego";
import { ActaScreen } from "../areas/acta/Acta";
import { PublicarScreen } from "../areas/acta/Publicar";
import { DespuesScreen } from "../areas/acta/Despues";
import { usePartido } from "./partidoContext";

export function StationAuto() {
  const { auto } = usePartido();
  switch (auto) {
    case "datos":
      return <DatosScreen />;
    case "en-juego":
      return <EnJuegoScreen />;
    case "acta":
      return <ActaScreen />;
    case "publicar":
      return <PublicarScreen />;
    case "despues":
      return <DespuesScreen />;
    default:
      return <ConvocatoriaScreen />;
  }
}
