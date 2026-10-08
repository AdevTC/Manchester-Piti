// «¿Borrar la J7 · FUSION 7?» — the red confirmation of «Borrar partido» (Encuentro), with what is lost.
// The server (deleteMatch callable) only deletes a match nobody has played: a played one is corrected or
// set to «Cancelado» — it feeds the stats, the MVP and the porra.
import { useState } from "react";
import { apiError, deleteMatch } from "../../../lib/clubApi";
import { ConfirmModal } from "../ui/layers";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteMatchModal({
  matchId,
  label,
  goals,
  events,
  called,
  played,
  onClose,
  onDeleted,
}: {
  matchId: string;
  /** «J7 · FUSION 7». */
  label: string;
  goals: number;
  events: number;
  called: number;
  /** Finished and published: the server refuses, so the modal explains instead of offering it. */
  played: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = "Este partido ya se jugó y cuenta en las estadísticas: corrige el acta o pon el estado «Cancelado».";
  return (
    <ConfirmModal
      open
      onClose={onClose}
      tone="red"
      kicker="Partidos · no se puede deshacer"
      title={`¿Borrar la ${label}?`}
      lede="Se borra el partido entero."
      consequences={[
        { tone: "r", text: `Se borran ${called ? `la convocatoria (${plural(called, "jugador", "jugadores")}), ` : ""}${plural(goals, "gol", "goles")} y ${plural(events, "evento", "eventos")}` },
        { tone: "r", text: "Desaparece del calendario y de las estadísticas" },
        { tone: "", text: "Si solo se aplazó o se suspendió, cambia el estado en «Encuentro»" },
      ]}
      cancelLabel="Mejor no"
      confirmLabel="Borrar partido"
      confirmTone="red solid"
      busy={busy}
      confirmDisabled={played}
      error={played ? blocked : error || undefined}
      onConfirm={() => {
        if (played || busy) return;
        setError("");
        setBusy(true);
        deleteMatch({ id: matchId })
          .then(() => onDeleted())
          .catch((e: unknown) => setError(apiError(e)))
          .finally(() => setBusy(false));
      }}
    />
  );
}
