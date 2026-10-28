// ACTA · the match's Acta (/admin/partidos/<id>/acta): los goles primero (nuestros y suyos, con goleador y pase),
// tarjetas, cambios (los tramos de cada jugador), penaltis y lo demás; a la derecha «¿Cuadra?» y «La cuenta»;
// «Descartar borrador»; «¿Se jugó?» for a match that never reached la mesa (board part-partido-acta.html, acta.js).
// Read the match with usePartido(); the primary action with useStationPrimary. TEMPORARY: today's acta.
import { MatchEditorStation } from "../interim/MatchEditorStation";

export function ActaScreen() {
  return <MatchEditorStation tab="acta" />;
}
