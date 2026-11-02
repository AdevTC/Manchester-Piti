// r14 «La pizarra» · the «Mover a…» sheet. Placeholder of the base: the SIETE agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function MoverSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="mover" data-args={JSON.stringify(args)}>
      <b>Mover a…</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
