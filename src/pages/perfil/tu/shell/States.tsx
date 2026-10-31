// The page's states, painted (bugs 1–2): «Cargando tu página…» while the profile arrives (text a screen reader
// hears, not a blank main), and when it can't be read «No hemos podido abrir tu página.» with «Reintentar», which
// asks for the data again without reloading the page.
import { TuIcon } from "../../../../components/vidrio/tu/ui";

export function Loading() {
  return (
    <div className="tc-skel" aria-busy="true">
      <i aria-hidden="true" />
      <div>
        <p className="tc-kick">Tu página</p>
        <p className="nx-h2" role="status">
          Cargando tu página…
        </p>
        <p className="nx-sub">Tus partidos, tus notas y lo que te toca llegan en un momento.</p>
      </div>
    </div>
  );
}

export function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="tk-empty tc-failed" role="alert">
      <span className="tk-tile tk-tile--warn">
        <TuIcon name="wifiOff" className="nx-ic" />
      </span>
      <h2>No hemos podido abrir tu página.</h2>
      <p>Comprueba la conexión y vuelve a intentarlo.</p>
      <div className="tk-acts">
        <button type="button" className="vd-glass vd-press nx-btn nx-btn--pri" onClick={onRetry}>
          Reintentar
        </button>
      </div>
    </div>
  );
}
