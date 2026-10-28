// ACTA · the acta's history (/admin/partidos/<id>/acta/historial): every change (matchAudit), who and when (board
// part-partido-acta.html § historial). The frame's «‹» goes back to the acta. TEMPORARY: today's acta.
import { MatchEditorStation } from "../interim/MatchEditorStation";

export function HistorialScreen() {
  return <MatchEditorStation tab="acta" />;
}
