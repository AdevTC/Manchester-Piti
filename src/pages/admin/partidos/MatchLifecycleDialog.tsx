import { useState } from "react";
import { apiError, deleteMatch, setMatchArchived } from "../../../lib/clubApi";
import { archiveBlockedReason, matchIdentity, type MatchLifecycleRequest } from "../data/archivedMatches";
import type { AdminData } from "../data/useAdminData";
import { ConfirmModal } from "../ui/layers";

export function MatchLifecycleDialog({ request, data, onClose, onComplete }: {
  request: MatchLifecycleRequest; data: AdminData; onClose: () => void; onComplete: (request: MatchLifecycleRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { action, match, dirty } = request;
  const latest = [...data.matches, ...data.archivedMatches].find((m) => m.id === match.id) ?? match;
  const season = data.seasons.find((s) => s.id === latest.seasonId);
  const blocked = action === "archive" ? archiveBlockedReason(latest) : action === "restore" && season?.archived ? `Reactiva primero ${season.name} desde Temporadas.` : null;
  const label = action === "delete" ? "Borrar partido" : action === "archive" ? "Archivar partido" : "Reactivar partido";
  const consequences = action === "delete"
    ? ["Se elimina definitivamente el partido, su acta, borradores y todos sus eventos.", "También se eliminan sus votos, porras, respuestas de convocatoria y demás datos asociados.", "Deja de contar en estadísticas y clasificaciones. No se puede deshacer."]
    : action === "archive"
      ? ["Deja de aparecer en el calendario público y de sumar en estadísticas y clasificaciones.", "Conserva el acta, los eventos, las porras y los votos. Queda en modo de solo lectura.", "Podrás recuperarlo desde Archivados cuando su temporada esté activa."]
      : [match.published ? "Vuelve a aparecer en el calendario público y a contar en estadísticas y clasificaciones." : "Se recupera como borrador: seguirá sin publicarse hasta que lo publiques.", "Conserva el acta, los eventos, las porras y los votos guardados."];
  const run = async () => {
    if (busy || blocked) return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") await deleteMatch({ id: match.id });
      else await setMatchArchived({ id: match.id, archived: action === "archive" });
      onComplete(request);
    } catch (e) {
      setError(apiError(e));
      setBusy(false);
    }
  };
  return <ConfirmModal open onClose={() => !busy && onClose()} title={`¿${action === "delete" ? "Borrar" : action === "archive" ? "Archivar" : "Reactivar"} el partido contra ${match.rival || "Rival pendiente"}?`} lede={matchIdentity(match)} confirmLabel={label} confirmTone={action === "delete" ? "redf" : "sky"} consequences={[...consequences, ...(dirty ? ["Los cambios sin guardar de este dispositivo se descartarán solo si se completa la operación."] : [])]} busy={busy} confirmDisabled={!!blocked} error={error || blocked} onConfirm={() => void run()} />;
}
