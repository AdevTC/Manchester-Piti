// Matchday poster, drawn dependency-free on a 2D canvas. The page already loads
// Anton/Archivo, so after `document.fonts.ready` ctx.fillText uses them. Pure
// drawing + export + share helpers; no React.
import type { Zone } from "./formations";

export interface PosterToken {
  number: number;
  name: string;
  x: number; // % of pitch box
  y: number; // % of pitch box
  zone: Zone;
}

export interface PosterMatch {
  rival: string;
  gf: number;
  gc: number;
  outcomeWord: string; // "Victoria" | "Empate" | "Derrota"
  outcomeLetter: string; // "V" | "E" | "D"
}

export interface PosterData {
  title: string; // "MANCHESTER PITI"
  seasonName: string;
  formation: string;
  tokens: PosterToken[];
  score: number;
  tier: string;
  match?: PosterMatch | null;
  crest?: HTMLImageElement | null;
}

const NAVY = "#0c1733";
const NAVY_DEEP = "#0a1228";
const SKY = "#6CABDD";
const GOLD = "#FFC659";
const INK = "#f4f7fb";
const MUTED = "#9fb6d6";

export async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const W = 1080;
const H = 1350;

export async function drawPoster(canvas: HTMLCanvasElement, d: PosterData): Promise<void> {
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts optional */
    }
  }

  // Background
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  // Halftone dots
  ctx.fillStyle = "rgba(108,171,221,0.10)";
  for (let y = 0; y < H; y += 26) {
    for (let x = 0; x < W; x += 26) {
      ctx.beginPath();
      ctx.arc(x, y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Header band
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = SKY;
  ctx.font = "700 22px 'Archivo', sans-serif";
  ctx.fillText(`${d.seasonName.toUpperCase()}  ·  ${d.formation}`, 64, 96);
  ctx.fillStyle = INK;
  ctx.font = "64px 'Anton', sans-serif";
  ctx.fillText(d.title.toUpperCase(), 60, 168);
  ctx.fillStyle = GOLD;
  ctx.fillRect(64, 188, 96, 8);

  // Pitch box
  const px = 64;
  const py = 240;
  const pw = W - 128;
  const ph = 720;
  ctx.fillStyle = NAVY_DEEP;
  roundRect(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 14, py + 14, pw - 28, ph - 28);
  ctx.beginPath();
  ctx.moveTo(px + 14, py + ph / 2);
  ctx.lineTo(px + pw - 14, py + ph / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph / 2, 56, 0, Math.PI * 2);
  ctx.stroke();

  // Tokens
  d.tokens.forEach((t) => {
    const cx = px + (t.x / 100) * pw;
    const cy = py + (t.y / 100) * ph;
    ctx.fillStyle = SKY;
    roundRect(ctx, cx - 26, cy - 30, 52, 52, 9);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = "30px 'Anton', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(t.number), cx, cy + 8);
    ctx.fillStyle = INK;
    ctx.font = "700 17px 'Archivo', sans-serif";
    ctx.fillText(truncate(ctx, (t.name || "").toUpperCase(), 120), cx, cy + 44);
    ctx.textAlign = "left";
  });

  // Chemistry block
  const cyBlock = py + ph + 90;
  ctx.fillStyle = MUTED;
  ctx.font = "700 20px 'Archivo', sans-serif";
  ctx.fillText("VALORACIÓN DEL ONCE", 64, cyBlock - 44);
  ctx.fillStyle = SKY;
  ctx.font = "150px 'Anton', sans-serif";
  ctx.fillText(String(d.score), 60, cyBlock + 78);
  const scoreW = ctx.measureText(String(d.score)).width;
  ctx.fillStyle = MUTED;
  ctx.font = "40px 'Anton', sans-serif";
  ctx.fillText("/100", 60 + scoreW + 12, cyBlock + 78);
  ctx.fillStyle = GOLD;
  ctx.font = "700 26px 'Archivo', sans-serif";
  ctx.fillText(d.tier.toUpperCase(), 64, cyBlock + 120);

  // Match scoreline (optional)
  if (d.match) {
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = "90px 'Anton', sans-serif";
    ctx.fillText(`${d.match.gf}-${d.match.gc}`, W - 64, cyBlock + 60);
    ctx.fillStyle = MUTED;
    ctx.font = "700 22px 'Archivo', sans-serif";
    ctx.fillText(`${d.match.outcomeWord.toUpperCase()} · ${d.match.rival.toUpperCase()}`, W - 64, cyBlock + 96);
    ctx.textAlign = "left";
  }

  // Crest watermark
  if (d.crest) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(d.crest, W - 150, 64, 86, 86);
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Share the blob as a file (Web Share L2) or fall back to a download. */
export async function sharePoster(blob: Blob, filename: string, shareTitle: string): Promise<"shared" | "downloaded"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = new File([blob], filename, { type: "image/png" });
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return "shared";
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
