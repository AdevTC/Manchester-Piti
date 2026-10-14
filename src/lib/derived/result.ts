// The one result alphabet: G (ganado) · E (empate) · P (perdido), the same on every page — home,
// /partidos, the jugador, the stats, the perfil, the pizarra and the admin.
export type ResultLetter = "G" | "E" | "P";

/** G / E / P from our goals and theirs. */
export function resultLetter(gf: number, ga: number): ResultLetter {
  return gf > ga ? "G" : gf === ga ? "E" : "P";
}

/** The word each letter stands for (lower case: «victoria», «empate», «derrota»). */
export const RESULT_WORD: Record<ResultLetter, string> = { G: "victoria", E: "empate", P: "derrota" };

/** «Victoria» / «Empate» / «Derrota» (a title, an aria-label on its own). */
export const resultTitle = (r: ResultLetter): string => RESULT_WORD[r].charAt(0).toUpperCase() + RESULT_WORD[r].slice(1);

/** The legend under every row of letters. */
export const RESULT_LEGEND = "G victoria · E empate · P derrota";
