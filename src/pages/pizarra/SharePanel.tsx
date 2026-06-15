import React, { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import { canvasToBlob, drawPoster, loadImage, sharePoster, type PosterData } from "./poster";

interface SharePanelProps {
  data: PosterData;
  onClose: () => void;
}

export const SharePanel: React.FC<SharePanelProps> = ({ data, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const crest = await loadImage("/crest.png");
      await drawPoster(canvas, { ...data, crest });
      const blob = await canvasToBlob(canvas);
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data]);

  const onShare = async (): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    const result = await sharePoster(blob, "manchester-piti-once.png", "Mi once · Manchester Piti");
    setNote(result === "shared" ? "Compartido" : "Descargado");
  };

  return (
    <div className="pz-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="pz-share" role="dialog" aria-modal="true" aria-label="Compartir el once" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pz-share-close" aria-label="Cerrar" onClick={onClose}>
          <X size={18} />
        </button>
        <h3 className="pz-dialog-title">Compartir el once</h3>
        <div className="pz-share-preview">
          {preview ? (
            <img src={preview} alt="Vista previa del póster del once" />
          ) : (
            <span className="pz-share-loading">Generando póster…</span>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />
        <div className="pz-dialog-actions">
          {note && <span className="pz-share-note" role="status">{note}</span>}
          <button type="button" className="pz-btn-ghost" disabled={busy} onClick={() => void onShare()}>
            <Share2 size={15} aria-hidden="true" /> Compartir
          </button>
          <button type="button" className="pz-btn-solid" disabled={busy} onClick={() => void onShare()}>
            <Download size={15} aria-hidden="true" /> Descargar
          </button>
        </div>
      </div>
    </div>
  );
};
