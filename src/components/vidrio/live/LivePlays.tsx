// «Ver todo el partido» from the floating score's sheet: the sheet's plays grow (useGrow, a View Transition)
// into this window — every play so far, ours on the left and theirs on the right with the minute between,
// newest first, by half, filtered Todo · Goles · Tarjetas · Cambios — with its own scroll and «Cerrar».
import { useState, type CSSProperties } from "react";
import { filterPlays, playHalves, PLAY_FILTERS, type PlayFilter, type PlayRow } from "../../../lib/derived/vidrio/plays";
import { plural } from "../../../lib/derived/words";
import { GrowWindow } from "../GrowWindow";

export interface LivePlaysProps {
  open: boolean;
  rows: readonly PlayRow[];
  rival: string;
  phone: boolean;
  name: string;
  onClose: () => void;
}

export function LivePlays({ open, rows, rival, phone, name, onClose }: LivePlaysProps) {
  const [filter, setFilter] = useState<PlayFilter>("todo");
  const shown = filterPlays(rows, filter);
  const at = PLAY_FILTERS.findIndex((f) => f.id === filter);
  const filters = (
    <div className="vd-glass vd-seg" style={{ "--n": PLAY_FILTERS.length, "--i": at } as CSSProperties} role="group" aria-label="Filtrar jugadas">
      <span className="vd-shelf__bead" aria-hidden="true" />
      {PLAY_FILTERS.map((f) => (
        <button key={f.id} type="button" className="vd-seg__b" aria-pressed={f.id === filter} onClick={() => setFilter(f.id)}>
          {f.label}
        </button>
      ))}
    </div>
  );
  return (
    <GrowWindow
      open={open}
      title="Todo el partido"
      name={name}
      className={`vd-livelog${phone ? " vd-livelog--phone" : ""}`}
      filters={filters}
      sub={`${plural(rows.length, "jugada")}. ${phone ? "La más reciente arriba." : `Las nuestras a la izquierda, las de ${rival} a la derecha; la más reciente arriba.`}`}
      onClose={onClose}
    >
      {shown.length === 0 ? (
        <p className="vd-livelog__empty">Ninguna jugada de este tipo todavía.</p>
      ) : (
        playHalves(shown).map((h) => (
          <section key={h.label} aria-label={h.label}>
            <h3 className="vd-grow__sec">{h.label}</h3>
            <ol className="vd-feed">
              {h.rows.map((r) => {
                const us = r.goal ? r.goal === "for" : r.side === "us";
                const minor = r.kind === "otro" || r.kind === "ocasion";
                const words = (
                  <>
                    <b>{r.title}</b>
                    {r.sub && <span>{r.sub}</span>}
                  </>
                );
                return (
                  <li key={r.id} className={`vd-frow${minor ? " is-minor" : ""}`}>
                    <div className="vd-frow__us">{us && words}</div>
                    <span className={`vd-frow__min${r.goal === "for" ? " is-gold" : ""}`}>{r.minuteText || "—"}</span>
                    <div className="vd-frow__them">{!us && words}</div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </GrowWindow>
  );
}
