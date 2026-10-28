// ACTA · the narrated analysis (/admin/partidos/<id>/acta/narracion), out of the acta into its own screen (B-ACTA-03;
// board part-partido-acta.html § narración). The frame's «‹» goes back to the acta. TEMPORARY: today's acta, where
// the analysis still lives.
import { MatchEditorStation } from "../interim/MatchEditorStation";

export function NarracionScreen() {
  return <MatchEditorStation tab="acta" />;
}
