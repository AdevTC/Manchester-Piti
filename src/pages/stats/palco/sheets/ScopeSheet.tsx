// «El palco» · the «Qué números ver» sheet. STUB from the foundation commit: the Rivales session ports it from the prototype.
import { SheetFrame } from "../kit";
import type { SheetProps } from "../types";

export function ScopeSheet({ onClose, sheetRef }: SheetProps) {
  return (
    <SheetFrame id="nx-s-scope" title="Qué números ver" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__k">Por hacer.</p>
    </SheetFrame>
  );
}
