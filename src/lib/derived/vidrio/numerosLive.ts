// «Vidrio» · Números in the live (V-Vivo phone «Números», V-Integracion «Números con 14 equipos»): the season's
// line («Se mueven con cada gol: lo de borde discontinuo es «si acaba así» hasta que haya acta») and our form as
// letters, tonight's provisional one dashed until the acta, the jornadas still to come empty. Pure, on the
// season's strip (seasonStrip).
import type { StripSegment } from "./strip";

export interface FormLetter {
  /** «G», «E», «P», «A» (aplazado), «·» (acta pendiente) or the jornada still to come («J2»). */
  l: string;
  tone: "g" | "e" | "p" | "prov" | "empty";
  /** What a screen reader hears: «J1: ganando, si acaba así». */
  label: string;
}

/** Our last `max` jornadas up to tonight (oldest first); early in the season the first `max`, the ones still to
 *  play shown empty. */
export function formLetters(segments: readonly Pick<StripSegment, "jornada" | "state" | "letter" | "score">[], max = 5): FormLetter[] {
  const counted = segments.filter((s) => s.state !== "suspendido");
  const tonight = counted.findIndex((s) => s.state === "directo" || s.state === "hoy");
  const lastPlayed = counted.map((s) => s.state).lastIndexOf("jugado");
  const end = Math.max(tonight >= 0 ? tonight + 1 : lastPlayed + 1, Math.min(max, counted.length));
  return counted.slice(Math.max(0, end - max), end).map((s): FormLetter => {
    const j = s.jornada ? `J${s.jornada}` : "Jornada";
    if (s.state === "jugado" && s.letter && s.letter !== "A") return { l: s.letter, tone: s.letter === "G" ? "g" : s.letter === "P" ? "p" : "e", label: `${j}: ${s.letter === "G" ? "ganado" : s.letter === "P" ? "perdido" : "empate"}` };
    if ((s.state === "directo" || s.state === "pendiente") && s.score) {
      const l = s.score.gf > s.score.ga ? "G" : s.score.gf < s.score.ga ? "P" : "E";
      return { l, tone: "prov", label: `${j}: ${l === "G" ? "ganando" : l === "P" ? "perdiendo" : "empatando"}, si acaba así` };
    }
    if (s.state === "aplazado") return { l: "A", tone: "empty", label: `${j}: aplazado` };
    if (s.state === "pendiente") return { l: "·", tone: "empty", label: `${j}: pendiente del acta` };
    return { l: s.jornada ? `J${s.jornada}` : "·", tone: "empty", label: `${j}: ${s.state === "hoy" ? "hoy" : "por jugar"}` };
  });
}

/** The page's line under «Números». `provisional`: a match is being played, or played without its acta yet. */
export function numerosLede(seasonName: string, played: number, provisional: boolean): string {
  if (provisional) return `${seasonName}. Se mueven con cada gol: lo de borde discontinuo es «si acaba así» hasta que haya acta.`;
  if (!played) return `${seasonName}. Aún no se ha jugado ninguna jornada: todos a cero.`;
  return `${seasonName}, después de ${played === 1 ? "la primera jornada" : `${played} jornadas`}. Oficial desde el acta.`;
}
