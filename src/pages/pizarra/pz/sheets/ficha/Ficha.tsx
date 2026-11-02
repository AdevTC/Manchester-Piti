// r14 «La pizarra» · the «La ficha» sheet. Placeholder of the base: the SIETE agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function FichaSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="ficha" data-args={JSON.stringify(args)}>
      <b>La ficha</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
