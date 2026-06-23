import React, { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { canvasToBlob, drawPoster, loadImage, sharePoster, type PosterData } from "./poster";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl uppercase tracking-wide">Compartir el once</DialogTitle>
        </DialogHeader>
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
          <Button variant="ghost" disabled={busy} onClick={() => void onShare()}>
            <Share2 size={15} aria-hidden="true" /> Compartir
          </Button>
          <Button disabled={busy} onClick={() => void onShare()}>
            <Download size={15} aria-hidden="true" /> Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
