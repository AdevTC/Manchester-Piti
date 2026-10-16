// «Invitados» — the acta's and Convocar's guests: one chip each (the dashed «INV» shirt, his name and the
// word «Invitado»), «Siete» / «Banq.» where the convocatoria is set, «Quitar» while no event names him,
// and «Añadir invitado» (a name, up to four per match).
import { useId, useState, type FormEvent } from "react";
import { GUEST_NAME_MAX, MAX_GUESTS, type MatchGuest } from "../../../lib/derived/guests";
import "./guests.css";

export interface GuestPanelProps {
  guests: readonly MatchGuest[];
  /** Adds one; returns why not (shown under the field) or "" when added. */
  onAdd: (name: string) => string;
  onRemove: (id: string) => void;
  /** Whether an event names him (he can't be removed then). */
  inUse: (id: string) => boolean;
  /** Where he is in the convocatoria (Convocar: with «Siete» / «Banq.»). */
  slotOf?: (id: string) => "T" | "B" | null;
  onPlace?: (id: string, slot: "T" | "B") => void;
}

const SLOT_TEXT = { T: "En el siete", B: "En el banquillo" } as const;

export function GuestPanel({ guests, onAdd, onRemove, inUse, slotOf, onPlace }: GuestPanelProps) {
  const id = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const full = guests.length >= MAX_GUESTS;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const why = onAdd(name);
    setError(why);
    if (!why) setName("");
  };
  return (
    <section className="gst" aria-labelledby={`${id}-h`}>
      <p className="ch3" id={`${id}-h`}>
        Invitados <em>{guests.length} de {MAX_GUESTS}</em>
      </p>
      {guests.length > 0 && (
        <ul className="gst-list">
          {guests.map((g) => {
            const slot = slotOf?.(g.id) ?? null;
            const used = inUse(g.id);
            return (
              <li key={g.id} className="gst-chip">
                <span className="gst-shirt" aria-hidden="true">
                  INV
                </span>
                <span className="gst-nm">
                  <b>{g.name}</b>
                  <small>
                    Invitado{slot ? ` · ${SLOT_TEXT[slot]}` : ""}
                    {used ? " · sale en el acta" : ""}
                  </small>
                </span>
                {onPlace && (
                  <>
                    <button type="button" className="btn sm line" aria-pressed={slot === "T"} aria-label={`${g.name}, invitado, al siete`} onClick={() => onPlace(g.id, "T")}>
                      Siete
                    </button>
                    <button type="button" className="btn sm line" aria-pressed={slot === "B"} aria-label={`${g.name}, invitado, al banquillo`} onClick={() => onPlace(g.id, "B")}>
                      Banq.
                    </button>
                  </>
                )}
                <button type="button" className="btn sm line" disabled={used} aria-label={used ? `No se puede quitar a ${g.name}: sale en el acta` : `Quitar al invitado ${g.name}`} onClick={() => onRemove(g.id)}>
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {full ? (
        <p className="hint">Ya hay {MAX_GUESTS} invitados: es el máximo por partido.</p>
      ) : (
        <form className="gst-add" onSubmit={submit}>
          <label htmlFor={`${id}-n`}>
            Nombre del invitado
            <input
              id={`${id}-n`}
              className="inp"
              value={name}
              maxLength={GUEST_NAME_MAX}
              autoComplete="off"
              placeholder="Rafa"
              aria-describedby={error ? `${id}-e` : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn sm">
            Añadir invitado
          </button>
        </form>
      )}
      {error && (
        <p className="gst-err" id={`${id}-e`} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
