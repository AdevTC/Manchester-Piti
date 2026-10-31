// «El palco» · the «La ficha» sheet. STUB from the foundation commit: the El juego session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function FichaSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-ficha" title="La ficha" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
