import type { CSSProperties } from "react";
import { ShirtBack } from "../../components/celeste/ShirtBack";
import { TagRow } from "../../components/paginas/Tags";
import type { SquadRow } from "../../lib/squad";
import type { SquadLiveRow } from "../../lib/derived/vidrio/squadLive";

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
  /** Match day (squadLive): each player's status and marks under his shirt; «No juega hoy» dims it. */
  live?: ReadonlyMap<string, SquadLiveRow> | null;
  /** Our scorer, while his goal's moment plays: his shirt lifts. */
  lift?: string | null;
}

/** The rail of hanging shirts. Nothing is picked until the viewer taps one. On match day each one says where
 *  he is (V-Vivo «La percha sabe quién está en el campo»). */
export function Percha({ rows, still, openId, vtId, onOpen, live = null, lift = null }: Props) {
  return (
    <div className="sq-rail vd-reg-2" role="group" aria-label="Elige jugador">
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
            const l = live?.get(r.id) ?? null;
            const said = l ? `: ${l.status.toLocaleLowerCase("es")}${l.tags.length ? `, ${l.tags.map((t) => t.label.toLocaleLowerCase("es")).join(", ")}` : ""}.` : ":";
            return (
              <button
                key={r.id}
                type="button"
                className={`sq-hang${r.id === openId ? " away" : ""}${l ? ` is-${l.tone}` : ""}${lift === r.id ? " sq-lift" : ""}`}
                style={{ "--i": i } as CSSProperties}
                aria-haspopup="dialog"
                aria-label={`${r.name}, dorsal ${r.num}${said} Ver ficha`}
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
                <span className="sq-cap" aria-hidden="true">
                  <b className="sq-cap__nm">{r.name}</b>
                  {r.position && <span className="sq-cap__pos">{r.position}</span>}
                  {l && (
                    <span className="sq-cap__st">
                      {l.tone === "on" && <i className="vd-ondot" />}
                      {l.status}
                    </span>
                  )}
                  {l && <TagRow tags={l.tags} className="vd-tags sq-cap__tags" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
