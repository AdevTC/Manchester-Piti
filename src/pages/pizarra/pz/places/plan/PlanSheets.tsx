// r14 · Plan's sheets: «El plan de un vistazo» (what la charla tells and the cartel carries) and «La jugada» of a
// corner / free kick (pick the play the set piece runs).
import "../../../../../styles/pz/plan.css";
import { usePz } from "../../store/context";
import type { SheetProps } from "../../store/types";
import { PzIcon } from "../../campo/Shirt";
import { fmt } from "../../store/fmt";
import { paradoOf, playsFor, withParado } from "./planPlace";
import { PARADO_KIND, planResumen } from "./planView";
import { isLibraryPlay, usePlanPlays } from "./planHooks";

export function GlanceSheet() {
  const P = usePz();
  const R = planResumen(P);
  if (!R) return <p className="pz-line">Sin tablero todavía.</p>;
  const rows: { k: string; lines: { icon: string; t: string }[] }[] = [
    { k: "El rival", lines: [{ icon: "shield", t: R.danger || "Sin notas del rival" }] },
    { k: "Las claves", lines: R.claves.length ? R.claves.map((c) => ({ icon: c.icon, t: c.t })) : [{ icon: "dots", t: "Sin claves" }] },
    { k: "El juego", lines: [{ icon: "ball", t: R.juego }] },
    { k: "Pelotas paradas", lines: [{ icon: "flag", t: R.parado }] },
    { k: "Si pasa…", lines: R.sipasa.length ? R.sipasa.map((t) => ({ icon: "swap", t })) : [{ icon: "dots", t: "Nada previsto" }] },
    ...(R.notas ? [{ k: "Notas", lines: [{ icon: "edit", t: R.notas }] }] : []),
  ];
  return (
    <div className="pp pp--sheet">
      <div className="pp__gl">
        <div className="pp__glh">
          <b>{R.rival ? "Contra " + R.rival : "El plan"}</b>
          {R.match && <span>{R.match}</span>}
        </div>
        {rows.map((r) => (
          <div className="pp__glr" key={r.k}>
            <span>{r.k}</span>
            <div>
              {r.lines.map((l, i) => (
                <p key={i}>
                  <PzIcon name={l.icon} />
                  <span>{l.t}</span>
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="pp__note">Lo mismo que cuenta la charla y lleva el cartel.</p>
      <div className="pz-acts">
        <button
          type="button"
          className="vd-glass vd-press pz-btn pz-btn--pri"
          onClick={() => {
            P.act.closeSheet();
            P.nav("/pizarra/charla");
          }}
        >
          <PzIcon name="mic" />
          Llevar a la charla
        </button>
        <button type="button" className="vd-glass vd-press pz-btn" onClick={() => P.act.openSheet("compartir", { from: "plan" })}>
          <PzIcon name="share" />
          Compartir
        </button>
      </div>
    </div>
  );
}

export function PlayPickSheet({ args }: SheetProps) {
  const P = usePz();
  const plays = usePlanPlays(P);
  const b = P.sel.board();
  const k = args.k === "freekicks" ? "freekicks" : "corners";
  if (!b) return null;
  const K = PARADO_KIND[k];
  const cur = paradoOf(b.lineup)[k];
  const list = playsFor(k, plays);
  const set = (id: string | null, label: string) => {
    P.act.saveBoard(
      withParado(P.sel.board()?.lineup ?? b.lineup, (x) => {
        x[k].playId = id;
      }),
      label,
    );
    P.act.closeSheet();
  };
  return (
    <div className="pp pp--sheet">
      <p className="pz-line">{"Las de " + (k === "corners" ? "córner" : "falta") + " del equipo y las del tablero. Se cambian en Jugadas."}</p>
      {list.length ? (
        <ul className="pz-rows">
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" className="pz-row" aria-pressed={cur.playId === x.id} onClick={() => set(x.id, K.t + ": «" + x.name + "»")}>
                <span className="vx-tile">
                  <PzIcon name="play" />
                </span>
                <span className="pz-row__t">
                  <b>{x.name}</b>
                  <span>{fmt.plural(x.frames.length, "paso", "pasos") + " · " + (isLibraryPlay(x.id) ? "Del equipo" : "Del tablero")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pz-line">No hay jugadas de {k === "corners" ? "córner" : "falta"}: créala en Jugadas.</p>
      )}
      {cur.playId && (
        <div className="pz-acts">
          <button type="button" className="nx-lnk" onClick={() => set(null, K.t + ": sin jugada")}>
            Sin jugada
          </button>
        </div>
      )}
    </div>
  );
}
