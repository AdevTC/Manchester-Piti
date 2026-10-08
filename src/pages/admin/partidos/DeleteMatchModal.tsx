// «¿Borrar la J7 · FUSION 7?» — the red confirmation of «Borrar partido» (Encuentro), with what is lost.
// The write goes through the admin's existing delete mutation (useAdminMutations.useDeleteMatch).
import { useState } from "react";
import { apiError } from "../../../lib/clubApi";
import { useDeleteMatch } from "../useAdminMutations";
import { ConfirmModal } from "../ui/layers";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteMatchModal({
  matchId,
  label,
  goals,
  events,
  called,
  onClose,
  onDeleted,
}: {
  matchId: string;
  /** «J7 · FUSION 7». */
  label: string;
  goals: number;
  events: number;
  called: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const del = useDeleteMatch();
  const [error, setError] = useState("");
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
      busy={del.isPending}
      error={error || undefined}
      onConfirm={() => {
        setError("");
        del.mutate(matchId, {
          onSuccess: onDeleted,
          onError: (e) =>
            setError(
              (e as { code?: string }).code === "permission-denied"
                ? "El servidor no deja borrar partidos desde aquí. Mientras tanto, pon el estado «Cancelado» en «Encuentro»."
                : apiError(e),
            ),
        });
      }}
    />
  );
}
