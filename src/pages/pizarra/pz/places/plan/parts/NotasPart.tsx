// r14 · Plan › Notas: what the captain says before going out (read in la charla's «El plan» step; plan.notes).
import { usePz } from "../../../store/context";
import type { Layout } from "../../../store/types";
import { PLAN_LIMITS } from "../../../../data/plan";
import { withPlan } from "../planPlace";
import { planOf } from "../planView";
import { useDrafts } from "../planHooks";

export function NotasPart({ layout: _layout }: { layout: Layout }) {
  const P = usePz();
  const dr = useDrafts();
  const b = P.sel.board();
  if (!b) return null;
  const ro = !P.sel.canEdit(b);
  const pl = planOf(b.lineup);
  const nv = dr.get("notes", pl.notes);
  const commit = () => {
    const raw = dr.raw("notes");
    if (raw == null) return;
    dr.drop("notes");
    const t = raw.trim().slice(0, PLAN_LIMITS.notes);
    if (t === pl.notes) return;
    P.act.saveBoard(
      withPlan(P.sel.board()?.lineup ?? b.lineup, (x) => {
        x.notes = t;
      }),
      t ? "Notas guardadas" : "Notas borradas",
    );
  };
  return (
    <>
      <div className="pp__ph">
        <p className="pz-kick">Notas para la charla</p>
        <h2>{pl.notes ? "Lo que dirás" : "Sin notas todavía"}</h2>
        <p className="pz-line">Se leen en la charla, en el paso «El plan».</p>
      </div>
      {ro ? (
        <p className="pp__sent pp__read">{pl.notes || "El capitán no ha dejado notas."}</p>
      ) : (
        <>
          <label className="vd-glass pp__notes">
            <textarea aria-label="Notas para la charla" maxLength={PLAN_LIMITS.notes} placeholder="Lo que quieres decir antes de salir" value={nv} onChange={(e) => dr.set("notes", e.target.value.slice(0, PLAN_LIMITS.notes))} onBlur={commit} />
          </label>
          <p className="pp__note pp__pad">{nv.length + " de " + PLAN_LIMITS.notes + " · se guarda al salir del texto"}</p>
        </>
      )}
    </>
  );
}
