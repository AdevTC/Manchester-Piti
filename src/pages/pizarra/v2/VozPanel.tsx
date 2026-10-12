// Bloque 5 · la voz en off on La charla's screen: the step's voice (playing, or a tap to hear it when the
// browser held it back), «Silenciar la voz» for this device, and — on a board the user may edit — record
// (≤ 30 s, with its clock), stop, re-record and delete. What happens is said by the board's one announcer
// (useVozCharla), so nothing here is a live region.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { VOZ_LIMITS, vozDe, vozTime } from "./voz";
import type { VozCharlaApi } from "./useVozCharla";
import "../../../styles/pizarra-presenta.css";

export function VozPanel({ v }: { v: VozCharlaApi }) {
  const [ask, setAsk] = useState(false);
  const stopRef = useRef<HTMLButtonElement>(null);
  // the «Parar» button takes the focus while it records (the record button is gone)
  useEffect(() => {
    if (v.rec === "rec") stopRef.current?.focus({ preventScroll: true });
  }, [v.rec]);
  if (!v.shown) return null;
  const max = VOZ_LIMITS.ms / 1000;
  return (
    <div className="b5p-voz" role="group" aria-label={"Voz en off: " + v.stepTxt}>
      {v.clip ? (
        <span className={"b5p-voz-st" + (v.sounding ? " on" : "")}>
          <i className="b5p-eq" aria-hidden="true">
            <b />
            <b />
            <b />
          </i>
          <span>{(v.sounding ? "Suena la voz · " : "Voz · ") + vozTime(v.clip.ms)}</span>
        </span>
      ) : (
        <span className="b5p-voz-st">Sin voz en este paso</span>
      )}
      {v.clip && (v.blocked || !v.sounding) && v.rec === "idle" && (
        <button type="button" className="b3" onClick={v.play} disabled={v.muted}>
          <Icon n="play" w={15} />
          {v.blocked ? "Oír la voz" : "Volver a oír"}
        </button>
      )}
      {(v.clip || v.count > 0) && (
        <button type="button" className="b3" onClick={v.toggleMute} aria-pressed={v.muted}>
          <Icon n={v.muted ? "sndOff" : "sndOn"} w={15} />
          {v.muted ? "Voz silenciada" : "Silenciar la voz"}
        </button>
      )}
      {v.canRecord && v.rec === "idle" && !ask && (
        <>
          <button type="button" className="b3 b5p-rec" onClick={v.record} disabled={!v.clip && v.count >= VOZ_LIMITS.slots}>
            <i className="b5p-dot" aria-hidden="true" />
            {v.clip ? "Volver a grabar" : "Grabar la voz"}
          </button>
          {v.clip && (
            <button type="button" className="b3" onClick={() => setAsk(true)}>
              <Icon n="trash" w={15} />
              Borrar la voz
            </button>
          )}
        </>
      )}
      {ask && v.clip && (
        <span className="b5p-cfm" role="group" aria-label="¿Borrar la voz de este paso?">
          <span>¿Borrar la voz {vozDe(v.key)}?</span>
          <button
            type="button"
            className="b3 danger"
            onClick={() => {
              setAsk(false);
              v.remove();
            }}
          >
            Borrar
          </button>
          <button type="button" className="b3" onClick={() => setAsk(false)} autoFocus>
            Cancelar
          </button>
        </span>
      )}
      {v.rec === "asking" && <span className="b5p-voz-st">Pidiendo el micrófono…</span>}
      {v.rec === "rec" && (
        <>
          <span className="b5p-voz-st b5p-live">
            <i className="b5p-dot" aria-hidden="true" />
            <span>
              Grabando {vozTime(v.elapsed * 1000)} / {vozTime(max * 1000)}
            </span>
          </span>
          <button type="button" ref={stopRef} className="b3 gold" onClick={v.stop}>
            <Icon n="pause" w={15} />
            Parar y guardar
          </button>
        </>
      )}
      {v.rec === "saving" && <span className="b5p-voz-st">Guardando la voz…</span>}
      {v.canRecord && !v.clip && v.count >= VOZ_LIMITS.slots && <small className="b5p-note">Ya hay voz en {VOZ_LIMITS.slots} pasos: borra una para grabar otra.</small>}
      {v.why && <small className="b5p-note">{v.why}</small>}
      {v.error && <small className="b5p-err">{v.error}</small>}
    </div>
  );
}
