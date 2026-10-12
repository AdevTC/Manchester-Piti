// Compartir, Bloque 4: the board's link as a QR (drawn here, from the board's link: no outside service)
// to open it on another phone, «Clonar este tablero» (your own copy of whatever board you are looking at),
// and the jugada as a video (ClipExport).
import { useMemo, type ReactNode } from "react";
import { qrPath } from "../../acceso/qrPath";
import { Icon } from "./icons";
import "../../../styles/pizarra-dibujo.css";

/** The board link's QR (two white modules around it). */
export function BoardQr({ link, name }: { link: string; name: string }) {
  const { d, n } = useMemo(() => qrPath(link), [link]);
  const s = n + 4;
  return (
    <svg className="dr-qr" viewBox={"-2 -2 " + s + " " + s} shapeRendering="crispEdges" role="img" aria-label={"Código QR del enlace al tablero «" + name + "»"}>
      <rect x={-2} y={-2} width={s} height={s} fill="#ffffff" />
      <path d={d} fill="#0c1733" />
    </svg>
  );
}

export interface BoardShareProps {
  /** The board's link (null while it has not been saved yet). */
  link: string | null;
  name: string;
  /** The board on screen is someone else's or the official (cloning it is the way to edit it). */
  readOnly: boolean;
  canClone: boolean;
  onClone: () => void;
  /** The jugada as a video. */
  clip: ReactNode;
  clipName: string;
}

export function BoardShare(p: BoardShareProps) {
  return (
    <div className="dr-share">
      <h3>El tablero en otro móvil</h3>
      {p.link ? (
        <div className="dr-qrw">
          <BoardQr link={p.link} name={p.name} />
          <p>Escanéalo con la cámara: abre este tablero tal cual. Desde ahí, «Clonar este tablero» deja una copia para editarla.</p>
        </div>
      ) : (
        <p className="empty">El QR llega en cuanto el tablero se guarde (con tu primer cambio).</p>
      )}
      <div className="row">
        <button type="button" className="b3" onClick={p.onClone} disabled={!p.canClone}>
          <Icon n="copy" />
          Clonar este tablero
        </button>
      </div>
      {p.readOnly && <p className="dr-hint">No es tuyo: la copia sí lo será, con su siete, sus trazos y sus jugadas.</p>}
      <h3>{"La jugada en vídeo · " + p.clipName}</h3>
      {p.clip}
    </div>
  );
}
