// r14 «La pizarra» · «Mover a…»: every slot of the seven with how he fits there; a taken one swaps (no drag).
import { useEffect } from "react";
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { bindSieteApi } from "../../places/siete/sieteApi";
import "../../../../../styles/pz/siete.css";

export function MoverSheet({ args }: SheetProps) {
  const P = usePz();
  useEffect(() => bindSieteApi(P), [P]);
  const v = P.sel.ver();
  const pid = typeof args.pid === "string" ? args.pid : typeof args.jugador === "string" ? args.jugador : "";
  if (!v || !pid || !P.sel.player(pid)) return <p className="pz-line">Ese jugador ya no está en la plantilla.</p>;
  const ro = !P.sel.canEdit();
  const from = v.slots.findIndex((s) => s.playerId === pid);
  return (
    <div className="pz-sh pz-7 is-flow">
      <p className="pz-line">
        {P.sel.name(pid)}
        {from >= 0 ? " está de " + v.slots[from].code : " está en el banquillo"}. Elige su sitio:
      </p>
      <ul className="pz-rows">
        {v.slots.map((s, i) => {
          const g = P.sel.fit(pid, s.code);
          const here = i === from;
          return (
            <li key={i}>
              <button
                type="button"
                className="pz-row"
                onClick={() => P.act.moveTo(pid, i)}
                disabled={here || ro}
                aria-label={`${s.code}, ${P.sel.posName(s.code)}, ${P.sel.fitWord(g)}${s.playerId && !here ? ", se cambia con " + P.sel.name(s.playerId) : ""}`}
              >
                <span className="vx-tile pz-7__code">{s.code}</span>
                <span className="pz-row__t">
                  <b>
                    {P.sel.posName(s.code)} · {P.sel.fitWord(g)}
                  </b>
                  <span>{here ? "Aquí está" : s.playerId ? "Con " + P.sel.name(s.playerId) + ": se cambian" : "Hueco libre"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
