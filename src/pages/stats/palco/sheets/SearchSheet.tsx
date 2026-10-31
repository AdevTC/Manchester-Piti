// «El palco» · the «Busca o pregunta» sheet. STUB from the foundation commit: the Rivales session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function SearchSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-find" title="Busca o pregunta" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
