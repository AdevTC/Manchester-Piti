// V / E / D (pure).
export type ResultLetter = "V" | "E" | "D";
const WORD: Record<ResultLetter, string> = { V: "Victoria", E: "Empate", D: "Derrota" };

/** V / E / D from our goals and theirs. */
export function resultLetter(gf: number, ga: number): ResultLetter {
  return gf > ga ? "V" : gf === ga ? "E" : "D";
}
/** «Victoria» / «Empate» / «Derrota». */
export const resultWord = (r: ResultLetter) => WORD[r];
