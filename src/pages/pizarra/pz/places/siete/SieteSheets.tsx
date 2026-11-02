// r14 «La pizarra» · Siete's own sheets: «Empezar desde…» (PZ-M08) and a galón (who wears the armband, who
// takes the penalties…: from the seven on the pitch; the vice is never the captain).
import { usePz } from "../../store/context";
import { GALONES } from "../../store/store";
import type { SheetProps } from "../../store/types";
import { RowShirt } from "./RowShirt";
import { Sources } from "./Siete";
import "../../../../../styles/pz/siete.css";

export function DesdeSheet() {
  return (
    <div className="pz-sh pz-7 is-flow">
      <p className="pz-line">Coge un siete hecho y cámbialo. Lo de ahora se puede deshacer.</p>
      <Sources />
    </div>
  );
}

export function GalonesSheet({ args }: SheetProps) {
  const P = usePz();
  const b = P.sel.board();
  const v = P.sel.ver();
  const g = GALONES.find((x) => x.k === args.k);
  if (!b || !v || !g) return <p className="pz-line">Abre un tablero para repartir los galones.</p>;
  const ro = !P.sel.canEdit(b);
  const onField = P.sel.placed(v);
  const cur = "taker" in g ? P.sel.taker(b, v, g.taker) : (b.lineup.roles[g.role] ?? null);
  const line = g.k === "C" || g.k === "V" ? "Del siete en el campo. El vice nunca es el capitán." : "El primero de la lista que esté en el campo los tira. Toca al que quieras primero.";
  if (!onField.length) return <p className="pz-line">Pon a alguien en el campo para darle {g.one}.</p>;
  return (
    <div className="pz-sh pz-7 is-flow">
      <p className="pz-line">{line}</p>
      <ul className="pz-rows">
        {onField.map((id) => {
          const on = cur === id;
          const gs = P.sel.galones(id, b, v).map((x) => x.t).join(" · ");
          return (
            <li key={id}>
              <button
                type="button"
                className={`pz-row${on ? " is-on" : ""}`}
                aria-pressed={on}
                disabled={ro}
                onClick={() => {
                  P.act.setRole(g.role, id);
                  P.act.closeSheet();
                }}
              >
                <RowShirt still={P.sel.shirt(id)} size={30} />
                <span className="pz-row__t">
                  <b>{P.sel.name(id)}</b>
                  <span>{on ? (ro ? g.t : g.t + " · toca para quitárselo") : gs || "Sin galones"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
