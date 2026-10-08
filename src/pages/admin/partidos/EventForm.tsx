// The inline form of an «Otros eventos» row (`.pf`): minute, player (who leaves, for a change), who comes
// on, an optional note — the old editor's event form, with its checks (a minute inside the match, a
// called-up player, someone different coming on). Used to add and to edit.
import { useId, useRef, useEffect, useState } from "react";
import { EVENT_LABELS, type MatchEvent } from "../../../../functions/src/matchEngine";
import { AdIcon } from "../ui/icons";

export function EventForm({
  event,
  duration,
  options,
  isNew,
  onSave,
  onCancel,
  onRemove,
}: {
  event: MatchEvent;
  duration: number;
  /** Called-up players (id + name), titulares first. */
  options: { id: string; name: string }[];
  isNew: boolean;
  onSave: (e: MatchEvent) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const [minute, setMinute] = useState(event.minute !== undefined ? String(event.minute) : "");
  const [player, setPlayer] = useState(event.playerId ?? "");
  const [inPlayer, setInPlayer] = useState(event.inPlayerId ?? "");
  const [note, setNote] = useState(event.note ?? "");
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const sub = event.type === "substitution";
  const label = EVENT_LABELS[event.type] ?? event.type;
  const save = () => {
    const m = Number(minute);
    if (minute.trim() === "" || !Number.isInteger(m) || m < 0 || m > duration) return setError(`Indica el minuto (de 0 a ${duration}).`);
    if (!player) return setError(sub ? "Elige quién sale del campo." : "Selecciona al jugador.");
    if (sub && (!inPlayer || inPlayer === player)) return setError("Elige quién entra al campo (otro jugador).");
    onSave({ id: event.id, type: event.type, minute: m, playerId: player, ...(sub ? { inPlayerId: inPlayer } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
  };
  return (
    <div className="pf ad-evf" role="group" aria-labelledby={`${id}-t`}>
      <p className="h3 w2" id={`${id}-t`}>
        {isNew ? `Nuevo: ${label.toLowerCase()}` : `Editar: ${label.toLowerCase()}`}
      </p>
      <label className="fld">
        <span className="lbl">Minuto</span>
        <input ref={first} className="inp tn" inputMode="numeric" maxLength={3} value={minute} onChange={(e) => setMinute(e.target.value.replace(/[^0-9]/g, ""))} placeholder="min" />
      </label>
      <label className="fld">
        <span className="lbl">{sub ? "Sale del campo" : "Jugador"}</span>
        <select className="inp" value={player} onChange={(e) => setPlayer(e.target.value)}>
          <option value="">Seleccionar</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {sub && (
        <label className="fld">
          <span className="lbl">Entra al campo</span>
          <select className="inp" value={inPlayer} onChange={(e) => setInPlayer(e.target.value)}>
            <option value="">Seleccionar</option>
            {options
              .filter((o) => o.id !== player)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className={`fld${sub ? "" : " w2"}`}>
        <span className="lbl">Nota (opcional)</span>
        <input className="inp" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && (
        <p className="note" role="alert">
          <AdIcon name="alert" size={15} />
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn sm pri" onClick={save}>
          <AdIcon name="check" size={16} />
          {isNew ? "Añadir evento" : "Guardar evento"}
        </button>
        <button type="button" className="btn sm line" onClick={onCancel}>
          Cancelar
        </button>
        {onRemove && (
          <button type="button" className="btn sm red" onClick={onRemove}>
            <AdIcon name="trash" size={16} />
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}
