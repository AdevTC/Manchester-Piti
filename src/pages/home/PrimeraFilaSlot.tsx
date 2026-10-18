// ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
// │ SLOT · «La primera fila» (W6: src/components/celeste/primeraFila/). Until that component lands in main,   │
// │ this sized slot shows the same row as a plain, accessible list. When it lands, render instead:            │
// │   <PrimeraFila row={row} phase={phase} viewer={viewer} onRsvp={…} onVote={…} />                         │
// │ with `row` = frontRowOf(input) built below (answers: the member's useAvailability, null for fans).        │
// └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
import type { FrontRow } from "../../lib/derived/frontRow";
import type { MatchdayPhase, ViewerRole } from "../../lib/derived/matchday";

export interface PrimeraFilaSlotProps {
  /** frontRowOf({ match, phase, squad, seven, answers, absentIds, viewerPlayerId, scorerIds, mvpVoteOpen, now, history, mvpResults }). */
  row: FrontRow;
  phase: MatchdayPhase;
  viewer: ViewerRole;
}

const TITLE: Record<FrontRow["mode"], string> = {
  plantilla: "La plantilla",
  convocatoria: "La convocatoria",
  banquillo: "El banquillo",
  jugaron: "Los que jugaron",
};

const STATE: Partial<Record<string, string>> = {
  voy: "viene",
  duda: "en duda",
  novoy: "no viene",
  sinresponder: "sin responder",
  convocado: "convocado",
  ausente: "de baja",
  campo: "en el campo",
  banquillo: "en el banquillo",
  expulsado: "expulsado",
  lesionado: "lesionado",
  jugo: "jugó",
  nojugo: "no jugó",
};

export function PrimeraFilaSlot({ row }: PrimeraFilaSlotProps) {
  const seats = row.mode === "convocatoria" ? row.seats.filter((s) => s.state !== "noconvocado") : row.mode === "banquillo" ? row.seats.filter((s) => s.state === "banquillo" || s.state === "expulsado" || s.state === "lesionado") : row.mode === "jugaron" ? row.seats.filter((s) => s.state === "jugo") : row.seats;
  const counts = row.counts;
  return (
    <section className="ei-fila" data-slot="primera-fila" aria-labelledby="ei-fila-h">
      <div className="ei-fila-in">
        <h2 className="ei-h2" id="ei-fila-h">
          {TITLE[row.mode]}
        </h2>
        <p className="ei-meta">
          {row.mode === "convocatoria"
            ? counts
              ? `Vienen ${counts.vienen} de ${seats.length} · ${counts.sinResponder} sin contestar`
              : row.sevenPublished
                ? "El siete, con borde dorado"
                : `${seats.length} convocados`
            : row.mode === "banquillo"
              ? seats.length
                ? "Los convocados que esperan su turno"
                : "Todos en el campo"
              : row.mode === "jugaron"
                ? "Con sus minutos"
                : `${seats.length} camisetas`}
        </p>
        <ul className="ei-seats">
          {seats.map((s) => (
            <li key={s.playerId} className={`${s.starter ? "st" : ""}${s.mine ? " me" : ""}`}>
              <b>{s.dorsal || "–"}</b>
              <span>
                {s.name}
                {s.mine && <small> · tú</small>}
              </span>
              {(row.mode !== "plantilla" && STATE[s.state]) || s.minutes != null ? (
                <small className="st8">{s.minutes != null && row.mode === "jugaron" ? `${Math.round(s.minutes)}′` : STATE[s.state]}</small>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
