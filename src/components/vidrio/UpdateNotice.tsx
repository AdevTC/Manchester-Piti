import { useState, useSyncExternalStore } from "react";
import { appUpdate } from "../../lib/appUpdate";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/update.css";

// «Hay una versión nueva · Actualizar»: the page in front is the previous deploy (lib/appUpdate) and it
// could not switch by itself yet (someone is filling a form, scoring in la mesa, or using the page). The
// next navigation switches anyway; «Actualizar» does it now. In the entry chunk on purpose: a stale page
// can no longer load new chunks. The polite live region is always there, so the line is announced.
export function UpdateNotice() {
  const stale = useSyncExternalStore(appUpdate.subscribe, appUpdate.get, () => false);
  const [closed, setClosed] = useState(false);
  const shown = stale && !closed;
  return (
    <div className="vd-update-rail" role="status">
      {shown && (
        <div className="vd-update vd-glass vd-glass--deep">
          <p className="vd-update__text">Hay una versión nueva</p>
          <button type="button" className="vd-update__go vd-glass vd-press" onClick={() => appUpdate.apply()}>
            Actualizar
          </button>
          <button type="button" className="vd-update__close" aria-label="Ahora no" onClick={() => setClosed(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
