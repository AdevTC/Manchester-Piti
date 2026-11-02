// r14 «La pizarra» · the «Candidatos» sheet. Placeholder of the base: the SIETE agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function CandidatosSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="candidatos" data-args={JSON.stringify(args)}>
      <b>Candidatos</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
