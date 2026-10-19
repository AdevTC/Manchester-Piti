// The glass segmented shelf: a row of places with a bead that slides to the chosen one. Tabs semantics (the
// page's panel carries id = shelfPanelId(idBase, place) and aria-labelledby = shelfTabId(idBase, place));
// arrows, Home and End move and choose (automatic activation), one tab stop. `variant="seg"` is the smaller
// control (Jornadas / Tabla / Números, Previa / Directo / Acta).
import { useRef, type CSSProperties, type KeyboardEvent } from "react";
import { nextIndex, shelfPanelId, shelfTabId } from "./shelfIds";
import "../../styles/vidrio/tokens.css";
import "../../styles/vidrio/glass.css";
import "../../styles/vidrio/components.css";

export interface ShelfPlace {
  id: string;
  label: string;
  /** A short live line under the label («2–1, minuto 23»). */
  hint?: string;
  /** A count or a word on the place (pending things in «Tú»). */
  badge?: number | string;
}

export interface ShelfProps {
  places: readonly ShelfPlace[];
  value: string;
  onChange: (id: string) => void;
  /** The tablist's accessible name («Lugares de Inicio»). */
  label: string;
  /** The ids' prefix (tabs and panels: shelfTabId / shelfPanelId). */
  idBase: string;
  variant?: "shelf" | "seg";
  className?: string;
}

export function Shelf({ places, value, onChange, label, idBase, variant = "shelf", className }: ShelfProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const at = Math.max(0, places.findIndex((p) => p.id === value));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = nextIndex(e.key, at, places.length);
    if (to == null) return;
    e.preventDefault();
    const place = places[to];
    if (!place) return;
    onChange(place.id);
    root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[to]?.focus();
  };
  const style = { "--n": places.length, "--i": at } as CSSProperties;
  const seg = variant === "seg";
  return (
    <div ref={root} className={`vd-glass ${seg ? "vd-seg" : "vd-shelf"}${className ? ` ${className}` : ""}`} role="tablist" aria-label={label} style={style} onKeyDown={onKey}>
      <span className="vd-shelf__bead" aria-hidden="true" />
      {places.map((p) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={shelfTabId(idBase, p.id)}
            aria-controls={shelfPanelId(idBase, p.id)}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className={seg ? "vd-seg__b" : "vd-shelf__b"}
            onClick={() => onChange(p.id)}
          >
            <b>{p.label}</b>
            {p.hint && !seg && <small>{p.hint}</small>}
            {p.badge != null && p.badge !== 0 && p.badge !== "" && (
              <>
                <span className="vd-badge" aria-hidden="true">
                  {p.badge}
                </span>
                <span className="vd-vh">, {p.badge}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
