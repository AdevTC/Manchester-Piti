// r14 «La pizarra» · «¿Quién al MC?» (PZ-M07): for an empty slot (or one to change), who fits best, with the
// reasons in words — «Ha jugado de MC 44′ · nota 6,8 en la J2 · Voy» — the best one marked; then who can't.
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { RowShirt } from "../../places/siete/RowShirt";
import { shirtLabel } from "../../places/siete/sieteView";
import { useSieteSheet } from "../../places/siete/sieteApi";
import "../../../../../styles/pz/siete.css";

export function CandidatosSheet({ args }: SheetProps) {
  const P = usePz();
  useSieteSheet(P);
  const v = P.sel.ver();
  const i = typeof args.hueco === "number" ? args.hueco : typeof args.slot === "number" ? args.slot : (P.state.slotPick ?? 0);
  const slot = v?.slots[i];
  if (!v || !slot) return <p className="pz-line">Ese hueco ya no está en el siete.</p>;
  const ro = !P.sel.canEdit();
  const list = P.sel.candidates(i, v).filter((c) => !c.on);
  const ok = list.filter((c) => c.can);
  const no = list.filter((c) => !c.can);
  const cur = slot.playerId;
  return (
    <div className="pz-sh pz-7 is-flow">
      <p className="pz-line">
        {P.sel.posName(slot.code)} en el {v.formation}
        {cur ? ` · ahora, ${P.sel.name(cur)}` : ""}. Primero los que van y encajan; luego la forma.
      </p>
      {ok.length ? (
        <ul className="pz-rows pz-7__cand">
          {ok.slice(0, 8).map((c, k) => {
            const pl = P.sel.player(c.pid);
            return (
              <li key={c.pid}>
                <button type="button" className="pz-row" onClick={() => P.act.place(c.pid, i)} disabled={ro} aria-label={`${pl?.shirt ?? ""}: ${c.why}. ${ro ? "Solo lectura" : "Ponerlo de " + slot.code}`}>
                  <RowShirt still={P.sel.shirt(c.pid)} />
                  <span className="pz-row__t">
                    <b>
                      {shirtLabel(pl)}
                      {k === 0 && <span className="pz-7__best">Mejor opción</span>}
                    </b>
                    <span>{c.why}</span>
                  </span>
                  <span className="pz-row__n">
                    <b>{pl?.global ?? "—"}</b>
                    <small>media</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pz-meta pz-7__none">No queda nadie en el banquillo que pueda jugar.</p>
      )}
      {no.length > 0 && (
        <>
          <p className="pz-7__grp">
            <span>No pueden</span>
            <span>{no.length}</span>
          </p>
          <p className="pz-meta">{no.map((c) => P.sel.name(c.pid) + " (" + (c.r.why || c.r.t).toLowerCase() + ")").join(" · ")}</p>
        </>
      )}
    </div>
  );
}
