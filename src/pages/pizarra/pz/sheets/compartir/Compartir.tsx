// r14 «La pizarra» · the «Compartir» sheet. Placeholder of the base: the CHARLA agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function CompartirSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="compartir" data-args={JSON.stringify(args)}>
      <b>Compartir</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
