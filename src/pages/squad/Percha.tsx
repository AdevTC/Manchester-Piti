import type { CSSProperties } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import type { SquadRow } from "../../lib/squad";

export const VT_SHIRT = "sq-shirt";

/** Chrome wire hanger; its hook curls over the rail and the shoulders hide inside the shirt. */
function Hanger() {
  return (
    <svg className="hanger" viewBox="0 0 100 60" aria-hidden="true">
      <path d="M50 47 V31 C50 25 57 22 57 15.5 C57 10 53 8 49.5 8.5 C46 9 44.5 11.5 45 14" />
      <path d="M50 47 L24 56.5 M50 47 L76 56.5" />
    </svg>
  );
}

interface Props {
  rows: SquadRow[];
  /** Photo of each player's shirt, when it is ready. */
  still: (row: SquadRow) => string | undefined;
  /** The player whose ficha is open (their shirt has flown to the modal). */
  openId: string | null;
  /** Carries the shared-element name for the open/close transition. */
  vtId: string | null;
  onOpen: (id: string) => void;
}

/** The rail of hanging shirts. Nothing is picked until the viewer taps one. */
export function Percha({ rows, still, openId, vtId, onOpen }: Props) {
  return (
    <div className="sq-rail" role="group" aria-label="Elige jugador">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <linearGradient id="sq-wire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f8fd" />
          <stop offset=".5" stopColor="#9fb0c8" />
          <stop offset="1" stopColor="#4f6180" />
        </linearGradient>
      </svg>
      <div className="sq-track">
        <div className="sq-line">
          {rows.map((r, i) => {
            const src = still(r);
            return (
              <button
                key={r.id}
                type="button"
                className={`sq-hang${r.id === openId ? " away" : ""}`}
                style={{ "--i": i } as CSSProperties}
                aria-haspopup="dialog"
                aria-label={`${r.name}, dorsal ${r.num}: ver ficha`}
                onClick={() => onOpen(r.id)}
              >
                <span className="frame">
                  <span className="swing">
                    <Hanger />
                    <span className="shirt" style={{ viewTransitionName: vtId === r.id && openId !== r.id ? VT_SHIRT : undefined }}>
                      {src ? <img src={src} alt="" draggable={false} /> : <ShirtBack name={r.name} num={r.num} />}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
