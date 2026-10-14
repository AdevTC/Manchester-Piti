// G / E / P (pure): the admin's door to the one result alphabet (lib/derived/result.ts).
import { resultTitle, type ResultLetter } from "../../../lib/derived/result";

export { resultLetter, type ResultLetter } from "../../../lib/derived/result";
/** «Victoria» / «Empate» / «Derrota». */
export const resultWord = (r: ResultLetter): string => resultTitle(r);
