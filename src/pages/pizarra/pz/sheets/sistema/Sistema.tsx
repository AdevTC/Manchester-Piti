// r14 «La pizarra» · the «El sistema» sheet. Placeholder of the base: the SIETE agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function SistemaSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="sistema" data-args={JSON.stringify(args)}>
      <b>El sistema</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
