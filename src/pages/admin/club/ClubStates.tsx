// The club views' load error (the Inicio pattern): the dashed empty state in red, with «Reintentar».
import { AdIcon } from "../ui/icons";

export function LoadError({ what }: { what: string }) {
  return (
    <div className="vb scr">
      <div className="empty ad-err" role="alert">
        <AdIcon name="alert" size={22} />
        <b>No se han podido cargar {what}</b>
        <small>Comprueba la conexión y vuelve a intentarlo.</small>
        <button type="button" className="btn sm line" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
