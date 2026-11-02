// r14 «La pizarra» · the «Publicar el siete» sheet. Placeholder of the base: the SIETE agent fills this file (the shell
// draws the frame: kicker, title, ×, Esc, focus trap; see MARCO.txt § Sheets).
import type { SheetProps } from "../../store/types";

export function PublicarSheet({ args }: SheetProps) {
  return (
    <div className="pz-ph" data-pz-sheet="publicar" data-args={JSON.stringify(args)}>
      <b>Publicar el siete</b>
      <span>Esta hoja llega con su parte.</span>
    </div>
  );
}
