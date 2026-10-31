// «El palco» · the «Todas las estadísticas» sheet. STUB from the foundation commit: the Jugadores session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function StatsSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-stats" title="Todas las estadísticas" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
