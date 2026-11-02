// r14 «La pizarra» · the «Ajustes de la pizarra» sheet. Placeholder of the base: the PACHANGA agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function AjustesSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="ajustes" data-args={JSON.stringify(args)}>
      <b>Ajustes de la pizarra</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
