import { AdIcon } from "../ui/icons";

/** Match management stays outside the scrolling tab body, including after publishing an acta. */
export function MatchLifecycleActions({ onArchive, onDelete, disabled = false }: {
  onArchive: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return <div className="match-management" role="group" aria-label="Gestionar partido">
    <span className="match-management-label">Gestionar partido</span>
    <button type="button" className="btn sm line" onClick={onArchive} disabled={disabled} aria-haspopup="dialog">
      <AdIcon name="arch" size={16} />Archivar partido
    </button>
    <button type="button" className="btn sm red" onClick={onDelete} disabled={disabled} aria-haspopup="dialog">
      <AdIcon name="trash" size={16} />Borrar partido
    </button>
  </div>;
}
