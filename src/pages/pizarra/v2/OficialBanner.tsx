// «El oficial ha cambiado: entra X»: opening the pizarra after the captain changed the official's seven,
// a slab says who comes in and who goes out since this device last saw it, with «Ver el oficial» and
// «Vale». Not a live region: the board's one announcer says it when it appears. The captain editing the
// official never gets it (the changes are his).

export function OficialBanner({ msg, onView, onOk }: { msg: string; onView: (() => void) | null; onOk: () => void }) {
  return (
    <div className="ofb" role="group" aria-label="Aviso del oficial">
      <p>
        <b>Oficial</b>
        {msg}
      </p>
      <div className="ofb-a">
        {onView && (
          <button type="button" className="b3 gold" onClick={onView}>
            Ver el oficial
          </button>
        )}
        <button type="button" className="b3" onClick={onOk}>
          Vale
        </button>
      </div>
    </div>
  );
}
