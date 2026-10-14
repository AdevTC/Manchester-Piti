// The acta editor's bar for the jugadas the touchline wrote while the edits were unsaved (M4):
// «Han llegado N jugadas nuevas desde que empezaste a editar · Incorporarlas» (useLiveCatchUp).
import { AdIcon } from "../ui/icons";

export function LiveCatchUpBar({ count, conflict, onIncorporate }: { count: number; conflict: boolean; onIncorporate: () => void }) {
  if (count <= 0) return null;
  const one = count === 1;
  return (
    <div className="rec2" role="status">
      <AdIcon name="whistle" size={18} />
      <span>
        <b>{one ? "Ha llegado 1 jugada nueva" : `Han llegado ${count} jugadas nuevas`} desde que empezaste a editar</b>
        <small>
          {conflict
            ? "Se añaden a tu acta, pero alguno de tus cambios choca con otro del servidor: al guardar te pedirá recargar."
            : "Se añaden a tu acta sin tocar tus cambios."}
        </small>
      </span>
      <button type="button" className="btn sm sky" onClick={onIncorporate}>
        {one ? "Incorporarla" : "Incorporarlas"}
      </button>
    </div>
  );
}
