// r14 «La pizarra» · Siete: the store the Siete's sheet titles read («¿Quién al MC?», «Mover a ERIK»). A sheet's
// title is a function of its args only (registry.ts), so the place keeps a reference to the page's store: bound
// when the shell asks the place for its sublabel or primary action (both get the store itself, on every render of
// the places bar, long before a sheet opens) and by the sheets themselves.
import type { PzApi } from "../../store/api";

let ref: PzApi | null = null;
export const sieteApi = (): PzApi | null => ref;
export function bindSieteApi(P: PzApi): void {
  ref = P;
}
