// The cartel as an image: drawn on a canvas only when asked for, then shared (Web Share with a file where the
// browser can) or saved. Used by the cartel sheet and by Partidos' «Guardar la imagen».
import { useState } from "react";
import type { Cartel } from "../../../lib/derived/vidrio/cartel";
import { venueName } from "../model";
import { PAINT_STOPS, type SegmentPaint } from "./model";

const W = 1080;
const H = 1350;

function skyGradient(g: CanvasRenderingContext2D, key: SegmentPaint["a"]) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  for (const [c, at] of PAINT_STOPS[key]) grad.addColorStop(at / 100, c);
  return grad;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("crest"));
    img.src = src;
  });

/** Draws the poster at 1080 × 1350 and returns it as a PNG. */
async function drawCartel(cartel: Cartel, paint: SegmentPaint): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  if (!g) throw new Error("canvas");
  await document.fonts?.ready;
  g.fillStyle = skyGradient(g, paint.a);
  g.fillRect(0, 0, W, H);
  if (paint.b !== paint.a) {
    const layer = document.createElement("canvas");
    layer.width = W;
    layer.height = H;
    const l = layer.getContext("2d");
    if (l) {
      l.fillStyle = skyGradient(l, paint.b);
      l.fillRect(0, 0, W, H);
      l.globalCompositeOperation = "destination-in";
      const mask = l.createLinearGradient(0, 0, W, 0);
      mask.addColorStop(paint.m0 / 100, "rgba(0,0,0,0)");
      mask.addColorStop(paint.m1 / 100, "rgba(0,0,0,1)");
      l.fillStyle = mask;
      l.fillRect(0, 0, W, H);
      g.drawImage(layer, 0, 0);
    }
    layer.width = layer.height = 0;
  }
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(5,12,32,.35)");
  shade.addColorStop(0.4, "rgba(5,12,32,0)");
  shade.addColorStop(0.6, "rgba(5,12,32,0)");
  shade.addColorStop(1, "rgba(4,10,22,.7)");
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  const pad = 76;
  try {
    const crest = await loadImage("/crest-256.webp");
    g.save();
    g.beginPath();
    g.arc(pad + 70, pad + 70, 70, 0, Math.PI * 2);
    g.clip();
    g.drawImage(crest, pad, pad, 140, 140);
    g.restore();
  } catch {
    /* the poster still works without the crest */
  }
  g.fillStyle = "#fff";
  g.textBaseline = "alphabetic";
  g.textAlign = "right";
  g.font = "620 36px 'Mona Sans', system-ui, sans-serif";
  g.fillText(cartel.seasonName, W - pad, pad + 40);
  g.fillText("Liga de fútbol 7", W - pad, pad + 84);
  if (cartel.signature) {
    g.save();
    const size = 500;
    g.translate(W - pad - size / 2 + 20, 270 + size / 2);
    g.scale(size / 208, size / 208);
    g.lineJoin = "round";
    g.lineCap = "round";
    for (const r of cartel.signature.rings) {
      g.strokeStyle = r.outer ? `rgba(207,231,250,${r.opacity})` : `rgba(255,255,255,${r.opacity})`;
      g.lineWidth = r.strokeWidth;
      g.stroke(new Path2D(r.d));
    }
    g.restore();
  }
  g.textAlign = "left";
  g.font = "800 360px 'Mona Sans', system-ui, sans-serif";
  g.fillText(cartel.jornadaLabel || "J", pad - 10, 900);
  g.font = "720 88px 'Mona Sans', system-ui, sans-serif";
  g.fillText("Manchester Piti", pad, 1010);
  g.font = "520 44px 'Mona Sans', system-ui, sans-serif";
  g.globalAlpha = 0.85;
  g.fillText(cartel.home ? "contra" : "en casa de", pad, 1066);
  g.globalAlpha = 1;
  g.font = "720 88px 'Mona Sans', system-ui, sans-serif";
  g.fillText(cartel.rival, pad, 1150, W - 2 * pad);
  g.fillStyle = "rgba(255,255,255,.4)";
  g.fillRect(pad, 1186, W - 2 * pad, 2);
  g.fillStyle = "#fff";
  g.font = "560 36px 'Mona Sans', system-ui, sans-serif";
  g.fillText(`${cartel.dateLine}${cartel.time ? `, ${cartel.time}` : ""}`, pad, 1240, 560);
  g.fillText(venueName(cartel.venue), pad, 1286, 560);
  g.textAlign = "right";
  g.font = "800 112px 'Mona Sans', system-ui, sans-serif";
  g.fillText(cartel.big, W - pad, 1270, 440);
  if (cartel.mvp) {
    g.fillStyle = "#FFD58A";
    g.font = "700 34px 'Mona Sans', system-ui, sans-serif";
    g.fillText(`MVP ${cartel.mvp}`, W - pad, 1312);
  }
  try {
    return await new Promise<Blob>((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error("png"))), "image/png"));
  } finally {
    cv.width = cv.height = 0; // its pixels go now: iOS caps a page's canvas memory
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type ShareNavigator = Navigator & { canShare?: (data: ShareData) => boolean };

/** Compartir (Web Share with the image where the browser can, else it is saved) and Guardar la imagen. */
/** Draws the cartel and shares or saves it; `run` resolves true when the image went out. (null: nothing to draw.) */
export function useCartelShare(cartel: Cartel | null, paint: SegmentPaint | null) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const run = async (share: boolean): Promise<boolean> => {
    if (busy || !cartel || !paint) return false;
    setBusy(true);
    setNote("");
    try {
      const blob = await drawCartel(cartel, paint);
      const file = new File([blob], cartel.fileName, { type: "image/png" });
      const nav = navigator as ShareNavigator;
      if (share && typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `Cartel de la ${cartel.jornadaLabel || "jornada"}`, text: cartel.aria });
        setNote("Cartel compartido.");
        return true;
      } else {
        save(blob, cartel.fileName);
        setNote(share ? "Este navegador no comparte imágenes: la hemos guardado." : "Imagen guardada.");
        return true;
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("No se ha podido hacer la imagen. Prueba otra vez.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, note, run };
}

/** The cockpit's cartel, inline in the lens's third column (Previa and Acta). */
