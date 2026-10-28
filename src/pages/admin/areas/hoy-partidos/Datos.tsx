// HOY Y PARTIDOS · the match's Datos (/admin/partidos/<id>/datos): rival (nombre, iniciales, código, escudo), fecha y
// hora, campo (de «Los campos» del club, M-24), condición, equipación, competición, temporada, estado (aplazado con
// motivo y nueva fecha, cancelado), duración, vídeo, nota interna, anotadores, el tiempo (board part-partidos.html
// § 6). TEMPORARY: today's workspace on «Encuentro».
import { MatchEditorStation } from "../interim/MatchEditorStation";

export function DatosScreen() {
  return <MatchEditorStation tab="encuentro" />;
}
