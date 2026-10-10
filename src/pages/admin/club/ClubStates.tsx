// The club views' load error (v2): the wall panel (`.void`) with the alert, what failed and «Reintentar».
import { AdIcon } from "../ui/icons";

export function LoadError({ what }: { what: string }) {
  return (
    <div className="void" role="alert">
      <span className="bad">
        <AdIcon name="alert" size={22} />
      </span>
      <h3>No se han podido cargar {what}</h3>
      <p>Comprueba la conexión y vuelve a intentarlo.</p>
      <button type="button" className="btn line" onClick={() => window.location.reload()}>
        Reintentar
      </button>
    </div>
  );
}
