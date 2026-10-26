// «Lo demás»: adding or editing a card, a change, a penalty or anything else, with the same dorsal picker
// as the goals (the v2 Popover in place under its group; a bottom sheet on phones): the kind (when the
// group has several), the minute, the player by dorsal — a change asks who leaves and who comes on, a «Cambio
// de sitio» the two on the pitch at that minute who trade places —, and Añadir / Guardar · Cancelar · Quitar.
import { isGuestId } from "../../../lib/derived/guests";
import "../kit/guests.css";
import { useId, useRef, useState, type RefObject } from "react";
import type { EventType, MatchEvent } from "../../../../functions/src/matchEngine";
import { Popover } from "../ui/layers";
import { checkEvent, KINDS, playerMode, playerQuestion, type EventGroup, type PickOption } from "./pickModel";

export interface EventPanelProps {
  group: EventGroup;
  title: string;
  /** The event being edited (null = a new one). */
  event: MatchEvent | null;
  /** The new event's id. */
  newId: string;
  duration: number;
  field: PickOption[];
  bench: PickOption[];
  /** Who is on the pitch at a minute (a «Cambio de sitio» picks its two from here). */
  fieldAt: (minute: number) => PickOption[];
  anchorRef: RefObject<HTMLElement | null>;
  onSave: (e: MatchEvent) => void;
  onRemove: (e: MatchEvent) => void;
  onClose: () => void;
}

export function EventPanel(p: EventPanelProps) {
  const id = useId();
  const kinds = KINDS[p.group];
  const ev = p.event;
  const [type, setType] = useState<EventType>(ev?.type ?? kinds[0].type);
  const [minute, setMinute] = useState(ev?.minute !== undefined ? String(ev.minute) : "");
  const [player, setPlayer] = useState(ev?.playerId ?? "");
  const [inPlayer, setInPlayer] = useState(ev?.inPlayerId ?? "");
  const [error, setError] = useState("");
  const minuteRef = useRef<HTMLInputElement>(null);
  const sub = type === "substitution";
  const swap = type === "position_swap";
  const all = [...p.field, ...p.bench];
  // (the swap's pitch: who is on it at the minute written; none until there is one)
  const minuteOk = minute.trim() !== "" && Number.isInteger(Number(minute)) && Number(minute) <= p.duration;
  const swapField = swap && minuteOk ? p.fieldAt(Number(minute)) : [];

  const save = () => {
    const why = checkEvent({ type, minute, player, inPlayer, duration: p.duration, field: swap && minuteOk ? swapField.map((o) => o.id) : undefined });
    if (why) {
      setError(why);
      return;
    }
    p.onSave({ ...ev, id: ev?.id ?? p.newId, type, minute: Number(minute), elapsedSeconds: ev?.minute === Number(minute) ? ev.elapsedSeconds : undefined, playerId: player && playerMode(type) !== "none" ? player : undefined, inPlayerId: sub || swap ? inPlayer : undefined });
  };
  const grid = (list: PickOption[], value: string, set: (v: string) => void, isBench: boolean, verb: string, skip?: string) => (
    <div className="pg">
      {list
        .filter((o) => o.id !== skip)
        .map((o) => (
          <button key={o.id} type="button" className={["pp", isBench ? "bench" : "", isGuestId(o.id) ? "guest" : "", value === o.id ? "on" : ""].filter(Boolean).join(" ")} aria-pressed={value === o.id} aria-label={`${verb} ${o.name}, dorsal ${o.num}`} onClick={() => set(o.id)}>
            <b>{o.num}</b>
            <small>{o.name}</small>
          </button>
        ))}
    </div>
  );
  /** The dorsal grids: `first` (labelled `label`) then the other list (labelled `otherLabel`). */
  const players = (value: string, set: (v: string) => void, verb: string, label: string, o: { skip?: string; benchFirst?: boolean } = {}) => {
    const [a, b] = o.benchFirst ? [p.bench, p.field] : [p.field, p.bench];
    const rest = b.filter((x) => x.id !== o.skip);
    return (
      <>
        <p className="pk-lb">{label}</p>
        {grid(a, value, set, !!o.benchFirst, verb, o.skip)}
        {rest.length ? (
          <>
            <p className="pk-lb">{o.benchFirst ? "Titulares (vuelve a entrar)" : "Banquillo"}</p>
            {grid(b, value, set, !o.benchFirst, verb, o.skip)}
          </>
        ) : null}
      </>
    );
  };
  const pick = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError("");
  };
  const footer = (
    <>
      <button type="button" className="btn sm sky" onClick={save}>
        {ev ? "Guardar" : "Añadir"}
      </button>
      <button type="button" onClick={p.onClose}>
        Cancelar
      </button>
      {ev && (
        <button type="button" onClick={() => p.onRemove(ev)}>
          Quitar
        </button>
      )}
    </>
  );
  return (
    <Popover open onClose={p.onClose} anchorRef={p.anchorRef} title={ev ? `Editar · ${p.title}` : `Añadir en ${p.title}`} subtitle="Minuto y jugador por su dorsal" footer={footer} initialFocus={minuteRef}>
      {kinds.length > 1 && (
        <div className="fld">
          <span className="lb" id={`${id}-k`}>
            Qué pasó
          </span>
          <div className="sgf" role="group" aria-labelledby={`${id}-k`}>
            {kinds.map((k) => (
              <button key={k.type} type="button" aria-pressed={type === k.type} onClick={() => { setType(k.type); if (playerMode(k.type) === "none") setPlayer(""); setInPlayer(""); setError(""); }}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="fld" style={{ maxWidth: 140 }}>
        <label htmlFor={`${id}-m`}>Minuto</label>
        <input
          ref={minuteRef}
          id={`${id}-m`}
          className="inp"
          inputMode="numeric"
          maxLength={3}
          value={minute}
          placeholder="min"
          onChange={(e) => {
            setMinute(e.target.value.replace(/[^0-9]/g, ""));
            setError("");
          }}
        />
      </div>
      {playerMode(type) === "optional" && <button type="button" className="btn sm line" aria-pressed={!player} onClick={() => setPlayer("")}>Equipo · sin jugador</button>}
      {playerMode(type) === "none" ? null : !all.length ? (
        <p className="pk-lb">Aún no hay convocados: los jugadores salen de la convocatoria.</p>
      ) : swap ? (
        !minuteOk ? (
          <p className="pk-lb">Cambio de sitio: pon el minuto y te enseño quién estaba en el campo.</p>
        ) : (
          <>
            <p className="pk-lb">{playerQuestion(type)}</p>
            {grid(swapField, player, pick(setPlayer), false, "Se cambia")}
            {player ? (
              <>
                <p className="pk-lb">Con quién se cambia</p>
                {grid(swapField, inPlayer, pick(setInPlayer), false, "Se cambia con", player)}
              </>
            ) : null}
          </>
        )
      ) : sub ? (
        <>
          {players(player, pick(setPlayer), "Sale", "Sale del campo")}
          {player ? players(inPlayer, pick(setInPlayer), "Entra", "Entra al campo · del banquillo", { skip: player, benchFirst: true }) : null}
        </>
      ) : (
        players(player, pick(setPlayer), "Elegir a", playerQuestion(type))
      )}
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
    </Popover>
  );
}
