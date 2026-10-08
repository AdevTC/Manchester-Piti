// The match's «Convocatoria» tab: «El siete y los nuestros» — each player of the season as Titular /
// Suplente / No convocado, at most seven titulares (with the message), the counters, «Copiar la
// convocatoria de la J7» and «Marcar los restantes como no convocados».
import { useState } from "react";
import type { RosterPlayer } from "../data/useAdminData";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { assign, copyLineup, lineupCounts, restNotCalled, type Lineup, type Role } from "../acta/convocatoria";
import type { MatchSheet } from "../acta/sheetModel";
import { ConvocatoriaRows } from "./ConvocatoriaRows";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface PreviousLineup {
  /** «J7». */
  label: string;
  lineup: Lineup;
}

export function LineupTools({ lineup, roster, previous, onChange }: { lineup: Lineup; roster: readonly RosterPlayer[]; previous: PreviousLineup | null; onChange: (l: Lineup) => void }) {
  const toast = useToast();
  const ids = roster.map((p) => p.id);
  const c = lineupCounts(lineup, ids);
  if (!previous && !c.unassigned) return null;
  return (
    <div className="row ad-cvtools">
      {previous && (
        <button
          type="button"
          className="btn sm line"
          onClick={() => {
            const before = lineup;
            onChange(copyLineup(previous.lineup, ids));
            toast.show({ message: `Convocatoria de la ${previous.label} copiada.`, undo: () => onChange(before) });
          }}
        >
          <AdIcon name="list" size={16} />
          Copiar la convocatoria de la {previous.label}
        </button>
      )}
      {c.unassigned > 0 && (
        <button type="button" className="btn sm line" onClick={() => onChange(restNotCalled(lineup, ids))}>
          Marcar {c.unassigned === 1 ? "al que falta" : `los ${c.unassigned} restantes`} como no convocado{c.unassigned === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

export function TabConvocatoria({ sheet, update, roster, previous }: { sheet: MatchSheet; update: (f: (s: MatchSheet) => MatchSheet) => void; roster: readonly RosterPlayer[]; previous: PreviousLineup | null }) {
  const [msg, setMsg] = useState("");
  const lineup: Lineup = { starters: sheet.starters, bench: sheet.bench, notCalled: sheet.notCalled };
  const c = lineupCounts(
    lineup,
    roster.map((p) => p.id),
  );
  const setRole = (id: string, role: Role) => {
    const r = assign(lineup, id, role, roster.find((p) => p.id === id)?.name);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg("");
    update((s) => ({ ...s, ...r.lineup }));
  };
  return (
    <div className="pnl">
      <div className="bh">
        <h3 className="h3">El siete y los nuestros</h3>
        <div className="cvc">
          <span className={`chip ${c.starters === 7 ? "ok" : "warn"}`}>{c.starters} de 7 titulares</span>
          <span className="chip">{plural(c.bench, "suplente", "suplentes")}</span>
          <span className="chip">{plural(c.notCalled, "no convocado", "no convocados")}</span>
          {c.unassigned > 0 && <span className="chip warn">{c.unassigned} sin asignar</span>}
        </div>
      </div>
      {msg && (
        <p className="note" role="alert">
          <AdIcon name="alert" size={15} />
          {msg}
        </p>
      )}
      <LineupTools lineup={lineup} roster={roster} previous={previous} onChange={(l) => update((s) => ({ ...s, ...l }))} />
      {roster.length ? (
        <ConvocatoriaRows roster={roster} lineup={lineup} onSet={setRole} />
      ) : (
        <p className="hint">{sheet.seasonId ? "Nadie en la plantilla de esta temporada: asocia jugadores desde Plantilla." : "Elige primero la temporada en «Encuentro»."}</p>
      )}
      <p className="hint">Los cambios durante el partido se apuntan en el acta, en «Otros eventos».</p>
    </div>
  );
}
