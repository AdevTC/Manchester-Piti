// «El palco» · the «¿Y si…?» sheet. STUB from the foundation commit: the Temporada session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function YsiSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-ysi" title="¿Y si…?" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
