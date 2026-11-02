// r14 «La pizarra» · Siete: the store the Siete's sheet titles read («¿Quién al MC?», «Mover a ERIK»). A sheet's
// title is a function of its args only (registry.ts), so the place keeps a reference to the page's store: bound
// when the shell asks the place for its sublabel or primary action (both get the store itself), and by the Siete's
// regions and sheets when they mount (a sheet opened by its address on the phone, before anything else asked).
import { useEffect } from "react";
import type { PzApi } from "../../store/api";

let ref: PzApi | null = null;
export const sieteApi = (): PzApi | null => ref;
export function bindSieteApi(P: PzApi): void {
  ref = P;
}
/** Bind on mount; if nothing had bound it yet, redraw once so the sheet's frame shows its real title. */
export function useSieteApi(P: PzApi): void {
  useEffect(() => {
    const had = !!ref;
    ref = P;
    if (!had && P.state.sheet) P.act.setSheetHeight(P.state.sheetH);
  }, [P]);
}
