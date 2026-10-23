// Tú › the studio's image: what the preview shows, painted on a canvas — the frame (story 9:16 or post 4:5) with
// the card (its front or its carné with the QR) or the «¡Ya es oficial!» poster, at 1080 px wide. It draws the same
// proportions the CSS gives the card (tu.css .tu-card__*), with the printed shirt still as an image.
import { qrPath } from "../../acceso/qrPath";
import type { CardModel } from "./TuCard";

export type Fmt = "historia" | "post";
export interface Poster {
  kick: string;
  name: string;
  line: string;
  foot: string;
  tone: "ok" | "warn" | "off";
}
export interface ShareImage {
  fmt: Fmt;
  face: "frente" | "dorso";
  card: CardModel | null;
  poster: Poster | null;
  /** The shirt still (its src) for the card or the poster. */
  shirt: string | null;
  crest: string;
}

const SIZE: Record<Fmt, { w: number; h: number }> = { historia: { w: 1080, h: 1920 }, post: { w: 1080, h: 1350 } };
const METAL: Record<string, string> = { bronce: "#c08a5c", plata: "#d9e2ec", oro: "#e3d4a4", racha: "#9fd0f2", nuevo: "rgba(234,243,252,.5)" };
const INK = "#eaf3fc";
const SANS = "'Mona Sans', 'Inter', system-ui, sans-serif";

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function text(g: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, weight: number, align: CanvasTextAlign = "left", color = INK, maxW?: number) {
  g.font = `${weight} ${size}px ${SANS}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillText(t, x, y, maxW);
}

function face(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, metal: string) {
  const r = w * 0.075;
  g.save();
  rr(g, x, y, w, h, r);
  g.clip();
  const lg = g.createLinearGradient(x, y, x + w * 0.17, y + h);
  lg.addColorStop(0, "#173a6b");
  lg.addColorStop(0.48, "#0e2347");
  lg.addColorStop(1, "#081227");
  g.fillStyle = lg;
  g.fillRect(x, y, w, h);
  const rg = g.createRadialGradient(x + w * 0.3, y, 0, x + w * 0.3, y, w * 1.2);
  rg.addColorStop(0, "rgba(159,208,242,.35)");
  rg.addColorStop(0.6, "rgba(159,208,242,0)");
  g.fillStyle = rg;
  g.fillRect(x, y, w, h);
  g.restore();
  g.lineWidth = w * 0.024;
  g.strokeStyle = metal;
  rr(g, x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, r);
  g.stroke();
}

function drawFront(g: CanvasRenderingContext2D, c: Extract<CardModel, { kind: "face" }>, x: number, y: number, w: number, h: number, shirt: HTMLImageElement | null, crest: HTMLImageElement | null) {
  face(g, x, y, w, h, METAL[c.tier] ?? METAL.nuevo);
  if (c.rating) text(g, c.rating, x + w * 0.07, y + h * 0.055 + w * 0.17, w * 0.2, 800);
  text(g, c.pos, x + w * 0.07, y + h * 0.055 + w * (c.rating ? 0.25 : 0.06), w * 0.062, 700);
  if (crest) g.drawImage(crest, x + w * 0.78, y + h * 0.06, w * 0.15, w * 0.15);
  if (shirt) {
    const sw = w * 0.7;
    g.drawImage(shirt, x + w * 0.15, y + h * 0.14, sw, (sw * 600) / 540);
  }
  text(g, c.name.toUpperCase(), x + w / 2, y + h * 0.715 + w * 0.08, w * 0.082, 780, "center", INK, w * 0.88);
  text(g, c.club, x + w / 2, y + h * 0.715 + w * 0.15, w * 0.045, 600, "center", "rgba(234,243,252,.82)", w * 0.88);
  const ax = x + w * 0.08;
  const aw = w * 0.84;
  const ay = y + h - h * 0.045;
  g.fillStyle = "rgba(234,243,252,.22)";
  g.fillRect(ax, ay - w * 0.13, aw, 1.5);
  c.attrs.forEach((a, i) => {
    const cx = ax + (aw / 6) * (i + 0.5);
    text(g, a.text, cx, ay - w * 0.055, w * 0.056, 780, "center");
    text(g, a.k, cx, ay - w * 0.005, w * 0.042, 650, "center", "rgba(234,243,252,.8)");
  });
}

function drawBack(g: CanvasRenderingContext2D, c: CardModel, x: number, y: number, w: number, h: number, crest: HTMLImageElement | null) {
  face(g, x, y, w, h, c.kind === "face" ? (METAL[c.tier] ?? METAL.nuevo) : METAL.nuevo);
  const b = c.back;
  if (crest) g.drawImage(crest, x + w * 0.07, y + h * 0.06, w * 0.14, w * 0.14);
  text(g, "CARNÉ DE SOCIO", x + w * 0.25, y + h * 0.06 + w * 0.06, w * 0.042, 650, "left", "rgba(234,243,252,.8)");
  text(g, b.name, x + w * 0.25, y + h * 0.06 + w * 0.13, w * 0.072, 780, "left", INK, w * 0.68);
  const rows: [string, string][] = [
    ["Socio desde", b.since],
    ["Cómo entraste", b.howIn],
    ["Te abrió", b.whoOpened],
    ["Caducidad", "No caduca"],
  ];
  let ry = y + h * (c.kind === "carne" ? 0.29 : 0.22);
  for (const [k, v] of rows) {
    text(g, k, x + w * 0.07, ry + w * 0.04, w * 0.038, 500, "left", "rgba(234,243,252,.75)");
    text(g, v, x + w * 0.07, ry + w * 0.1, w * 0.052, 650, "left", INK, w * 0.86);
    g.fillStyle = "rgba(234,243,252,.16)";
    g.fillRect(x + w * 0.07, ry + w * 0.125, w * 0.86, 1.5);
    ry += w * 0.155;
  }
  const q = w * 0.24;
  const qx = x + w * 0.07;
  const qy = y + h - h * 0.055 - q;
  const { d, n } = qrPath(b.url);
  g.fillStyle = "#fff";
  g.fillRect(qx, qy, q, q);
  g.save();
  const s = q / (n + 4);
  g.translate(qx + 2 * s, qy + 2 * s);
  g.scale(s, s);
  g.fillStyle = "#0c1733";
  g.fill(new Path2D(d));
  g.restore();
  text(g, b.path, x + w * 0.93, qy + q, w * 0.036, 500, "right", "rgba(234,243,252,.8)");
}

/** The PNG of what the studio shows. */
export async function shareImage(o: ShareImage): Promise<Blob | null> {
  const { w, h } = SIZE[o.fmt];
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) return null;
  if (document.fonts?.ready) await document.fonts.ready;
  const [shirt, crest] = await Promise.all([o.shirt ? load(o.shirt) : Promise.resolve(null), load(o.crest)]);
  // the frame: tu.css .tu-frame
  const lg = g.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, "#10285a");
  lg.addColorStop(1, "#081227");
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
  const rg = g.createRadialGradient(w / 2, h * 0.15, 0, w / 2, h * 0.15, w * 0.9);
  rg.addColorStop(0, "rgba(108,171,221,.45)");
  rg.addColorStop(0.7, "rgba(108,171,221,0)");
  g.fillStyle = rg;
  g.fillRect(0, 0, w, h);
  if (o.card) {
    const cw = w * (o.fmt === "historia" ? 170 / 260 : 180 / 300);
    const ch = (cw * 7) / 5;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;
    if (o.face === "dorso" || o.card.kind !== "face") drawBack(g, o.card, cx, cy, cw, ch, crest);
    else drawFront(g, o.card, cx, cy, cw, ch, shirt, crest);
  } else if (o.poster) {
    const p = o.poster;
    const k = w / 300;
    let y = h / 2 - 170 * k;
    if (crest) g.drawImage(crest, w / 2 - 22 * k, y, 44 * k, 44 * k);
    y += 44 * k + 26 * k;
    text(g, p.kick, w / 2, y, 20 * k, 800, "center", p.tone === "warn" ? "#f2d04b" : INK);
    y += 12 * k;
    if (shirt) {
      g.globalAlpha = p.tone === "off" ? 0.55 : 1;
      g.drawImage(shirt, w / 2 - 75 * k, y, 150 * k, (150 * k * 600) / 540);
      g.globalAlpha = 1;
    }
    y += (150 * k * 600) / 540 + 28 * k;
    text(g, p.name.toUpperCase(), w / 2, y, 22 * k, 800, "center", INK, w * 0.9);
    y += 22 * k;
    text(g, p.line, w / 2, y, 13 * k, 500, "center");
    y += 20 * k;
    text(g, p.foot, w / 2, y, 11.5 * k, 500, "center", "rgba(234,243,252,.8)");
  }
  return new Promise((res) => cv.toBlob((b) => res(b), "image/png"));
}
