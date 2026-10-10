// The match's «Convocatoria» tab — read only, as on the canvas (stats-gen/ad-v2-full.mjs `cvT`): el siete in
// shirts, the banquillo, the «Una sola convocatoria» note and «Cambiarla en Convocar» (→ /admin/convocar?j=)
// while the match is still to play; once played the convocatoria is closed (the acta's changes adjust the
// minutes) — unless it was never completed (a played acta without its seven: «Completarla en Convocar»).
// There is ONE convocatoria: Convocar writes it; this tab, the pizarra and the acta read it.
import type { RosterPlayer } from "../data/useAdminData";
import { Peg } from "../kit";
import { AdIcon } from "../ui/icons";
import { useToast } from "../ui/toastContext";
import { copyLineup, lineupCounts, restNotCalled, type Lineup } from "../acta/convocatoria";
import { positionCode } from "../acta/roster";

const SEVEN = 7;

export function TabConvocatoria({
  starters,
  bench,
  info,
  mode,
  onConvocar,
}: {
  starters: readonly string[];
  bench: readonly string[];
  info: (id: string) => { name: string; number: number | null; position: string };
  /** cambiar = still to play · completar = played without its seven · cerrada = played · cancelado. */
  mode: "cambiar" | "completar" | "cerrada" | "cancelado";
  onConvocar: () => void;
}) {
  const seven = [...starters.slice(0, SEVEN), ...Array.from({ length: Math.max(0, SEVEN - starters.length) }, () => null)];
  return (
    <div className="cvr">
      <div className="s7r" role="group" aria-label={`El siete · ${Math.min(starters.length, SEVEN)} de ${SEVEN}`}>
        {seven.map((id, i) => {
          if (!id) return <Peg key={`free-${i}`} label="Libre" size={64} big state="empty" />;
          const p = info(id);
          return <Peg key={id} num={p.number ?? ""} shirtName={p.name} label={p.name} sub={positionCode(p.position)} size={64} big />;
        })}
      </div>
      <p className="ch3">
        Banquillo{" "}
        <em>
          {bench.length
            ? bench.map((id) => {
                const p = info(id);
                return (
                  <span key={id} className="bqi">
                    {p.number ?? ""} {p.name}
                  </span>
                );
              })
            : "nadie todavía"}
        </em>
      </p>
      <div className="src">
        <AdIcon name="shirt" size={20} />
        <span>
          <b>Una sola convocatoria.</b> Esta pestaña lee de Convocar, igual que la pizarra (el siete oficial) y el acta (titulares y suplentes).
        </span>
      </div>
      {mode === "cambiar" || mode === "completar" ? (
        <div className="cta-row">
          <button type="button" className="btn line" onClick={onConvocar}>
            <AdIcon name="shirt" size={18} />
            {mode === "cambiar" ? "Cambiarla en Convocar" : "Completarla en Convocar"}
          </button>
          {mode === "completar" && <span className="warn">Sin el siete completo el acta no se puede publicar</span>}
        </div>
      ) : (
        <p className="hint">{mode === "cancelado" ? "Partido cancelado: no hay convocatoria que cambiar." : "Partido jugado: la convocatoria queda cerrada; los cambios del acta ajustan los minutos."}</p>
      )}
    </div>
  );
}

// ───────────────────────── TEMPORARY (v1 Convocatorias) ─────────────────────────
// The v1 «Convocatorias» view (views/Convocatorias.tsx, replaced by Convocar in phase V1b) still uses these
// tools; delete them with it.
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
