// «Corregir» a play from Lo que va pasando: a bottom sheet with what it was (among the compatible types),
// who (and the assist, or who came in) and the minute. Only what changed goes in the patch.
import { useEffect, useRef, useState } from "react";
import type { MesaEditPatch, MesaEvent, MesaPlayer, MesaType } from "../types";
import { compatibleTypes, isMesaType, takesAssist, takesIn, takesPlayer, TYPE_NAME } from "./model";

interface Props {
  event: MesaEvent;
  players: MesaPlayer[];
  /** The latest minute it can move to (the clock's). */
  maxMinute: number;
  onSave: (patch: MesaEditPatch) => void;
  onClose: () => void;
}

function Picks({ label, value, options, onPick }: { label: string; value: string; options: { id: string; name: string }[]; onPick: (id: string) => void }) {
  return (
    <div className="fsec" role="group" aria-label={label}>
      <h3>{label}</h3>
      <div className="picks">
        {options.map((o) => (
          <button key={o.id || "none"} type="button" className={value === o.id ? "pick on" : "pick"} aria-pressed={value === o.id} onClick={() => onPick(o.id)}>
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function EditSheet({ event, players, maxMinute, onSave, onClose }: Props) {
  const startType = isMesaType(event.type) ? event.type : null;
  const [type, setType] = useState<MesaType | null>(startType);
  const [playerId, setPlayerId] = useState(event.playerId ?? "");
  const [assistId, setAssistId] = useState(event.assistId ?? "");
  const [inId, setInId] = useState(event.inPlayerId ?? "");
  const startMinute = event.minute ?? 1;
  const [minute, setMinute] = useState(startMinute);
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    head.current?.focus();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const t = type ?? event.type;
  const family = startType ? compatibleTypes(startType) : [];
  const people = players.map((p) => ({ id: p.id, name: p.number ? `${p.number} ${p.name}` : p.name }));
  const top = Math.max(1, maxMinute);

  const save = () => {
    const patch: MesaEditPatch = {};
    if (type && type !== event.type) patch.type = type;
    if (takesPlayer(t) && playerId && playerId !== (event.playerId ?? "")) patch.playerId = playerId;
    if (takesAssist(t) && assistId !== (event.assistId ?? "")) patch.assistPlayerId = assistId;
    if (takesIn(t) && inId && inId !== (event.inPlayerId ?? "")) patch.inPlayerId = inId;
    if (minute !== startMinute) patch.elapsedSeconds = (minute - 1) * 60 + ((event.elapsedSeconds ?? 0) % 60);
    if (Object.keys(patch).length) onSave(patch);
    else onClose();
  };

  return (
    <>
      <button type="button" className="scrim" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet esheet" role="dialog" aria-modal="true" aria-labelledby="ms-edit-h">
        <div className="grab" />
        <div className="sh">
          <div>
            <div className="kk">Corregir, minuto {startMinute}</div>
            <h2 id="ms-edit-h" ref={head} tabIndex={-1}>{event.text}</h2>
          </div>
          <button type="button" className="back" aria-label="Cerrar" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {family.length > 1 && (
          <Picks label="Qué fue" value={t} options={family.map((x) => ({ id: x, name: TYPE_NAME[x] }))} onPick={(x) => {
            if (isMesaType(x)) setType(x);
          }} />
        )}
        {takesPlayer(t) && <Picks label={t === "position_swap" ? "Se cambia de sitio" : takesIn(t) ? "Sale" : "Quién"} value={playerId} options={people} onPick={setPlayerId} />}
        {takesIn(t) && <Picks label={t === "position_swap" ? "Con" : "Entra"} value={inId} options={people.filter((p) => p.id !== playerId)} onPick={setInId} />}
        {takesAssist(t) && (
          <Picks label="Pase de" value={assistId} options={[{ id: "", name: "Nadie" }, ...people.filter((p) => p.id !== playerId)]} onPick={setAssistId} />
        )}

        <div className="fsec">
          <h3 id="ms-edit-min">Minuto</h3>
          <div className="stp" role="group" aria-labelledby="ms-edit-min">
            <button type="button" aria-label="Un minuto antes" disabled={minute <= 1} onClick={() => setMinute((m) => Math.max(1, m - 1))}>−</button>
            <span className="g" aria-live="polite">{minute}′</span>
            <button type="button" aria-label="Un minuto después" disabled={minute >= top} onClick={() => setMinute((m) => Math.min(top, m + 1))}>+</button>
          </div>
        </div>

        <div className="eacts">
          <button type="button" className="key" onClick={onClose}>Cancelar</button>
          <button type="button" className="key on" onClick={save}>Guardar</button>
        </div>
      </div>
    </>
  );
}
