import { useEffect, useRef, type CSSProperties } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import type { SquadRow } from "../../lib/squad";

/** The rail of hanging shirts: one per player, the selected one lifted off the bar. */
export function Percha({ rows, selId, onSelect }: { rows: SquadRow[]; selId?: string; onSelect: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // Keep the selected shirt in view on the scrollable (phone) rail.
  useEffect(() => {
    const el = track.current;
    const btn = el?.querySelector<HTMLElement>(".sq-hang.on");
    if (!el || !btn || el.scrollWidth <= el.clientWidth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.clientWidth) / 2, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [selId, rows.length]);
  return (
    <div className="sq-rail" role="group" aria-label="Elige jugador">
      <div className="sq-track" ref={track}>
        <div className="sq-line">
          {rows.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`sq-hang${r.id === selId ? " on" : ""}`}
              style={{ "--i": i } as CSSProperties}
              aria-pressed={r.id === selId}
              aria-label={`${r.name}, dorsal ${r.num}`}
              onClick={() => onSelect(r.id)}
            >
              <ShirtBack name={r.name} num={r.num} hanger />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
