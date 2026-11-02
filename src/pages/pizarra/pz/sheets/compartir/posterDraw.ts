// r14 «La pizarra» · Compartir › El cartel: the image itself (Historia 9:16 1080×1920 · Post 4:5 1080×1350). The
// sheet shows THIS image as its preview, so what you see is what you send. The pitch is seen from the Grada (the
// prototype's camera): a trapezoid, the printed shirts (the app's kit stills) with their plates, the galones, and,
// when asked, the rival in coral, each one's last nota and the board's strokes. Canvas helpers from poster.ts.
import { canvasToBlob, loadImage, roundRect, truncate } from "../../../poster";
import { SHARE_SIZE, type ShareFormat } from "../../../../perfil/share";

export interface PosterShirt {
  src: string | undefined;
  num: string;
  name: string;
  x: number;
  y: number;
  /** «C», «V», «P», «F», «E». */
  gal: string[];
  nota: string | null;
  empty: boolean;
}
export interface PosterModel {
  fmt: ShareFormat;
  head: string;
  title: string;
  sub: string;
  shirts: PosterShirt[];
  rival: { x: number; y: number; num: string }[];
  paths: [number, number][][];
  gal: { k: string; n: string }[];
  foot: string;
  crest: string;
}

const NAVY = "#0c1733";
const INK = "#ffffff";
const INK2 = "#c3d5ec";
const SANS = "'Mona Sans', 'Inter', system-ui, sans-serif";
const GOLD = "#ffc659";

/** A pitch point (x across, y 0 = their goal line) seen from the Grada, in the pitch box. */
export function gradaPoint(x: number, y: number, box: { x: number; y: number; w: number; h: number }): { X: number; Y: number; k: number } {
  const t = Math.max(0, Math.min(100, y)) / 100;
  const k = 0.74 + 0.26 * t;
  const w = box.w * k;
  return { X: box.x + box.w / 2 + ((x - 50) / 100) * w, Y: box.y + box.h * (0.04 + 0.92 * Math.pow(t, 1.08)), k };
}

async function fontsReady(): Promise<void> {
  try {
    const f = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (f) await Promise.race([f.ready, new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* draw with what there is */
  }
}

function pitch(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) {
  const P = (x: number, y: number) => gradaPoint(x, y, box);
  const poly = (pts: [number, number][]) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const p = P(x, y);
      if (i) ctx.lineTo(p.X, p.Y);
      else ctx.moveTo(p.X, p.Y);
    });
  };
  // the grass, mowed in bands
  for (let i = 0; i < 10; i++) {
    poly([
      [-3, i * 10 - 1],
      [103, i * 10 - 1],
      [103, i * 10 + 10],
      [-3, i * 10 + 10],
    ]);
    ctx.fillStyle = i % 2 ? "#1f7a3e" : "#238545";
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,.82)";
  ctx.lineWidth = 3;
  poly([
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ]);
  ctx.stroke();
  poly([
    [0, 50],
    [100, 50],
  ]);
  ctx.stroke();
  // the centre circle and the boxes
  ctx.beginPath();
  for (let a = 0; a <= 64; a++) {
    const p = P(50 + 13 * Math.cos((a / 64) * Math.PI * 2), 50 + 9.5 * Math.sin((a / 64) * Math.PI * 2));
    if (a) ctx.lineTo(p.X, p.Y);
    else ctx.moveTo(p.X, p.Y);
  }
  ctx.stroke();
  for (const top of [true, false]) {
    const y0 = top ? 0 : 100;
    const d = top ? 1 : -1;
    poly([
      [22, y0],
      [22, y0 + d * 16],
      [78, y0 + d * 16],
      [78, y0],
    ]);
    ctx.stroke();
    poly([
      [38, y0],
      [38, y0 + d * 6],
      [62, y0 + d * 6],
      [62, y0],
    ]);
    ctx.stroke();
  }
}

function plate(ctx: CanvasRenderingContext2D, cx: number, y: number, text: string, size: number, maxW: number) {
  ctx.font = `800 ${size}px ${SANS}`;
  const t = truncate(ctx, text, maxW);
  const w = ctx.measureText(t).width + size * 0.9;
  ctx.fillStyle = "rgba(6,14,32,.86)";
  roundRect(ctx, cx - w / 2, y, w, size * 1.5, size * 0.42);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t, cx, y + size * 0.78);
}

/** Draw the cartel on `canvas` (its pixels are the format's). */
export async function drawPosterR14(canvas: HTMLCanvasElement, m: PosterModel): Promise<boolean> {
  const { w: W, h: H } = SHARE_SIZE[m.fmt];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  await fontsReady();
  const imgs = await Promise.all([loadImage(m.crest), ...m.shirts.map((s) => (s.src ? loadImage(s.src) : Promise.resolve(null)))]);
  const crest = imgs[0];
  // the ground (dark in both themes, like La carta)
  const bg = ctx.createLinearGradient(0, 0, W * 0.15, H);
  bg.addColorStop(0, "#1d3d70");
  bg.addColorStop(0.52, "#0c1d3f");
  bg.addColorStop(1, "#081227");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, W * 0.7);
  glow.addColorStop(0, "rgba(108,171,221,.28)");
  glow.addColorStop(1, "rgba(108,171,221,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const pad = 64;
  const post = m.fmt === "post";
  // the header: crest, club, the match
  const cs = post ? 84 : 100;
  if (crest) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pad + cs / 2, pad + cs / 2, cs / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(crest, pad, pad, cs, cs);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = `780 ${post ? 36 : 42}px ${SANS}`;
  ctx.fillText("Manchester Piti", pad + cs + 26, pad + cs * 0.44);
  ctx.fillStyle = INK2;
  ctx.font = `620 ${post ? 32 : 38}px ${SANS}`;
  ctx.fillText(truncate(ctx, m.head, W - pad * 2 - cs - 26), pad + cs + 26, pad + cs * 0.9);
  // the title
  const ty = pad + cs + (post ? 104 : 150);
  ctx.fillStyle = INK;
  ctx.font = `820 ${post ? 96 : 116}px ${SANS}`;
  ctx.fillText(truncate(ctx, m.title, W - pad * 2), pad, ty);
  ctx.fillStyle = INK2;
  ctx.font = `650 ${post ? 36 : 42}px ${SANS}`;
  ctx.fillText(truncate(ctx, m.sub, W - pad * 2), pad, ty + (post ? 56 : 66));
  // the pitch from the Grada
  const footH = post ? 170 : 220;
  const box = { x: 40, y: ty + (post ? 96 : 130), w: W - 80, h: H - footH - (ty + (post ? 96 : 130)) - 10 };
  pitch(ctx, box);
  // the strokes
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 14]);
  m.paths.forEach((pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const p = gradaPoint(x, y, box);
      if (i) ctx.lineTo(p.X, p.Y);
      else ctx.moveTo(p.X, p.Y);
    });
    ctx.stroke();
  });
  ctx.restore();
  // the rival in coral
  m.rival.forEach((r) => {
    const p = gradaPoint(r.x, r.y, box);
    const rr = 30 * p.k;
    ctx.fillStyle = "#f08a7e";
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.X, p.Y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#3b0d07";
    ctx.font = `820 ${Math.round(28 * p.k)}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(r.num, p.X, p.Y + 1);
  });
  // our seven, far first
  const order = m.shirts.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y);
  for (const { s, i } of order) {
    const p = gradaPoint(s.x, s.y, box);
    const sw = (post ? 128 : 150) * p.k;
    const sh = sw * 1.327;
    const top = p.Y - sh * 0.82;
    if (s.empty) {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.X, p.Y - sh * 0.35, sw * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const img = imgs[i + 1];
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    if (img) {
      // (the still is 540×600: the shirt is x 63–476, y 46–594)
      const fx = img.naturalWidth / 540;
      const fy0 = img.naturalHeight / 600;
      ctx.drawImage(img, 63 * fx, 46 * fy0, 413 * fx, 548 * fy0, p.X - sw / 2, top, sw, sh);
    } else {
      ctx.fillStyle = "#9fd0f2";
      roundRect(ctx, p.X - sw / 2, top, sw, sh, sw * 0.14);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = NAVY;
      ctx.font = `820 ${Math.round(sw * 0.45)}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.num, p.X, top + sh * 0.55);
    }
    ctx.restore();
    plate(ctx, p.X, top + sh + 4, (s.num ? s.num + " " : "") + s.name, Math.round((post ? 25 : 28) * Math.max(0.85, p.k)), sw * 1.9);
    // galones over the shoulder
    s.gal.forEach((g, k) => {
      const gx = p.X - ((s.gal.length - 1) * 34) / 2 + k * 34;
      const gy = top - 8;
      ctx.fillStyle = g === "C" ? GOLD : "#eaf3fc";
      ctx.beginPath();
      ctx.arc(gx, gy, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.font = `820 19px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(g, gx, gy + 1);
    });
    if (s.nota) {
      ctx.font = `800 24px ${SANS}`;
      const tw = ctx.measureText(s.nota).width + 18;
      ctx.fillStyle = "#9fe3b6";
      roundRect(ctx, p.X + sw * 0.32, top + sh * 0.12, tw, 34, 10);
      ctx.fill();
      ctx.fillStyle = "#0b2a17";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(s.nota, p.X + sw * 0.32 + 9, top + sh * 0.12 + 18);
    }
  }
  // galones, then the foot
  let gy = H - footH + 40;
  let gx = pad;
  ctx.textBaseline = "middle";
  m.gal.forEach((g) => {
    ctx.font = `700 30px ${SANS}`;
    const nw = ctx.measureText(g.n).width;
    if (gx + 44 + nw > W - pad) {
      gx = pad;
      gy += 46;
    }
    ctx.fillStyle = g.k === "C" ? GOLD : "#eaf3fc";
    ctx.beginPath();
    ctx.arc(gx + 16, gy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = `820 19px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(g.k, gx + 16, gy + 1);
    ctx.fillStyle = "#e5eef8";
    ctx.font = `700 30px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(g.n, gx + 40, gy + 1);
    gx += 40 + nw + 30;
  });
  const fy = H - 64;
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, fy - 44);
  ctx.lineTo(W - pad, fy - 44);
  ctx.stroke();
  ctx.fillStyle = INK2;
  ctx.font = `650 30px ${SANS}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(truncate(ctx, m.foot, W - pad * 2 - 220), pad, fy);
  ctx.fillStyle = INK;
  ctx.font = `760 30px ${SANS}`;
  ctx.textAlign = "right";
  ctx.fillText("la pizarra", W - pad, fy);
  return true;
}

/** The cartel as a PNG (null where the canvas can't draw). */
export async function posterBlob(m: PosterModel): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ok = await drawPosterR14(canvas, m).catch(() => false);
  const blob = ok ? await canvasToBlob(canvas) : null;
  canvas.width = canvas.height = 0; // (iOS caps a page's canvas memory)
  return blob;
}
