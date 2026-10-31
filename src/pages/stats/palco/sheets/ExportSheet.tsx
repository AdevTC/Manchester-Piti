// «El palco» · «Exportar la selección» (the prototype's sheet, Numeros.dc.html 1225–1235): JSON or CSV with the same
// filters, a preview of what goes in the file, and the real download.
import { useState } from "react";
import { exportar } from "../juegoView";
import { Ic, Seg, SheetFrame } from "../kit";
import { filterLabel } from "../scope";
import type { SheetProps } from "../types";

export function ExportSheet({ v, st, act, onClose, sheetRef }: SheetProps) {
  const ex = exportar(v, st, act, filterLabel(v, st));
  // «Descargado: …» belongs to the format it was downloaded in
  const [done, setDone] = useState<string | null>(null);
  return (
    <SheetFrame id="nx-s-exp" title="Exportar la selección" onClose={onClose} sheetRef={sheetRef}>
      <p className="nx-sheet__p">{ex.lead}</p>
      <Seg label="Formato" opts={ex.fmts} style={{ maxWidth: 320 }} />
      <pre className="nx-code" tabIndex={0} aria-label="Vista previa">
        {ex.preview}
      </pre>
      <div className="nx-sheet__btns">
        <button
          type="button"
          className="vd-glass vd-press nx-btn nx-btn--pri"
          onClick={() => {
            ex.go();
            setDone(ex.fmt);
          }}
        >
          <Ic name="download" />
          {ex.goT}
        </button>
        {done === ex.fmt && (
          <span className="nx-done" role="status">
            <Ic name="check" />
            {ex.doneT}
          </span>
        )}
      </div>
    </SheetFrame>
  );
}
