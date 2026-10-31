// «El palco» · the «Exportar la selección» sheet. STUB from the foundation commit: the El juego session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function ExportSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-exp" title="Exportar la selección" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
