// r14 «La pizarra» · Siete: the store the Siete's sheet titles read («¿Quién al MC?», «Mover a ERIK»). A sheet's
// title is a function of its args only (registry.ts), so the place keeps a reference to the page's store: bound
// when the shell asks the place for its sublabel or primary action (both get the store itself), and by the Siete's
// regions and sheets when they mount (a sheet opened by its address on the phone, before anything else asked).
import { useEffect, useRef } from "react";
import type { PzApi } from "../../store/api";

let ref: PzApi | null = null;
export const sieteApi = (): PzApi | null => ref;
export function bindSieteApi(P: PzApi): void {
  ref = P;
}
/** A region binds it as it mounts. */
export function useSieteApi(P: PzApi): void {
  useEffect(() => {
    ref = P;
  }, [P]);
}
/** A sheet whose title reads the store binds it and redraws once on mount: its frame was drawn before the lazy
 *  sheet (and maybe before anything bound the store), so the title shows «¿Quién al MC?» and not «Candidatos». */
export function useSieteSheet(P: PzApi): void {
  const done = useRef(false);
  useEffect(() => {
    ref = P;
    if (done.current) return;
    done.current = true;
    if (P.state.sheet) P.act.setSheetHeight(P.state.sheetH);
  }, [P]);
}
